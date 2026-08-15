// resolve-membership — batch-resolves which DIDs belong to registered SwapPulse
// members. Given { dids: string[] }, returns { members: string[] } (the subset
// that has a local User record). Used by the MembershipProvider to annotate
// external authors with the ExternalIndicator without per-card profile fetches.
//
// Works unauthenticated (service role) so guest browsing shows indicators too.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const dids: string[] = Array.isArray(body.dids)
      ? Array.from(new Set(body.dids.map(String).filter(Boolean)))
      : [];
    if (!dids.length) {
      return Response.json({ members: [] });
    }
    const svc = base44.asServiceRole;
    const memberSet = new Set<string>();
    await Promise.all(
      dids.map(async (did) => {
        const users = await svc.entities.User.filter({ did }, '-created_date', 1).catch(() => []);
        if (users && users.length) memberSet.add(did);
      }),
    );
    return Response.json({ members: Array.from(memberSet) });
  } catch (error: any) {
    console.error('resolve-membership error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}