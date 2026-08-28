// autonomous-moderation — DEPRECATED / QUARANTINED legacy escrow resolver.
//
// Escrow is not part of the current SwapPulse V1 architecture. This endpoint
// is retained only as a tombstone for old callers. It performs no escrow,
// refund, release, payment, or moderation mutation. There is deliberately no
// service-header bypass: only an authenticated admin may reach this response.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);

    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    return Response.json({
      error: 'Legacy autonomous escrow moderation is disabled',
      code: 'LEGACY_ESCROW_DISABLED',
    }, { status: 410 });
  } catch (error: any) {
    console.error('autonomous-moderation failed:', error?.message || error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
