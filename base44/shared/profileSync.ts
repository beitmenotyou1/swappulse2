// Shared profile sync helpers for AT Protocol bidirectional identity sync.
//
// OUTBOUND (SwapPulse → PDS): syncProfileForUser pushes the local profile
// (display name, avatar, bio, banner) to the PDS as a real app.bsky.actor.profile
// record (rkey 'self'). Before putRecord, it fetches the existing PDS record and
// merges SwapPulse-tracked fields into it — preserving the original createdAt
// and any untracked fields (labels, etc.) so nothing on the Bluesky side is
// lost. Used by sync-profile-records.
//
// INBOUND (PDS/AppView → SwapPulse): pullProfileFromAppView fetches the user's
// Bluesky profile (displayName, description, avatar, banner) from the AppView
// and returns the field updates to merge into the local User record. Used by
// migrate-to-swappulse on link so the initial sync pulls the Bluesky identity
// INTO SwapPulse. The ongoing inbound sync is handled by firehose-ingest's
// syncInboundProfiles, which recognizes Bluesky CDN URLs and avoids the
// avatar echo loop.

import { getPdsSessionForUser, pdsRequest } from './pdsSession.ts';

const PROFILE_COLLECTION = 'app.bsky.actor.profile';
const PROFILE_RKEY = 'self';

function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) : s;
}

// AT Protocol `datetime` lexicon format: ISO 8601 with seconds precision and
// a trailing Z. Base44's created_date stores microsecond precision which the
// PDS rejects as "Invalid datetime", so normalize to seconds precision.
function atProtoTimestamp(d?: string): string {
  let iso = d || new Date().toISOString();
  iso = iso.replace(/\.\d+Z?$/, 'Z');
  if (!iso.endsWith('Z')) iso += 'Z';
  return iso;
}

// SSRF protection: only allow https URLs to a strict hostname allowlist of
// public image CDNs for outbound fetch + re-upload. Combined with
// redirect:'manual' + 3xx rejection, this closes redirect and IP-encoding
// bypass paths that could reach internal/cloud-metadata endpoints.
const ALLOWED_IMAGE_HOSTS = new Set([
  'assets.tcgdex.net',        // TCGDex card artwork
  'media.base44.com',         // Base44 UploadFile CDN (primary)
  'media.base44static.com',   // Base44 uploaded / generated images (mirror)
  'static.wixstatic.com',     // Base44 static media mirror
]);

