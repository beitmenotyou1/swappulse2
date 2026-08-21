// post-help-promo — publishes a help article promo post to the AT Protocol from
// the SwapPulse promo bot account, cycling through all help guides in order.
//
// Reads the HelpPromoCursor entity (single-row) to find the current rotation
// index, selects the article at that index from the shared HELP_ARTICLES list,
// composes a conversational promo message with the article's
// https://swappulse.org/help/<slug> link, uploads the branded SwapPulse banner
// image to the PDS as a blob, publishes an app.bsky.feed.post with the image
// embed, tracks the post in PromoPost so firehose-ingest skips it, and advances
// the cursor to the next article (wrapping to 0 after the last).
//
// Supports an `op` parameter:
//   - "post" (default): post the next article and advance the cursor
//   - "status": return the current cursor state without posting
//   - "reset": reset the cursor to index 0 (admin only)
//   - "skip": advance the cursor by one without posting (admin only)
//
// Reuses the same PdsCredential lookup, getPdsSessionForUser, pdsRequest,
// uploadCardImage pattern, buildRichTextFacets, and PromoPost tracking as
// post-promo. Invoked by the "Help Article Promo" workflow every 8 hours.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSessionForUser, pdsRequest } from '../../shared/pdsSession.ts';
import { uploadPromoImage } from '../../shared/promoImageUpload.ts';
import { buildRichTextFacets } from '../../shared/hashtagFacets.ts';
import { HELP_ARTICLES } from '../../shared/helpArticles.ts';
import {
  HASHTAG_SETS,
  pick,
  pickPromoLocale,
  getPoolsForLocale,
  withLangParam,
  parseTags,
  countGraphemes,
  type PromoLocale,
} from '../../shared/promoMessages.ts';

const PROMO_USER_ID = '6a6422a1b8cda8ece8138c87';
const SITE_BASE = 'https://swappulse.org';
const PROMO_BANNER_URL = 'https://media.base44.com/images/public/6a63d9d64a4d65d370c70892/a22b46eb2_generated_image.png';

interface Article {
  slug: string;
  title: string;
  category: string;
  description: string;
}

