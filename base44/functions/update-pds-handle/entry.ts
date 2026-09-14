// Retired: handle changes must pass DNS proof and PDS acceptance in
// verifyHandleClaim before trusted local claim fields are updated.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  return Response.json({
    error: 'Use verifyHandleClaim to verify and update a custom handle.',
  }, { status: 410 });
}