// Bluesky CDN hosts — these are the resolved blob URLs the AppView returns for
// avatars/banners. They are NOT in the outbound fetch allowlist (we never
// fetch+re-upload them — the blob is already PDS-resident). They ARE used by
// the inbound sync to recognize that a remote avatar URL is a Bluesky-resolved
// blob (not a user-initiated remote edit), so it doesn't overwrite the local
// Base44 CDN URL and create an echo loop.
export const BLUESKY_CDN_HOSTS = new Set([
  'cdn.bsky.app',
  'cdn.bsky.app/img',
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

// Check if a URL is a Bluesky CDN resolved blob URL (not a Base44 upload).
// Used by the inbound sync to avoid overwriting local Base44 CDN URLs with
// Bluesky CDN URLs, which would break the outbound sync echo loop.
export function isBlueskyCdnUrl(raw: string): boolean {
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return BLUESKY_CDN_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

// Extract the blob cid from a Bluesky CDN resolved URL. The AppView returns
// avatar/banner URLs in the format:
//   https://cdn.bsky.app/img/avatar/plain/{did}/{cid}@{format}
// The {cid} segment is the blob's content identifier, which we compare against
// the stored PDS blob ref to distinguish a genuine remote avatar change (new
// blob cid) from an echo of our own just-pushed blob (same cid).
export function extractBlobCidFromBskyUrl(raw: string): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const parts = parsed.pathname.split('/');
    const last = parts[parts.length - 1];
    const cid = last.split('@')[0];
    return cid || null;
  } catch {
    return null;
  }
}

// Get the cid from a PDS blob ref. Handles both { $type: 'blob', ref: { $link } }
// and { cid } shapes, and accepts either an object or a JSON string.
export function blobRefCid(ref: any): string | null {
  if (!ref) return null;
  try {
    const obj = typeof ref === 'string' ? JSON.parse(ref) : ref;
    return obj?.ref?.$link || obj?.cid || null;
  } catch {
    return null;
  }
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

// Fetch the existing app.bsky.actor.profile record from the PDS so we can
// merge SwapPulse-tracked fields into it without losing untracked fields
// (labels, custom fields, etc.) or overwriting the original createdAt.
async function fetchExistingProfile(
  pdsUrl: string,
  accessJwt: string,
  userDid: string,
): Promise<any | null> {
  try {
    const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.getRecord`);
    url.searchParams.set('repo', userDid);
    url.searchParams.set('collection', PROFILE_COLLECTION);
    url.searchParams.set('rkey', PROFILE_RKEY);
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessJwt}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.value || null;
  } catch {
    return null;
  }
}

export interface ProfileSyncResult {
  ok: boolean;
  changed?: boolean;
  uri?: string;
  cid?: string;
  error?: string;
  avatar_blob_ref?: any;
  header_blob_ref?: any;
}

export async function syncProfileForUser(
  svc: any,
  pdsUrl: string,
  userDid: string,
  appPassword: string,
  userRecord: { display_name?: string; full_name?: string; avatar?: string; header?: string; description?: string; created_date?: string; avatar_pds_ref?: string; header_pds_ref?: string; avatar_source_url?: string; header_source_url?: string },
): Promise<ProfileSyncResult> {
  let session: any;
  try {
    const s = await getPdsSessionForUser(pdsUrl, userDid, appPassword);
    session = s.session;
  } catch (e: any) {
    return { ok: false, error: `session: ${e?.message || e}` };
  }

  // Fetch the existing PDS record so we can merge into it, preserving
  // untracked fields and the original createdAt.
  const existing = await fetchExistingProfile(pdsUrl, session.accessJwt, userDid);

  // Start from the existing record (preserves createdAt, labels, etc.) or
  // build a fresh one if no profile exists yet.
  const record: any = existing
    ? { ...existing }
    : {
        $type: PROFILE_COLLECTION,
        createdAt: atProtoTimestamp(userRecord.created_date),
      };

  // Ensure $type is always set (existing record might omit it in some PDS
  // responses — putRecord requires it).
  record.$type = PROFILE_COLLECTION;

  // Track whether any tracked field actually changed vs the existing PDS
  // record. If nothing changed, we skip the putRecord and return changed=false
  // so the caller doesn't advance profile_synced_at — which would block the
  // inbound sync's AppView indexing grace period (10 min) on every 5-min
  // workflow run, preventing remote profile edits from ever merging.
  let changed = !existing; // creating a new profile counts as a change

  // Merge SwapPulse-tracked text fields (always overwrite with local truth).
  const displayName = truncate(userRecord.display_name || userRecord.full_name || '', 64);
  if (displayName !== (existing?.displayName || '')) changed = true;
  if (displayName) {
    record.displayName = displayName;
  } else if (existing) {
    // If local display name is empty but existing record has one, keep the
    // existing one rather than deleting it.
    if (!existing.displayName) delete record.displayName;
  }

  const description = userRecord.description || '';
  if (description !== (existing?.description || '')) changed = true;
  if (description) {
    record.description = truncate(description, 256);
  } else {
    // Explicitly set empty string so the PDS record reflects the local state.
    record.description = '';
  }

  // Avatar: only re-upload if the local URL is from an allowlisted CDN (a
  // new Base44 upload). If the local avatar is a Bluesky CDN URL (from a
  // previous inbound sync), skip re-upload — the blob is already PDS-resident
  // and the existing record's avatar blob ref is still valid.
  let avatarBlobRef: any = null;
  const localAvatar = userRecord.avatar || '';
  if (localAvatar && isAllowedImageUrl(localAvatar).ok) {
    // Base44 CDN URL. Skip the re-upload if the source URL hasn't changed
    // since the last sync (the blob is already on the PDS). This is the
    // critical fix: without it, every 5-min workflow run re-uploads the same
    // image, advances profile_synced_at, and blocks the inbound sync's
    // 10-min grace period so remote profile edits never merge.
    if (userRecord.avatar_source_url === localAvatar && userRecord.avatar_pds_ref) {
      try {
        const stored = JSON.parse(userRecord.avatar_pds_ref);
        if (stored) record.avatar = stored;
      } catch { /* parse failed — fall through to re-upload */ }
    }
    if (!record.avatar || !(userRecord.avatar_source_url === localAvatar && userRecord.avatar_pds_ref)) {
      avatarBlobRef = await uploadImageBlob(pdsUrl, session.accessJwt, localAvatar, 'avatar');
      if (avatarBlobRef) {
        record.avatar = avatarBlobRef;
        changed = true;
      }
    }
  } else if (localAvatar && isBlueskyCdnUrl(localAvatar)) {
    // Bluesky CDN URL — the blob is already on the PDS. If we have a stored
    // blob ref from a previous sync, use it. Otherwise, preserve the existing
    // record's avatar blob ref.
    if (userRecord.avatar_pds_ref) {
      try {
        const stored = JSON.parse(userRecord.avatar_pds_ref);
        if (stored) record.avatar = stored;
      } catch { /* ignore parse error, keep existing */ }
    } else if (record.avatar) {
      // First outbound after migration — no stored ref yet. Capture the
      // existing PDS blob ref so future inbound syncs can recognize the
      // avatar is PDS-resident and detect genuine remote changes by cid.
      avatarBlobRef = record.avatar;
    }
  } else if (!localAvatar && existing) {
    // Local avatar was cleared — remove it from the record.
    if (existing.avatar) changed = true;
    delete record.avatar;
  }

  // Banner: same logic as avatar.
  let headerBlobRef: any = null;
  const localHeader = userRecord.header || '';
  if (localHeader && isAllowedImageUrl(localHeader).ok) {
    // Skip re-upload if the source URL hasn't changed (same fix as avatar).
    if (userRecord.header_source_url === localHeader && userRecord.header_pds_ref) {
      try {
        const stored = JSON.parse(userRecord.header_pds_ref);
        if (stored) record.banner = stored;
      } catch { /* parse failed — fall through to re-upload */ }
    }
    if (!record.banner || !(userRecord.header_source_url === localHeader && userRecord.header_pds_ref)) {
      headerBlobRef = await uploadImageBlob(pdsUrl, session.accessJwt, localHeader, 'banner');
      if (headerBlobRef) {
        record.banner = headerBlobRef;
        changed = true;
      }
    }
  } else if (localHeader && isBlueskyCdnUrl(localHeader)) {
    if (userRecord.header_pds_ref) {
      try {
        const stored = JSON.parse(userRecord.header_pds_ref);
        if (stored) record.banner = stored;
      } catch { /* ignore parse error, keep existing */ }
    } else if (record.banner) {
      headerBlobRef = record.banner;
    }
  } else if (!localHeader && existing) {
    if (existing.banner) changed = true;
    delete record.banner;
  }

  // If nothing actually changed, skip the putRecord entirely. Still return
  // any captured blob refs so the caller can persist them. Not advancing
  // profile_synced_at is the key — it lets the inbound sync's grace period
  // expire so remote edits can merge.
  if (!changed) {
    return {
      ok: true,
      changed: false,
      avatar_blob_ref: avatarBlobRef,
      header_blob_ref: headerBlobRef,
    };
  }

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
    return {
      ok: true,
      changed: true,
      uri: res.uri,
      cid: res.cid,
      avatar_blob_ref: avatarBlobRef,
      header_blob_ref: headerBlobRef,
    };
  } catch (e: any) {
    return { ok: false, error: `putRecord: ${e?.message || e}` };
  }
}

// ─── Inbound profile pull (AppView → SwapPulse) ──────────────────────────
// Fetches the user's Bluesky profile (displayName, description, avatar, banner)
// from the public AppView and returns the field updates to merge into the local
// User record. Used by migrate-to-swappulse on link so the initial sync pulls
// the Bluesky identity INTO SwapPulse. The AppView returns resolved avatar/
// banner URLs (not blob refs), which is what the local User.avatar/header
// fields store.
const APPVIEW_BASE = 'https://public.api.bsky.app';

export async function pullProfileFromAppView(userDid: string): Promise<{ ok: boolean; updates: Record<string, any>; profile?: any }> {
  try {
    const url = new URL(`${APPVIEW_BASE}/xrpc/app.bsky.actor.getProfile`);
    url.searchParams.set('actor', userDid);
    const res = await fetch(url);
    if (res.status === 429 || res.status >= 500) {
      return { ok: false, updates: {} };
    }
    if (!res.ok) {
      console.error('pullProfileFromAppView: getProfile failed', res.status);
      return { ok: false, updates: {} };
    }
    const profile: any = await res.json();
    const updates: Record<string, any> = {};
    if (profile.displayName) updates.display_name = profile.displayName;
    if (profile.description !== undefined) updates.description = profile.description || '';
    if (profile.avatar) updates.avatar = profile.avatar;
    if (profile.banner) updates.header = profile.banner;
    return { ok: true, updates, profile };
  } catch (e: any) {
    console.error('pullProfileFromAppView error', e?.message || e);
    return { ok: false, updates: {} };
  }
}