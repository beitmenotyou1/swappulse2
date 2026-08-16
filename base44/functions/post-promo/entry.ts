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
// Written to sound like a real collector talking — conversational, personal,
// relatable — not corporate marketing copy. Links are always full https://
// URLs and hashtags are real, commonly-searched Pokémon TCG community tags.
const HOOKS = [
  "Just pulled the chase card I've been hunting for weeks \u{1F389}",
  "We've all been there \u2014 one card away from finishing a set and it's nowhere to be found.",
  "My binder was a mess of spreadsheets and phone notes until I found something better.",
  "Honestly? Trading online used to stress me out. Not anymore.",
  "Remember when social media actually felt like a community? Yeah, me too.",
  "I just scanned my entire deck box in like five minutes. Five minutes!",
  "Got my first vouch last week and it honestly felt better than a pull.",
  "Someone on the other side of the world just completed my set. Wild.",
  "Tired of algorithms deciding what I see. So I switched.",
  "My local card shop is great, but the community online? Next level.",
  "Finally found a place that treats collectors like people, not data points.",
  "Been logging every pull since January and the progress feels SO good.",
];

const VALUE_PROPS = [
  "SwapPulse is where collectors actually talk to each other \u2014 no ads, no algorithm, just people who love the hobby.",
  "It's built on the AT Protocol, so your posts show up on Bluesky too. Same account, bigger reach.",
  "Scan a card, add it to your collection, build a binder, find a trade \u2014 all in one place, all free.",
  "Every trader gets vouched for by the community, so you know who you're dealing with before you mail anything.",
  "No paywalls. No premium tiers. No selling your data. It's just collectors helping collectors.",
  "Your collection, your posts, your follows \u2014 they're yours. You can take them with you anytime.",
  "Challenges, meetups, pack parties \u2014 it's the card shop vibe, but online and global.",
  "The AI scanner nailed every card I threw at it, even the old base set ones.",
];

const CTAS = [
  "Come hang out with us: https://swappulse.org",
  "Make a free account and say hi: https://swappulse.org",
  "Start your collection here: https://swappulse.org",
  "See what we're building: https://swappulse.org",
  "Join the community: https://swappulse.org",
  "Bring your binder: https://swappulse.org",
];

// Real, commonly-searched Pokémon TCG community hashtags. These are tags
// collectors actually follow and search for on Bluesky and other platforms \u2014
// not invented brand tags. Capped at 4 per post to stay readable.
const HASHTAG_SETS = [
  "#PokemonTCG #PTCGO #PokemonCards #TCG",
  "#PokemonTCG #PullOfTheWeek #CardCollecting",
  "#PokemonTCG #PokemonCommunity #TCGTrading",
  "#PokemonTCG #ShinyHunting #PokemonCollection",
  "#PokemonTCG #PackOpening #PullOfTheWeek",
  "#PokemonTCG #TCGCommunity #CardCollector",
  "#PokemonTCG #PokemonCards #TradingCards",
  "#PokemonTCG #PTCGO #CardCollecting #PullOfTheWeek",
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