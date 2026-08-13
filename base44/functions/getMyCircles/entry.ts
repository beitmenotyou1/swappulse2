// §2.7 getMyCircles - returns the circles the current user curates or belongs
// to. Used by the Circles page ("Your circles") and the Trade Board to scope
// circle-scoped trade visibility.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch {
      return Response.json({ circles: [] }, { status: 200 });
    }
    if (!user) return Response.json({ circles: [] }, { status: 200 });
    const svc = base44.asServiceRole;

    const circles = await svc.entities.Circle.list('-created_date', 200);
    const mine = circles.filter(
      (c: any) => c.did === user.did || (c.member_dids || []).includes(user.did),
    );

    return Response.json({
      circles: mine.map((c: any) => ({
        id: c.id,
        name: c.name,
        at_uri: c.at_uri,
        member_count: c.member_count,
        visibility: c.visibility,
        theme: c.theme,
        did: c.did,
        isCurator: c.did === user.did,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});