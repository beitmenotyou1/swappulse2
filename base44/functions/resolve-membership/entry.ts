// resolve-membership — batch-resolves which DIDs belong to registered SwapPulse
// members. Given { dids: string[] }, returns { members: string[] } (the subset
// that has a local User record). Used by the MembershipProvider to annotate
// external authors with the ExternalIndicator without per-card profile fetches.
//
// Works unauthenticated (service role) so guest browsing shows indicators too,
// but verifies the caller's origin to prevent external abuse of the service
// role query.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ALLOWED_ORIGINS = new Set([
  'https://swappulse.org',
  'https://www.swappulse.org',
  'http://localhost:3000',
  'http://localhost:5173',
]);

const MAX_DIDS = 50;
const DID_RE = /^did:[a-z]+:[a-zA-Z0-9._:%-]+$/;

function isCallerAllowed(req: Request): boolean {
  const origin = req.headers.get('Origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) return true;
  const referer = req.headers.get('Referer');
  if (referer) {
    try {
      const r = new URL(referer);
      if (ALLOWED_ORIGINS.has(`${r.protocol}//${r.host}`)) return true;
    } catch {}
  }
  return false;
}

export default async function(req: Request): Promise<Response> {
  try {
    if (!isCallerAllowed(req)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const dids: string[] = Array.isArray(body.dids)
      ? Array.from(new Set(body.dids.map(String).filter(Boolean)))
      : [];
    if (!dids.length) {
      return Response.json({ members: [] });
    }
    if (dids.length > MAX_DIDS) {
      return Response.json({ error: 'Too many DIDs.' }, { status: 400 });
    }
    for (const did of dids) {
      if (!DID_RE.test(did)) {
        return Response.json({ error: 'Invalid DID format.' }, { status: 400 });
      }
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