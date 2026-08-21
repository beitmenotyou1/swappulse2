// mark-promo-bot — marks the SwapPulse promo account as a bot across the AT
// Protocol by applying a self-label to its app.bsky.actor.profile record.
//
// The promo account (Base44 user 6a6422a1b8cda8ece8138c87) posts automated
// promotional content every 4 hours via the post-promo function. Marking it
// as a bot makes this transparent to Bluesky and other federated clients —
// they'll see the 'bot' self-label on the profile and can display it
// accordingly.
//
// This is a one-time operation: run it once and the label persists on the
// profile record until manually removed. Re-running is safe (idempotent —
// it just re-applies the same label).
//
// Authentication uses the promo account's stored PdsCredential (the same
// credential post-promo uses), so the label is self-applied by the account
// owner — the standard AT Protocol self-labeling mechanism
// (com.atproto.label.defs#selfLabels).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSessionForUser } from '../../shared/pdsSession.ts';

const PROMO_USER_ID = '6a6422a1b8cda8ece8138c87';
const PROFILE_COLLECTION = 'app.bsky.actor.profile';
const PROFILE_RKEY = 'self';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    // Look up the promo account's consolidated PDS identity
    const promoUsers = await svc.entities.User
      .filter({ id: PROMO_USER_ID }, '-created_date', 1)
      .catch(() => []);
    const promoUser = promoUsers?.[0];
    const { getUserIdentity } = await import('../../shared/userIdentity.ts');
    const identity = promoUser ? await getUserIdentity(svc, promoUser) : null;
    if (!identity) {
      console.error('mark-promo-bot: no PDS identity found for promo account', PROMO_USER_ID);
      return Response.json({ error: 'Promo account PDS credential not found' }, { status: 500 });
    }
    const pdsUrl = identity.pdsUrl;
    if (!pdsUrl) {
      console.error('mark-promo-bot: PDS_URL not configured');
      return Response.json({ error: 'PDS_URL not configured' }, { status: 500 });
    }

    // Authenticate to the PDS as the promo account
    let session;
    try {
      ({ session } = await getPdsSessionForUser(pdsUrl, identity.did, identity.appPassword));
    } catch (e) {
      console.error('mark-promo-bot: PDS session failed', e?.message || e);
      return Response.json({ error: 'PDS authentication failed' }, { status: 502 });
    }

    console.log('mark-promo-bot: authenticated as', session.did);

    // Fetch the existing profile record to preserve displayName/description/avatar/banner
    const getRes = await fetch(
      `${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(session.did)}&collection=${PROFILE_COLLECTION}&rkey=${PROFILE_RKEY}`,
      { headers: { 'Authorization': `Bearer ${session.accessJwt}` } },
    );

    let existingRecord: any = null;
    if (getRes.ok) {
      const data = await getRes.json();
      existingRecord = data.value || data.record || null;
      console.log('mark-promo-bot: fetched existing profile record');
    } else if (getRes.status === 404) {
      console.log('mark-promo-bot: no existing profile record, creating new one');
    } else {
      const errText = await getRes.text().catch(() => '');
      console.error('mark-promo-bot: getRecord failed', getRes.status, errText.slice(0, 300));
      return Response.json({ error: `getRecord failed (${getRes.status})` }, { status: 502 });
    }

    // Build the updated profile record, preserving existing fields, fixing the
    // display-name typo, and setting a bot-appropriate description.
    const record: any = {
      ...(existingRecord || {}),
      $type: PROFILE_COLLECTION,
    };
    record.displayName = 'SwapPulse';
    record.description =
      'SwapPulse is the decentralised social network for Pokémon TCG collectors. ' +
      'Scan cards, track your collection, find trades & build community. ' +
      'Free & open-source. In alpha. https://swappulse.org';
    // Replace any existing labels with the bot self-label
    record.labels = {
      $type: 'com.atproto.label.defs#selfLabels',
      values: [{ val: 'bot' }],
    };
    // Ensure createdAt is set (required for new profiles; existing ones keep theirs)
    if (!record.createdAt) {
      record.createdAt = new Date().toISOString();
    }

    // Put the updated profile record back via putRecord
    const putRes = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.putRecord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: PROFILE_COLLECTION,
        rkey: PROFILE_RKEY,
        record,
      }),
    });

    if (!putRes.ok) {
      const text = await putRes.text().catch(() => '');
      console.error('mark-promo-bot: putRecord failed', putRes.status, text.slice(0, 500));
      return Response.json({ error: `putRecord failed (${putRes.status})` }, { status: 502 });
    }

    const result = await putRes.json();
    console.log('mark-promo-bot: profile updated with bot self-label', result.uri);

    return Response.json({
      ok: true,
      uri: result.uri,
      cid: result.cid,
      did: session.did,
      message: 'Promo account marked as bot across the AT Protocol',
    });
  } catch (error) {
    console.error('mark-promo-bot error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});