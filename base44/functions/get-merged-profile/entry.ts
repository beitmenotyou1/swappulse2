// get-merged-profile — returns a single merged profile object combining the
// local SwapPulse User record with the live AT Protocol (Bluesky) profile from
// the public AppView. For migrated users, local wins for shared identity
// fields (SwapPulse is the source of truth after migration; the AppView lags
// behind the PDS). For non-migrated users, remote wins (Bluesky is still
// authoritative). Local-only fields are preserved. The merge is read-only.
//
// Input:  { did?, handle? }  — at least one required. A handle is resolved to
//         a DID via the public AppView.
// Output: { found, did, name, display_name, description, avatar, header,
//           bsky_handle, username, handle_verified, followers_count,
//           follows_count, posts_count, is_member, remote_synced, fetched_at }
//
// Works unauthenticated (public profiles) — uses the service role for local
// User lookups so visitor profiles render for guests. Falls back to local-only
// if the AppView fetch fails, and remote-only if the actor isn't a SwapPulse
// member (federated search of external accounts).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveHandleToDid, fetchAppViewProfile, mergeProfiles } from '../../shared/appviewProfile.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const didInput = String(body.did || '').trim();
    const handleInput = String(body.handle || '').trim().replace(/^@/, '');
    if (!didInput && !handleInput) {
      return Response.json({ error: 'did or handle required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // 1. Resolve the target DID. A DID input is used directly; a handle is
    //    resolved via the public AppView.
    let did = didInput;
    if (!did && handleInput) {
      did = await resolveHandleToDid(handleInput) || '';
    }
    if (!did) {
      return Response.json({ found: false, error: 'Could not resolve handle' });
    }

    // 2. Fetch the local User record first. For migrated members, the local
    //    record is authoritative (kept in sync via direct PDS reads by
    //    firehose-ingest) — skip the eventually-consistent AppView fetch
    //    entirely so there's zero indexing lag on description/displayName/
    //    avatar/header. For non-members (no local record), fetch the AppView
    //    for remote identity and counts.
    const localUsers = await svc.entities.User.filter({ did }, '-created_date', 1).catch(() => []);
    const local = localUsers?.[0] || null;
    const isMigratedMember = !!(local?.migrated_from_bluesky);
    const remote = isMigratedMember ? null : await fetchAppViewProfile(did);

    // 3. Merge and return. If both are null the actor doesn't exist anywhere.
    const merged = mergeProfiles(local, remote);
    if (!merged.found) {
      return Response.json({ found: false });
    }
    return Response.json(merged);
  } catch (error: any) {
    console.error('get-merged-profile error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}