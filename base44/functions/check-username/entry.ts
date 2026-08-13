import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const username = String(body.username || '').toLowerCase().trim().replace(/[^a-z0-9_]/g, '');

  if (!username || username.length < 3) {
    return Response.json({ available: false, reason: 'Username must be at least 3 characters' });
  }
  if (username.length > 30) {
    return Response.json({ available: false, reason: 'Username must be 30 characters or fewer' });
  }

  try {
    const existing = await base44.asServiceRole.entities.User.filter({ username });
    if (existing.length === 0) {
      return Response.json({ available: true, suggestions: [] });
    }

    // Generate suggestions
    const suggestions = [];
    const suffixes = [
      '_tcg',
      Math.floor(Math.random() * 100),
      Math.floor(Math.random() * 9999),
      '_' + ['collector', 'trainer', 'master', 'hunter'][Math.floor(Math.random() * 4)],
    ];
    for (const suffix of suffixes) {
      const candidate = `${username}${suffix}`.slice(0, 30);
      const taken = await base44.asServiceRole.entities.User.filter({ username: candidate });
      if (taken.length === 0 && !suggestions.includes(candidate)) suggestions.push(candidate);
      if (suggestions.length >= 3) break;
    }
    return Response.json({ available: false, reason: 'That username is taken', suggestions });
  } catch (e) {
    console.error('check-username error', e?.message || e);
    return Response.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}