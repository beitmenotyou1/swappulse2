import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { reconcileChainEvents } from '../../shared/chainEvents.ts';

// Scheduled reconciler: advances in-flight appchain mirror records and notifies
// the owning collector when the chain confirms a transition. Admin-only so it
// cannot be driven by an end user.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (me.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const result = await reconcileChainEvents(base44.asServiceRole);
    return Response.json(result);
  } catch (error: any) {
    console.error('chain-event-reconcile failed:', error?.message || error);
    return Response.json({ error: 'Chain event reconciliation failed' }, { status: 500 });
  }
}