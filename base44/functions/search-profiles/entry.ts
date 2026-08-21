// search-profiles — discover collectors by a shared profile detail. Powers
// the clickable location / interest / favourite-Pokémon / favourite-set chips
// on profiles that link to /discover/users?field=...&value=...
//
// ProfileConfig is owner-only via RLS, so the service role is used to read
// across all collectors. Array fields (interests, favourite_pokemon,
// favourite_sets) have no array-contains filter, so we scan the most-recent
// MAX_SCAN records and match in memory (case-insensitive); location is a
// scalar matched the same way. Display info (name / handle / avatar) is joined
// from the local User record, which stores identity fields persisted via
// base44.auth.updateMe.
//
// Input:  { field: 'location'|'interest'|'pokemon'|'set', value: string, limit?: number }
// Output: { field, value, results: [{ did, handle, displayName, avatar, bio, location }], total, scanned }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const FIELDS = new Set(['location', 'interest', 'pokemon', 'set']);
const MAX_SCAN = 500;
const DEFAULT_LIMIT = 48;

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const field = String(body.field || '').trim();
    const value = String(body.value || '').trim();
    const limit = Math.min(Math.max(parseInt(body.limit, 10) || DEFAULT_LIMIT, 1), 100);

    if (!FIELDS.has(field)) {
      return Response.json({ error: 'Invalid field' }, { status: 400 });
    }
    if (!value) {
      return Response.json({ error: 'value required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const configs = await svc.entities.ProfileConfig.list('-updated_date', MAX_SCAN).catch(() => []);

    const target = norm(value);
    const matches = [];
    for (const cfg of configs) {
      if (!cfg) continue;
      let hit = false;
      if (field === 'location') {
        hit = !!cfg.location && norm(cfg.location) === target;
      } else if (field === 'interest') {
        hit = (cfg.interests || []).some((v) => norm(v) === target);
      } else if (field === 'pokemon') {
        hit = (cfg.favourite_pokemon || []).some((v) => norm(v) === target);
      } else if (field === 'set') {
        hit = (cfg.favourite_sets || []).some((v) => norm(v) === target);
      }
      if (hit) matches.push(cfg);
    }

    const page = matches.slice(0, limit);

    const results = await Promise.all(
      page.map(async (cfg) => {
        let user = null;
        if (cfg.created_by_id) {
          user = await svc.entities.User.get(cfg.created_by_id).catch(() => null);
        }
        return {
          did: user?.did || cfg.did || '',
          handle: user?.handle || '',
          displayName: user?.display_name || user?.full_name || user?.handle || 'Collector',
          avatar: user?.avatar || '',
          bio: cfg.bio || '',
          location: cfg.location || '',
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
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}