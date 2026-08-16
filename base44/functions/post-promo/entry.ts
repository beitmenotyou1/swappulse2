// post-promo — publishes a varied promotional post to the AT Protocol from the
// designated SwapPulse promo account. The post is created directly on the PDS
// (via the account's stored PdsCredential) and tracked in the PromoPost entity
// so firehose-ingest skips it — the post appears on Bluesky but never on the
// SwapPulse local feed.
//
// Message variation: each call composes a unique message from pools of hooks,
// value propositions, calls to action, and hashtag sets — hundreds of
// combinations, all adhering to SwapPulse's core premise (decentralized social
// network for Pokémon TCG collectors, built on the AT Protocol, free and
// open-source).
//
// Invoked by the "Promo Poster" workflow every 4 hours.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSessionForUser, pdsRequest } from '../../shared/pdsSession.ts';

const PROMO_USER_ID = '6a6422a1b8cda8ece8138c87';

// --- Message fragment pools (composed randomly each run) ---
const HOOKS = [
  "Just pulled a rare? Show it off on SwapPulse! \u{1F389}",
  "Hunting that one card to finish a set? We feel you.",
  "Your collection deserves more than a spreadsheet.",
  "Trade Pok\u00E9mon TCG cards with collectors worldwide.",
  "Built on the AT Protocol \u2014 your collection, your data.",
  "Free, open-source, and made by collectors, for collectors.",
  "Every card has a story. What's yours?",
  "From pack pulls to set completion \u2014 track it all.",
  "Tired of walled gardens? SwapPulse is federated and free.",
  "Scan, bind, trade, and share \u2014 all in one place.",
];

const VALUE_PROPS = [
  "Track collections, log pulls, and trade with verified collectors.",
  "Federated with Bluesky \u2014 your posts reach the whole network.",
  "No paywalls, no ads. Just collectors helping collectors.",
  "AI card scanner, digital binders, challenges, and meetups.",
  "Trade safely with our vouch-based trust graph.",
  "Your posts, follows, and likes federate across the AT Protocol.",
  "Build your collector profile and earn community achievements.",
];

const CTAS = [
  "Join free: swappulse.org",
  "Create your account: swappulse.org",
  "Start collecting: swappulse.org",
  "Discover SwapPulse: swappulse.org",
];

const HASHTAG_SETS = [
  "#PokemonTCG #SwapPulse",
  "#PokemonCollection #SwapPulse",
  "#TCGTrading #SwapPulse",
  "#CardCollecting #SwapPulse",
  "#PokemonTCG #SwapPulse #ATProtocol",
  "#PokemonCards #SwapPulse",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMessage(): string {
  return `${pick(HOOKS)}\n\n${pick(VALUE_PROPS)}\n\n${pick(CTAS)}\n\n${pick(HASHTAG_SETS)}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    // Look up the PDS credential for the promo account
    const creds = await svc.entities.PdsCredential
      .filter({ user_id: PROMO_USER_ID }, '-created_date', 1)
      .catch(() => []);
    if (!creds || creds.length === 0 || !creds[0].app_password) {
      console.error('post-promo: no PdsCredential found for promo account', PROMO_USER_ID);
      return Response.json({ error: 'Promo account PDS credential not found' }, { status: 500 });
    }
    const cred = creds[0];
    const pdsUrl = cred.pds_url || Deno.env.get('PDS_URL');
    if (!pdsUrl) {
      console.error('post-promo: PDS_URL not configured');
      return Response.json({ error: 'PDS_URL not configured' }, { status: 500 });
    }

    // Authenticate to the PDS as the promo account
    let session;
    try {
      ({ session } = await getPdsSessionForUser(pdsUrl, cred.did, cred.app_password));
    } catch (e) {
      console.error('post-promo: PDS session failed', e?.message || e);
      return Response.json({ error: 'PDS authentication failed' }, { status: 502 });
    }

    // Generate a varied promotional message
    const content = generateMessage();

    // Create the post directly on the PDS (no local Post record)
    const record = {
      $type: 'app.bsky.feed.post',
      text: content,
      createdAt: new Date().toISOString(),
      langs: ['en'],
    };

    let result: any = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.createRecord', {
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record,
    });

    // Retry once on auth failure (session may have expired)
    if (result?.error && result.status === 401) {
      try {
        ({ session } = await getPdsSessionForUser(pdsUrl, cred.did, cred.app_password));
        result = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.createRecord', {
          repo: session.did,
          collection: 'app.bsky.feed.post',
          record,
        });
      } catch (e) {
        console.error('post-promo: retry failed', e?.message || e);
      }
    }

    if (result?.error) {
      console.error('post-promo: createRecord failed', result.status, result.body);
      return Response.json({ error: `createRecord failed (${result.status})` }, { status: 502 });
    }

    // Track the promo post so firehose-ingest skips it
    await svc.entities.PromoPost.create({
      at_uri: result.uri,
      content,
      did: session.did,
      posted_at: new Date().toISOString(),
    }).catch((e: any) => console.error('post-promo: failed to track PromoPost', e?.message || e));

    console.log('post-promo: published promo post', result.uri);
    return Response.json({ ok: true, uri: result.uri, cid: result.cid, content });
  } catch (error) {
    console.error('post-promo error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});