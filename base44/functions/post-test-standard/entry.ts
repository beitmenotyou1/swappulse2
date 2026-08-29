// post-test-standard — creates a test journal, publishes it as a
// site.standard.document on the PDS, and posts a link to it from the SwapPulse
// bot account on Bluesky. Admin-only, one-shot utility for verifying the
// Standard.site publishing pipeline end-to-end.
//
// Flow:
// 1. Ensure the SwapPulse site.standard.publication exists.
// 2. Create a test Journal entity (service role, bot account as author).
// 3. Ensure the bot account's per-author site.standard.publication.
// 4. Publish the journal as a site.standard.document on the PDS.
// 5. Update the Journal with the standard_doc_uri + standard_pub_uri.
// 6. Create an app.bsky.feed.post from the bot account linking to the journal.
// 7. Return the journal ID, URLs, and AT Protocol URIs for verification.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSession, pdsRequest, clearPdsSession } from '../../shared/pdsSession.ts';
import { ensureSitePublication, ensureAuthorPublication, publishDocument } from '../../shared/standardSite.ts';
import { uploadPromoImage } from '../../shared/promoImageUpload.ts';
import { buildPromoExternalEmbed, assertPromoPresentation } from '../../shared/promoPresentation.ts';
import { buildRichTextFacets } from '../../shared/hashtagFacets.ts';

const SITE_BASE = 'https://swappulse.org';
const PROMO_BANNER_URL = 'https://base44.app/api/apps/6a63d9d64a4d65d370c70892/files/mp/public/6a63d9d64a4d65d370c70892/2f59cf64f_swappulse-poster-promo.jpg';

const TEST_JOURNAL = {
  title: 'Chasing the Rainbow: My First Special Illustration Rare',
  subtitle: 'A collector journey through the Scarlet & Violet era and the pull that changed everything',
  body: `# The Hunt Begins

I have been collecting Pokemon TCG cards since I was a kid, but nothing quite compares to the thrill of pulling a Special Illustration Rare from a fresh booster pack.

## The Pull

It was a quiet Tuesday evening. I had just opened my third Scarlet & Violet pack of the night when I saw the familiar rainbow foil pattern peeking through the back of the card. My heart skipped a beat.

> The artwork on this card is genuinely something special. The detail, the composition, the way the light catches the foil — it is a masterclass in TCG art.

## What Makes It Special

Special Illustration Rares are not just rare; they are a celebration of the artists who bring these cards to life. Each one feels like a miniature painting you can hold in your hand.

## What's Next

Now I am on a mission to complete the entire Paldea Evolved set. 180 cards to go, but who is counting?

Follow my journey on SwapPulse — where collectors actually own their data.`,
  tags: ['PokemonTCG', 'PullOfTheWeek', 'ScarletViolet', 'CardCollecting'],
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    // 1. Ensure the SwapPulse site publication
    const sitePub = await ensureSitePublication(base44);

    // 2. Get the bot account session
    const { pdsUrl, session } = await getPdsSession();
    const botDid = session.did;

    // 3. Create the test Journal
    const journal = await svc.entities.Journal.create({
      ...TEST_JOURNAL,
      visibility: 'public',
      published_at: new Date().toISOString(),
      like_count: 0,
      author_name: 'SwapPulse',
      author_handle: 'swappulse.bsky.social',
      author_avatar: '',
      did: botDid,
    });

    // 4. Ensure the bot's per-author publication
    const authorPubUri = await ensureAuthorPublication(base44, {
      did: botDid,
      name: 'SwapPulse',
      handle: 'swappulse',
      avatar: '',
      profileUrl: `${SITE_BASE}/u/swappulse`,
    });

    // 5. Publish as a site.standard.document
    const docUri = await publishDocument(base44, {
      siteUri: sitePub.uri,
      authorPubUri,
      title: TEST_JOURNAL.title,
      path: `/journal/${journal.id}`,
      description: TEST_JOURNAL.subtitle,
      tags: TEST_JOURNAL.tags,
      textContent: TEST_JOURNAL.body,
      publishedAt: journal.published_at,
      authorName: 'SwapPulse',
      authorHandle: 'swappulse',
    });

    if (docUri) {
      await svc.entities.Journal.update(journal.id, {
        standard_doc_uri: docUri,
        standard_pub_uri: authorPubUri,
      }).catch((e: any) => console.error('post-test-standard: failed to update journal', e?.message || e));
    }

    // 6. Post to the bot account on Bluesky
    const journalUrl = `${SITE_BASE}/journal/${journal.id}`;
    const postText = `New journal post: "${TEST_JOURNAL.title}"\n\n${journalUrl}\n\n#PokemonTCG #PullOfTheWeek`;
    const facets = buildRichTextFacets(postText);
    const expectedTags = ['PokemonTCG', 'PullOfTheWeek'];

    const uploadResult = await uploadPromoImage(pdsUrl, session.accessJwt, PROMO_BANNER_URL, {
      did: botDid,
      app_password: String(Deno.env.get('PDS_APP_PASSWORD') || ''),
    });
    session.accessJwt = uploadResult.accessJwt;
    if (!uploadResult.blob) {
      return Response.json({
        error: 'Promo artwork unavailable; test-standard announcement was not published',
        code: 'PROMO_MEDIA_REQUIRED',
      }, { status: 502 });
    }

    const record: any = {
      $type: 'app.bsky.feed.post',
      text: postText,
      createdAt: new Date().toISOString(),
      langs: ['en'],
      tags: expectedTags,
      embed: buildPromoExternalEmbed(journalUrl, TEST_JOURNAL.title, TEST_JOURNAL.subtitle, uploadResult.blob),
    };
    if (facets.length > 0) record.facets = facets;
    assertPromoPresentation(record, journalUrl, expectedTags);

    let result: any = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.createRecord', {
      repo: botDid,
      collection: 'app.bsky.feed.post',
      record,
    });

    // Retry once on auth failure
    if (result?.error && result.status === 401) {
      try {
        clearPdsSession();
        const fresh = await getPdsSession();
        result = await pdsRequest(fresh.pdsUrl, fresh.session.accessJwt, 'com.atproto.repo.createRecord', {
          repo: fresh.session.did,
          collection: 'app.bsky.feed.post',
          record,
        });
      } catch (e: any) {
        console.error('post-test-standard: retry failed', e?.message || e);
      }
    }

    if (result?.error || !result?.uri) {
      console.error('post-test-standard: createRecord failed', result?.status, result?.body);
      return Response.json({
        error: `createRecord failed (${result?.status || 'unknown'})`,
        code: 'PROMO_POST_CREATE_FAILED',
      }, { status: 502 });
    }

    // Track as a PromoPost so firehose-ingest skips it
    if (result?.uri) {
      await svc.entities.PromoPost.create({
        at_uri: result.uri,
        content: postText,
        did: botDid,
        posted_at: new Date().toISOString(),
      }).catch((e: any) => console.error('post-test-standard: failed to track PromoPost', e?.message || e));
    }

    return Response.json({
      ok: true,
      journalId: journal.id,
      journalUrl,
      documentUri: docUri,
      publicationUri: authorPubUri,
      sitePublicationUri: sitePub.uri,
      postUri: result.uri,
      postText,
      hasEmbed: true,
      embedType: 'app.bsky.embed.external',
      blueskyUrl: `https://bsky.app/profile/${botDid}/post/${result.uri.split('/').pop()}`,
    });
  } catch (error) {
    console.error('post-test-standard error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});