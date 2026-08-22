// search-profiles — discover collectors by a shared profile detail. Powers
// the clickable location / interest / favourite-Pokémon / favourite-set chips
// on profiles that link to /discover/users?field=...&value=...
//
// ProfileConfig is owner-only via RLS, so the service role is used to read
// across all collectors. Array fields (interests, favourite_pokemon,
// favourite_sets) have no array-contains filter, so we scan the most-recent
// MAX_SCAN records and match in memory (case-insensitive); location is a
// scalar matched the same way. Display info (name / handle / avatar) is joined
// from the local User record.
//
// SECURITY: the caller is identified via base44.auth.me() (guest-safe — the
// app is public, so unauthenticated viewers are allowed but only see fields
// the owner marked public). Each owner's per-field visibility
// (public / followers / friends / private) is enforced: a collector only
// appears in results for a given field if that field is visible to the caller,
// and the returned bio / location are gated the same way. This prevents the
// service-role read from leaking follower/friend/private data to anonymous
// callers. Follower/friend relationships are resolved with a single batched
// lookup per relationship type (not per-config) so the scan stays performant.
//
// Input:  { field: 'location'|'interest'|'pokemon'|'set', value: string, limit?: number }
// Output: { field, value, results: [{ did, handle, displayName, avatar, bio, location }], total, scanned }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const FIELDS = new Set(['location', 'interest', 'pokemon', 'set']);
const MAX_SCAN = 500;
const DEFAULT_LIMIT = 48;
const RELATIONSHIP_CAP = 1000;

// Maps the search `field` param to the ProfileConfig key it searches.
const FIELD_TO_CONFIG_KEY = {
  location: 'location',
  interest: 'interests',
  pokemon: 'favourite_pokemon',
  set: 'favourite_sets',
};

// Default per-field visibility — mirrors get-profile-config so the two
// functions agree on what a guest/owner/follower/friend can see when no
// explicit field_visibility override is set.
const DEFAULT_FIELD_VISIBILITY: Record<string, string> = {
  bio: 'public',
  pronouns: 'public',
  interests: 'public',
  favourite_pokemon: 'public',
  favourite_sets: 'public',
  location: 'followers',
  website: 'public',
  social_links: 'public',
  contact_email: 'followers',
  milestones: 'public',
};

function norm(s: any): string {
  return String(s || '').trim().toLowerCase();
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({} as any));
    const field = String(body.field || '').trim();
    const value = String(body.value || '').trim();
    const limit = Math.min(Math.max(parseInt(body.limit, 10) || DEFAULT_LIMIT, 1), 100);

    if (!FIELDS.has(field)) {
      return Response.json({ error: 'Invalid field' }, { status: 400 });
    }
    if (!value) {
      return Response.json({ error: 'value required' }, { status: 400 });
    }

    // Identify the caller (guest-safe — public app, unauthenticated viewers are
    // allowed but only see public-visible fields). auth.me() throws when there
    // is no session, so swallow that.
    let viewerDid = '';
    try {
      const me = await base44.auth.me();
      if (me) viewerDid = me.did || '';
    } catch {
      /* guest viewer */
    }

    const svc = base44.asServiceRole;
    const configs = await svc.entities.ProfileConfig.list('-updated_date', MAX_SCAN).catch(() => []);

    // Resolve the viewer's relationships once (batched) so per-config visibility
    // checks are O(1) set lookups instead of per-config queries. Skipped for
    // guests (no viewerDid) — they only see 'public' fields.
    let followedDids: Set<string> = new Set();
    let friendDids: Set<string> = new Set();
    if (viewerDid) {
      try {
        const follows = await svc.entities.Follow.filter({ did: viewerDid }, '-created_date', RELATIONSHIP_CAP).catch(() => []);
        followedDids = new Set((follows || []).map((f: any) => f.subject_did).filter(Boolean));
      } catch { /* ignore — treat as no follows */ }
      try {
        const [mine, theirs] = await Promise.all([
          svc.entities.Friendship.filter({ did: viewerDid, status: 'accepted' }, '-created_date', RELATIONSHIP_CAP).catch(() => []),
          svc.entities.Friendship.filter({ friend_did: viewerDid, status: 'accepted' }, '-created_date', RELATIONSHIP_CAP).catch(() => []),
        ]);
        const mineSet = new Set((mine || []).map((f: any) => f.friend_did).filter(Boolean));
        friendDids = new Set((theirs || []).filter((f: any) => mineSet.has(f.did)).map((f: any) => f.did));
      } catch { /* ignore — treat as no friends */ }
    }

    // Whether the caller may see `key` on the given config. Owner always sees
    // their own; otherwise the per-field visibility decides, with follower /
    // friend membership checked against the batched sets.
    const visibilityFor = (cfg: any, key: string): boolean => {
      if (viewerDid && cfg.did === viewerDid) return true;
      const v = (cfg.field_visibility || {})[key] || DEFAULT_FIELD_VISIBILITY[key] || 'public';
      if (v === 'public') return true;
      if (v === 'followers') return followedDids.has(cfg.did);
      if (v === 'friends') return friendDids.has(cfg.did);
      return false; // private
    };

    const searchedKey = FIELD_TO_CONFIG_KEY[field];
    const target = norm(value);
    const matches: any[] = [];
    for (const cfg of configs) {
      if (!cfg) continue;
      // Only surface collectors whose searched field is visible to the caller.
      if (!visibilityFor(cfg, searchedKey)) continue;
      let hit = false;
      if (field === 'location') {
        hit = !!cfg.location && norm(cfg.location) === target;
      } else if (field === 'interest') {
        hit = (cfg.interests || []).some((v: any) => norm(v) === target);
      } else if (field === 'pokemon') {
        hit = (cfg.favourite_pokemon || []).some((v: any) => norm(v) === target);
      } else if (field === 'set') {
        hit = (cfg.favourite_sets || []).some((v: any) => norm(v) === target);
      }
      if (hit) matches.push(cfg);
    }

    const page = matches.slice(0, limit);

    const results = await Promise.all(
      page.map(async (cfg) => {
        let user: any = null;
        if (cfg.created_by_id) {
          user = await svc.entities.User.get(cfg.created_by_id).catch(() => null);
        }
        return {
          did: user?.did || cfg.did || '',
          handle: user?.handle || '',
          displayName: user?.display_name || user?.full_name || user?.handle || 'Collector',
          avatar: user?.avatar || '',
          // Only return bio/location when visible to the caller.
          bio: visibilityFor(cfg, 'bio') ? (cfg.bio || '') : '',
          location: visibilityFor(cfg, 'location') ? (cfg.location || '') : '',
        };
      })
    );

    return Response.json({
      field,
      value,
      results,
      total: matches.length,
      scanned: configs.length,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}