// Shared helper that syncs a user's local profile (display name, avatar, bio)
// to their AT Protocol PDS repo as a real app.bsky.actor.profile record
// (rkey 'self'), so the profile is resolvable from Bluesky and other AT
// Protocol apps instead of appearing as a blank account.
//
// Used by sync-profile-records (admin backfill + single-user edit sync) so
// both share one implementation. The avatar is fetched from its stored URL and
// re-uploaded as a PDS blob on the user's own repo, then embedded as a blob
// ref (app.bsky.actor.profile.avatar requires a blob ref, not a raw URL).

import { getPdsSessionForUser, pdsRequest } from './pdsSession.ts';

const PROFILE_COLLECTION = 'app.bsky.actor.profile';
const PROFILE_RKEY = 'self';

function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) : s;
}

// AT Protocol `datetime` lexicon format: ISO 8601 with seconds precision and
// a trailing Z. Base44's created_date stores microsecond precision
// (e.g. 2026-07-25T02:42:41.824000Z) which the PDS rejects as "Invalid
// datetime", so normalize any input to seconds precision.
function atProtoTimestamp(d?: string): string {
  let iso = d || new Date().toISOString();
  iso = iso.replace(/\.\d+Z?$/, 'Z');
  if (!iso.endsWith('Z')) iso += 'Z';
  return iso;
}

// SSRF protection: only allow https URLs to a strict hostname allowlist of
// public image CDNs. A denylist is bypassable via decimal/hex/octal IP
// encodings (e.g. 2130706433 -> 127.0.0.1) and IPv6-mapped IPv4
// (::ffff:127.0.0.1), so only known public hosts are permitted. Combined
// with redirect:'manual' + 3xx rejection below, this closes redirect and
// IP-encoding bypass paths that could reach internal/cloud-metadata endpoints.
const ALLOWED_IMAGE_HOSTS = new Set([
  'assets.tcgdex.net',        // TCGDex card artwork
  'media.base44static.com',   // Base44 uploaded / generated images
  'static.wixstatic.com',     // Base44 static media mirror
]);

function isAllowedImageUrl(raw: string): { ok: boolean; url?: URL; reason?: string } {
  if (!raw) return { ok: false, reason: 'empty' };
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'must use HTTPS' };
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_IMAGE_HOSTS.has(hostname)) {
    return { ok: false, reason: 'hostname not allowed' };
  }
  return { ok: true, url: parsed };
}

// Fetch image bytes from a stored URL and upload as a blob to the user's PDS,
// returning the blob ref to embed in the profile record. Used for both avatar
// and banner. Returns null if there is no image, the URL is not allowlisted,
// or the upload fails (non-fatal — profile syncs without the image, preserving
// the existing one if any).
async function uploadImageBlob(
  pdsUrl: string,
  accessJwt: string,
  imageUrl: string,
  label = 'image',
): Promise<any | null> {
  if (!imageUrl) return null;
  const check = isAllowedImageUrl(imageUrl);
  if (!check.ok) {
    console.error(`profileSync: ${label} blocked (${check.reason})`, imageUrl);
    return null;
  }
  try {
    // SSRF: fetch with redirect:'manual' and reject any 3xx, so an
    // allowlisted public URL can't 302 to an internal or cloud-metadata
    // endpoint.
    const imgRes = await fetch(imageUrl, { redirect: 'manual' });
    if (imgRes.status >= 300 && imgRes.status < 400) {
      console.error(`profileSync: ${label} fetch redirected (blocked)`, imgRes.status, imageUrl);
      return null;
    }
    if (!imgRes.ok) {
      console.error(`profileSync: ${label} fetch failed`, imgRes.status);
      return null;
    }
    const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const upRes = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`, {
      method: 'POST',
      headers: { 'Content-Type': mimeType, 'Authorization': `Bearer ${accessJwt}` },
      body: bytes,
    });
    if (!upRes.ok) {
      const t = await upRes.text();
      console.error('profileSync: uploadBlob failed', upRes.status, t.slice(0, 200));
      return null;
    }
    const data = await upRes.json();
    return data.blob || null;
  } catch (e) {
    console.error(`profileSync: ${label} upload error`, e?.message || e);
    return null;
  }
}

export async function syncProfileForUser(
  svc: any,
  pdsUrl: string,
  userDid: string,
  appPassword: string,
  userRecord: { display_name?: string; full_name?: string; avatar?: string; header?: string; description?: string; created_date?: string },
): Promise<{ ok: boolean; uri?: string; cid?: string; error?: string }> {
  let session: any;
  try {
    const s = await getPdsSessionForUser(pdsUrl, userDid, appPassword);
    session = s.session;
  } catch (e: any) {
    return { ok: false, error: `session: ${e?.message || e}` };
  }

  const record: any = {
    $type: PROFILE_COLLECTION,
    createdAt: atProtoTimestamp(userRecord.created_date),
  };
  const displayName = truncate(userRecord.display_name || userRecord.full_name || '', 64);
  if (displayName) record.displayName = displayName;
  const description = truncate(userRecord.description || '', 256);
  if (description) record.description = description;

  const avatarBlob = await uploadImageBlob(pdsUrl, session.accessJwt, userRecord.avatar || '', 'avatar');
  if (avatarBlob) record.avatar = avatarBlob;
  const bannerBlob = await uploadImageBlob(pdsUrl, session.accessJwt, userRecord.header || '', 'banner');
  if (bannerBlob) record.banner = bannerBlob;

  try {
    const res = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.putRecord', {
      repo: userDid,
      collection: PROFILE_COLLECTION,
      rkey: PROFILE_RKEY,
      record,
    });
    if (res?.error) {
      console.error('profileSync: putRecord failed', res.status, JSON.stringify(res.body || {}).slice(0, 200));
      return { ok: false, error: `putRecord failed (${res.status})` };
    }
    return { ok: true, uri: res.uri, cid: res.cid };
  } catch (e: any) {
    return { ok: false, error: `putRecord: ${e?.message || e}` };
  }
}