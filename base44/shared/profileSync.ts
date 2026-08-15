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

// Fetch avatar bytes from the stored URL and upload as a blob to the user's
// PDS, returning the blob ref to embed in the profile record. Returns null if
// there is no avatar or the upload fails (non-fatal — profile syncs without
// avatar, preserving the existing one if any).
async function uploadAvatarBlob(
  pdsUrl: string,
  accessJwt: string,
  avatarUrl: string,
): Promise<any | null> {
  if (!avatarUrl) return null;
  try {
    const imgRes = await fetch(avatarUrl);
    if (!imgRes.ok) {
      console.error('profileSync: avatar fetch failed', imgRes.status);
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
    console.error('profileSync: avatar upload error', e?.message || e);
    return null;
  }
}

export async function syncProfileForUser(
  svc: any,
  pdsUrl: string,
  userDid: string,
  appPassword: string,
  userRecord: { full_name?: string; avatar?: string; description?: string; created_date?: string },
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
  const displayName = truncate(userRecord.full_name || '', 64);
  if (displayName) record.displayName = displayName;
  const description = truncate(userRecord.description || '', 256);
  if (description) record.description = description;

  const avatarBlob = await uploadAvatarBlob(pdsUrl, session.accessJwt, userRecord.avatar || '');
  if (avatarBlob) record.avatar = avatarBlob;

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