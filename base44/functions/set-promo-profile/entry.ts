// set-promo-profile — sets the SwapPulse promo bot account's AT Protocol
// profile (app.bsky.actor.profile) with a branded avatar and banner so the
// account has proper branding on Bluesky and across the ATmosphere.
//
// Uploads the avatar and banner images to the PDS as blobs
// (com.atproto.repo.uploadBlob), then puts the app.bsky.actor.profile record
// (com.atproto.repo.putRecord, rkey "self") with displayName, description,
// avatar blob ref, and banner blob ref.
//
// Admin-only. Run once after provisioning the promo account, or re-run to
// refresh the branding. Accepts optional avatarUrl / bannerUrl / displayName /
// description overrides in the request body.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSessionForUser, pdsRequest } from '../../shared/pdsSession.ts';
import { uploadPromoImage } from '../../shared/promoImageUpload.ts';

const PROMO_USER_ID = '6a6422a1b8cda8ece8138c87';

const DEFAULT_AVATAR_URL = 'https://media.base44.com/images/public/6a63d9d64a4d65d370c70892/ac9fe4c0c_generated_image.png';
const DEFAULT_BANNER_URL = 'https://media.base44.com/images/public/6a63d9d64a4d65d370c70892/a22b46eb2_generated_image.png';
const DEFAULT_DISPLAY_NAME = 'SwapPulse';
const DEFAULT_DESCRIPTION = 'The decentralized social network for Pokémon TCG collectors. Free, open-source, built on the AT Protocol. 🎴';

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
    const avatarUrl = body.avatarUrl || DEFAULT_AVATAR_URL;
    const bannerUrl = body.bannerUrl || DEFAULT_BANNER_URL;
    const displayName = body.displayName || DEFAULT_DISPLAY_NAME;
    const description = body.description || DEFAULT_DESCRIPTION;

    // Look up the promo account's consolidated PDS identity
    const promoUsers = await svc.entities.User
      .filter({ id: PROMO_USER_ID }, '-created_date', 1)
      .catch(() => []);
    const promoUser = promoUsers?.[0];
    const { getUserIdentity } = await import('../../shared/userIdentity.ts');
    const identity = promoUser ? await getUserIdentity(svc, promoUser) : null;
    if (!identity) {
      console.error('set-promo-profile: no PDS identity found for promo account', PROMO_USER_ID);
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
      console.error('set-promo-profile: PDS session failed', e?.message || e);
      return Response.json({ error: 'PDS authentication failed' }, { status: 502 });
    }

    const cred = { did: identity.did, app_password: identity.appPassword };

    // Upload avatar and banner as blobs
    const avatarUpload = await uploadPromoImage(pdsUrl, session.accessJwt, avatarUrl, cred);
    session.accessJwt = avatarUpload.accessJwt;
    if (!avatarUpload.blob) {
      console.error('set-promo-profile: avatar blob upload failed');
      return Response.json({ error: 'Avatar upload failed' }, { status: 502 });
    }

    const bannerUpload = await uploadPromoImage(pdsUrl, session.accessJwt, bannerUrl, cred);
    session.accessJwt = bannerUpload.accessJwt;
    if (!bannerUpload.blob) {
      console.error('set-promo-profile: banner blob upload failed');
      return Response.json({ error: 'Banner upload failed' }, { status: 502 });
    }

    // Put the app.bsky.actor.profile record (rkey "self" — the singleton profile)
    const record: any = {
      $type: 'app.bsky.actor.profile',
      displayName,
      description,
      avatar: avatarUpload.blob,
      banner: bannerUpload.blob,
    };

    let result: any = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.putRecord', {
      repo: session.did,
      collection: 'app.bsky.actor.profile',
      rkey: 'self',
      record,
    });

    // Retry once on auth failure
    if (result?.error && result.status === 401) {
      try {
        ({ session } = await getPdsSessionForUser(pdsUrl, identity.did, identity.appPassword));
        result = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.putRecord', {
          repo: session.did,
          collection: 'app.bsky.actor.profile',
          rkey: 'self',
          record,
        });
      } catch (e) {
        console.error('set-promo-profile: retry failed', e?.message || e);
      }
    }

    if (result?.error) {
      console.error('set-promo-profile: putRecord failed', result.status, result.body);
      return Response.json({ error: `putRecord failed (${result.status})` }, { status: 502 });
    }

    console.log('set-promo-profile: profile updated', result.uri);
    return Response.json({
      ok: true,
      uri: result.uri,
      cid: result.cid,
      did: session.did,
      displayName,
      avatarCid: avatarUpload.blob.ref.$link,
      bannerCid: bannerUpload.blob.ref.$link,
    });
  } catch (error) {
    console.error('set-promo-profile error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});