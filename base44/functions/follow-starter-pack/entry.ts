import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// One-tap onboarding: the current user follows every collector in a StarterPack
// and joins every recommended Circle. Idempotent — skips follows/circles that
// already exist. Used by the site-wide welcome card and the pack detail page.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const packId = String(body.packId || '').trim();
    if (!packId) return Response.json({ error: 'packId required' }, { status: 400 });

    const pack = await base44.asServiceRole.entities.StarterPack.get(packId).catch(() => null);
    if (!pack) return Response.json({ error: 'pack not found' }, { status: 404 });

    const myDid = user.did || '';
    if (!myDid) return Response.json({ error: 'Identity not provisioned yet.' }, { status: 409 });

    const memberDids = (pack.member_dids || []).filter((d) => d && d !== myDid);
    let followed = 0;
    let joined = 0;

    // Follow each member (skip existing).
    for (const subjectDid of memberDids) {
      const existing = await base44.entities.Follow.filter({ subject_did: subjectDid, did: myDid }, '-created_date', 1).catch(() => []);
      if (existing.length) continue;
      const created = await base44.entities.Follow.create({
        subject_did: subjectDid,
        did: myDid,
      }).catch(() => null);
      if (created) followed++;
    }

    // The same authenticated join command enforces Circle visibility and
    // membership rules for single joins and Starter Pack bulk joins.
    for (const circleId of new Set((pack.circle_ids || []).filter((id) => typeof id === 'string' && id))) {
      const circle = await base44.asServiceRole.entities.Circle.get(circleId).catch(() => null);
      if (!circle || (circle.member_dids || []).includes(myDid)) continue;
      const response = await base44.functions.invoke('circle-membership', {
        circle_id: circleId,
        action: 'join',
      }).catch(() => null);
      const data = response?.data ?? response;
      if (data?.ok && data.joined === true) joined++;
    }

    return Response.json({ ok: true, followed, joined });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}