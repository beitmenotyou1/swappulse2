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

    const myDid = user.data?.did || '';
    if (!myDid) return Response.json({ error: 'Identity not provisioned yet.' }, { status: 409 });

    const memberDids = (pack.member_dids || []).filter((d) => d && d !== myDid);
    let followed = 0;
    let joined = 0;

    // Follow each member (skip existing).
    for (const subjectDid of memberDids) {
      const existing = await base44.entities.Follow.filter({ subject_did: subjectDid, did: myDid }, '-created_date', 1).catch(() => []);
      if (existing.length) continue;
      await base44.entities.Follow.create({
        subject_did: subjectDid,
        did: myDid,
      }).catch(() => {});
      followed++;
    }

    // Join each recommended circle by adding myDid to member_dids (skip if already a member).
    for (const circleId of (pack.circle_ids || [])) {
      const circle = await base44.asServiceRole.entities.Circle.get(circleId).catch(() => null);
      if (!circle) continue;
      const members = circle.member_dids || [];
      if (members.includes(myDid)) continue;
      await base44.asServiceRole.entities.Circle.update(circleId, {
        member_dids: [...members, myDid],
        member_count: (circle.member_count || members.length) + 1,
      }).catch(() => {});
      joined++;
    }

    return Response.json({ ok: true, followed, joined });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}