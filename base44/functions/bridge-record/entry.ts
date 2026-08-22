// bridge-record — client-callable wrapper around bridgePublish's
// updateBridgedRecord and deleteBridgedRecord. Used by edit call sites
// (Collection, TradeBoard, Binder, Journal, Vouch, Circle, Meetup, Reaction,
// etc.) to push a single record update or delete to the PDS in one call, with
// content_hash computed server-side from the canonical BUILDER_CONFIG record.
//
// Ownership is verified before the PDS push (atproto-bridge) and before the
// local metadata update (here) so a user can only bridge their own records.
// Admins bypass for moderation. The local entity update only touches bridge
// metadata (cid, content_hash) — the record body is never mutated here.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { publishRecord, updateBridgedRecord, deleteBridgedRecord, collectionForEntity } from '../../shared/bridgePublish.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Authentication required' }, { status: 401 });
    const { action, entityName, recordId, collection } = await req.json().catch(() => ({}));
    if (!entityName || !recordId) return Response.json({ error: 'entityName and recordId required' }, { status: 400 });

    // Ownership check: only the record's creator (or an admin) may push it.
    const svc = base44.asServiceRole;
    const rows = await svc.entities[entityName].filter({ id: recordId }, '-created_date', 1).catch(() => []);
    const entity = rows?.[0];
    if (!entity) return Response.json({ error: 'record not found' }, { status: 404 });
    const owns = caller.role === 'admin'
      || (entity.created_by_id && entity.created_by_id === caller.id)
      || (entity.did && caller.did && entity.did === caller.did);
    if (!owns) return Response.json({ error: 'You can only update your own records' }, { status: 403 });

    const coll = collection || collectionForEntity(entityName);
    if (action === 'create') {
      const res = await publishRecord(base44, entityName, recordId, coll);
      return Response.json(res);
    }
    if (action === 'delete') {
      const res = await deleteBridgedRecord(base44, entityName, recordId, coll);
      return Response.json(res);
    }
    const res = await updateBridgedRecord(base44, entityName, recordId, coll);
    return Response.json(res);
  } catch (e: any) {
    console.error('bridge-record error:', e?.message || e);
    return Response.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}