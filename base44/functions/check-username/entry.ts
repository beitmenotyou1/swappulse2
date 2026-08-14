import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { checkBlocklist } from '../../shared/enforcement.ts';

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const username = String(body.username || '').toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
  const email = String(body.email || '').toLowerCase().trim();

  // Check email against re-registration blocklist (registration flow)
  if (email) {
    const emailBlocked = await checkBlocklist(base44.asServiceRole, email, '');
    if (emailBlocked) return Response.json({ available: false, reason: 'This email address is not available.' });
  }

  if (!username || username.length < 3) {
    if (email) return Response.json({ available: true });
    return Response.json({ available: false, reason: 'Username must be at least 3 characters' });
  }
  if (username.length > 30) {
    return Response.json({ available: false, reason: 'Username must be 30 characters or fewer' });
  }

  // Check username against re-registration blocklist
  const handleBlocked = await checkBlocklist(base44.asServiceRole, '', username);
  if (handleBlocked) return Response.json({ available: false, reason: 'This username is not available.' });

  try {
    const existing = await base44.asServiceRole.entities.User.filter({ username });
    if (existing.length === 0) {
      return Response.json({ available: true, suggestions: [] });
    }

    // Generate suggestions and batch-check availability in one query.
    const suffixes = [
      '_tcg',
      Math.floor(Math.random() * 100),
      Math.floor(Math.random() * 9999),
      '_' + ['collector', 'trainer', 'master', 'hunter'][Math.floor(Math.random() * 4)],
    ];
    const candidates = suffixes
      .map((s) => `${username}${s}`.slice(0, 30))
      .filter((c, i, arr) => arr.indexOf(c) === i); // dedupe
    const taken = candidates.length > 0
      ? await base44.asServiceRole.entities.User.filter({ username: { $in: candidates } })
      : [];
    const takenSet = new Set(taken.map((u) => u.username));
    const suggestions = candidates.filter((c) => !takenSet.has(c)).slice(0, 3);
    return Response.json({ available: false, reason: 'That username is taken', suggestions });
  } catch (e) {
    console.error('check-username error', e?.message || e);
    return Response.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}