function generateMessage(article: Article, locale: string): { content: string; tags: string[] } {
  const pools = getPoolsForLocale(locale);
  const hook = pick(pools.helpHooks)
    .replace(/\{title\}/g, article.title);
  const hashtagSet = pick(HASHTAG_SETS);
  const tags = parseTags(hashtagSet);
  const hashtags = hashtagSet;
  const helpUrl = withLangParam(`${SITE_BASE}/help/${article.slug}`, locale);
  const cta = pick(pools.helpCtas)
    .replace(/\{SITE_BASE\}\/help\/\{slug\}/g, withLangParam(`${SITE_BASE}/help/${article.slug}`, locale))
    .replace(/\{SITE_BASE\}/g, SITE_BASE)
    .replace(/\{slug\}/g, article.slug);
  const descLine = article.description;

  // Try full message first, then trim if over 300 graphemes
  const valueProp = pick(pools.helpValueProps);
  const full = `${hook}\n\n${descLine}\n\n${valueProp}\n\n${cta}\n\n${hashtags}`;
  if (countGraphemes(full) <= 300) {
    return { content: full, tags };
  }

  // Drop the value prop
  const medium = `${hook}\n\n${descLine}\n\n${cta}\n\n${hashtags}`;
  if (countGraphemes(medium) <= 300) {
    return { content: medium, tags };
  }

  // Drop the description too
  const essential = `${hook}\n\n${cta}\n\n${hashtags}`;
  if (countGraphemes(essential) <= 300) {
    return { content: essential, tags };
  }

  return { content: essential.slice(0, 297) + '...', tags };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    let body: any = {};
    try { body = await req.json(); } catch { /* no body is fine */ }
    const op = body.op || 'post';

    // --- Read or create the cursor ---
    let cursors = await svc.entities.HelpPromoCursor.list('-created_date', 1).catch(() => []);
    let cursor = cursors[0] || null;

    if (op === 'status') {
      const currentArticle = cursor
        ? HELP_ARTICLES[cursor.current_index % cursor.total_articles]
        : HELP_ARTICLES[0];
      const nextIndex = cursor
        ? (cursor.current_index + 1) % cursor.total_articles
        : 1;
      const nextArticle = cursor
        ? HELP_ARTICLES[nextIndex]
        : HELP_ARTICLES[1];
      return Response.json({
        ok: true,
        cursor: cursor ? {
          current_index: cursor.current_index,
          total_articles: cursor.total_articles,
          last_posted_slug: cursor.last_posted_slug,
          last_posted_at: cursor.last_posted_at,
          last_posted_uri: cursor.last_posted_uri,
        } : null,
        current_article: currentArticle,
        next_article: nextArticle,
        total_articles: HELP_ARTICLES.length,
      });
    }

    if (op === 'reset') {
      if (cursor) {
        await svc.entities.HelpPromoCursor.update(cursor.id, { current_index: 0 });
      } else {
        cursor = await svc.entities.HelpPromoCursor.create({
          current_index: 0,
          total_articles: HELP_ARTICLES.length,
        });
      }
      return Response.json({ ok: true, message: 'Cursor reset to 0', current_index: 0 });
    }

    if (op === 'skip') {
      const curIdx = cursor ? cursor.current_index : 0;
      const total = cursor ? cursor.total_articles : HELP_ARTICLES.length;
      const nextIdx = (curIdx + 1) % total;
      if (cursor) {
        await svc.entities.HelpPromoCursor.update(cursor.id, { current_index: nextIdx });
      } else {
        cursor = await svc.entities.HelpPromoCursor.create({
          current_index: nextIdx,
          total_articles: HELP_ARTICLES.length,
        });
      }
      return Response.json({ ok: true, message: `Skipped to index ${nextIdx}`, current_index: nextIdx });
    }

    // --- op === "post": publish the next help article ---

    // Ensure cursor exists with correct total
    if (!cursor) {
      cursor = await svc.entities.HelpPromoCursor.create({
        current_index: 0,
        total_articles: HELP_ARTICLES.length,
      });
    }
    // Sync total if the article list changed
    if (cursor.total_articles !== HELP_ARTICLES.length) {
      await svc.entities.HelpPromoCursor.update(cursor.id, { total_articles: HELP_ARTICLES.length });
      cursor.total_articles = HELP_ARTICLES.length;
    }

    const articleIndex = cursor.current_index % cursor.total_articles;
    const article = HELP_ARTICLES[articleIndex];
    if (!article) {
      return Response.json({ error: 'No article at index ' + articleIndex }, { status: 500 });
    }

    // Look up the promo account's consolidated PDS identity
    const promoUsers = await svc.entities.User
      .filter({ id: PROMO_USER_ID }, '-created_date', 1)
      .catch(() => []);
    const promoUser = promoUsers?.[0];
    const { getUserIdentity } = await import('../../shared/userIdentity.ts');
    const identity = promoUser ? await getUserIdentity(svc, promoUser) : null;
    if (!identity) {
      console.error('post-help-promo: no PDS identity found for promo account', PROMO_USER_ID);
      return Response.json({ error: 'Promo account PDS credential not found' }, { status: 500 });
    }
    const pdsUrl = identity.pdsUrl;
    if (!pdsUrl) {
      return Response.json({ error: 'PDS_URL not configured' }, { status: 500 });
    }

    // Authenticate to the PDS as the promo account
    let session;
    try {
      ({ session } = await getPdsSessionForUser(pdsUrl, identity.did, identity.appPassword));
    } catch (e) {
      console.error('post-help-promo: PDS session failed', e?.message || e);
      return Response.json({ error: 'PDS authentication failed' }, { status: 502 });
    }

    // Pick a random language for this post — the bot publishes in different
    // languages across runs. Links get a ?lang=LOCALE param so the site loads
    // in the same language when a user clicks through.
    const promoLocale: PromoLocale = pickPromoLocale();

    // Compose the message
    const { content, tags } = generateMessage(article, promoLocale.locale);

    // Upload the branded banner image
    const uploadResult = await uploadPromoImage(pdsUrl, session.accessJwt, PROMO_BANNER_URL, cred);
    const imageBlob = uploadResult.blob;
    session.accessJwt = uploadResult.accessJwt;
    // Guard: never publish a text-only promo post. If the image blob upload
    // failed, abort so the workflow retries on the next scheduled cycle
    // instead of publishing a bare-text promo.
    if (!imageBlob) {
      console.error('post-help-promo: image blob upload failed — aborting post to prevent plain-text promo');
      return Response.json({ error: 'Image upload failed — promo post aborted to prevent plain-text output' }, { status: 502 });
    }
    const altText = `SwapPulse help guide: ${article.title}`;
    const embed: any = {
      $type: 'app.bsky.embed.images',
      images: [{ alt: altText, image: imageBlob }],
    };

    // Create the post on the PDS
    const record: any = {
      $type: 'app.bsky.feed.post',
      text: content,
      createdAt: new Date().toISOString(),
      langs: [promoLocale.bcp47],
    };
    if (tags.length > 0) record.tags = tags;
    const facets = buildRichTextFacets(content);
    if (facets.length > 0) record.facets = facets;
    if (embed) record.embed = embed;

    let result: any = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.createRecord', {
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record,
    });

    // Retry once on auth failure
    if (result?.error && result.status === 401) {
      try {
        ({ session } = await getPdsSessionForUser(pdsUrl, identity.did, identity.appPassword));
        result = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.createRecord', {
          repo: session.did,
          collection: 'app.bsky.feed.post',
          record,
        });
      } catch (e) {
        console.error('post-help-promo: retry failed', e?.message || e);
      }
    }

    if (result?.error) {
      console.error('post-help-promo: createRecord failed', result.status, result.body);
      return Response.json({ error: `createRecord failed (${result.status})` }, { status: 502 });
    }

    // Track the promo post so firehose-ingest skips it
    await svc.entities.PromoPost.create({
      at_uri: result.uri,
      content,
      did: session.did,
      posted_at: new Date().toISOString(),
    }).catch((e: any) => console.error('post-help-promo: failed to track PromoPost', e?.message || e));

    // Advance the cursor
    const nextIndex = (articleIndex + 1) % cursor.total_articles;
    await svc.entities.HelpPromoCursor.update(cursor.id, {
      current_index: nextIndex,
      last_posted_slug: article.slug,
      last_posted_at: new Date().toISOString(),
      last_posted_uri: result.uri,
    });

    console.log('post-help-promo: published help article promo', article.slug, `(index ${articleIndex} → ${nextIndex}, lang: ${promoLocale.locale})`, result.uri);
    return Response.json({
      ok: true,
      uri: result.uri,
      cid: result.cid,
      article: { slug: article.slug, title: article.title, category: article.category },
      content,
      locale: promoLocale.locale,
      next_index: nextIndex,
      hasEmbed: !!embed,
    });
  } catch (error) {
    console.error('post-help-promo error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});