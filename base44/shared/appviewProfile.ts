// appviewProfile.ts — shared helpers for fetching and merging AT Protocol
// (Bluesky) profiles from the public AppView. Used by get-merged-profile so
// every profile view shows the freshest remote identity merged with local
// SwapPulse data. Remote wins for shared identity fields (display name, bio,
// avatar, banner); local-only fields (username, handle, verification, stats)
// are preserved. The merge is read-only — it never writes remote values back
// to the User entity (sync-profile-records remains the outbound path).

const APPVIEW = 'https://public.api.bsky.app';

// Resolve a handle (e.g. "alice.bsky.social") to a DID via the public AppView.
// Passes through DIDs unchanged. Returns null on failure.
export async function resolveHandleToDid(handle: string): Promise<string | null> {
  const clean = handle.trim().replace(/^@/, '');
  if (!clean) return null;
  if (clean.startsWith('did:')) return clean;
  try {
    const res = await fetch(
      `${APPVIEW}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(clean)}`,
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.did || null;
  } catch {
    return null;
  }
}

// Fetch the live app.bsky.actor.profile for a DID from the public AppView.
// Returns null on failure (caller falls back to local-only).
export async function fetchAppViewProfile(did: string): Promise<any | null> {
  if (!did) return null;
  try {
    const res = await fetch(
      `${APPVIEW}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Merge a local SwapPulse User record with a remote AT Protocol profile.
// For migrated users, local wins for shared identity fields (SwapPulse is the
// source of truth after migration; the AppView lags behind the PDS). For
// non-migrated users, remote wins (Bluesky is still authoritative). Local-only
// fields are always preserved. Either side may be null.
export function mergeProfiles(local: any | null, remote: any | null): any {
  const remoteName = remote?.displayName || '';
  const remoteDesc = remote?.description || '';
  const remoteAvatar = remote?.avatar || '';
  const remoteBanner = remote?.banner || '';
  const localName = local?.display_name || local?.full_name || '';
  const localDesc = local?.description || '';
  const localAvatar = local?.avatar || '';
  const localHeader = local?.header || '';
  const migrated = !!(local?.migrated_from_bluesky);

  // Migrated: local wins (SwapPulse is source of truth, AppView may lag).
  // Non-migrated: remote wins (Bluesky is still the authoritative profile).
  const name = migrated
    ? (localName || remoteName || local?.username || 'Collector')
    : (remoteName || localName || local?.username || 'Collector');
  const display_name = migrated
    ? (localName || remoteName || '')
    : (remoteName || localName || '');
  const description = migrated
    ? (localDesc || remoteDesc || '')
    : (remoteDesc || localDesc || '');
  const avatar = migrated
    ? (localAvatar || remoteAvatar || '')
    : (remoteAvatar || localAvatar || '');
  const header = migrated
    ? (localHeader || remoteBanner || '')
    : (remoteBanner || localHeader || '');

  return {
    found: !!(local || remote),
    did: local?.did || remote?.did || '',
    name,
    display_name,
    description,
    avatar,
    header,
    // Local-only identity fields — always from the SwapPulse record.
    bsky_handle: local?.bsky_handle || remote?.handle || '',
    username: local?.username || '',
    handle_verified: !!(local?.handle_verified),
    // Remote counts from Bluesky (0 when remote fetch failed).
    followers_count: remote?.followersCount || 0,
    follows_count: remote?.followsCount || 0,
    posts_count: remote?.postsCount || 0,
    // Source flags for the UI.
    is_member: !!local,
    remote_synced: !!remote,
    migrated_from_bluesky: migrated,
    fetched_at: new Date().toISOString(),
  };
}

// Fetch an actor's author feed (app.bsky.feed.getAuthorFeed) from the public
// AppView. Returns the raw feed entries on success, null on failure.
export async function fetchAuthorFeed(did: string, limit = 50): Promise<any[] | null> {
  if (!did) return null;
  try {
    const res = await fetch(
      `${APPVIEW}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(did)}&limit=${limit}`,
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.feed || null;
  } catch {
    return null;
  }
}