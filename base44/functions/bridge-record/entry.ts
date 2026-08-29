// bridge-record — authenticated compatibility endpoint for federating one
// existing Base44 entity through the canonical bridgePublish helpers.
//
// This endpoint intentionally does not accept caller-supplied record bodies or
// arbitrary collection names. It loads the current entity server-side, derives
// its canonical collection, verifies ownership, then publishes/updates/deletes
// only that record. This keeps older UI call sites working without reopening a
// generic PDS write proxy.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  collectionForEntity,
  deleteBridgedRecord,
  publishRecord,
  updateBridgedRecord,
} from '../../shared/bridgePublish.ts';

function jsonError(message: string, status: number, code?: string): Response {
  return Response.json({ error: message, code: code || undefined }, { status });
}

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return jsonError('Method not allowed', 405, 'METHOD_NOT_ALLOWED');

    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller?.id) return jsonError('Authentication required', 401, 'UNAUTHORIZED');

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'create').trim();
    const entityName = String(body.entityName || '').trim();
    const recordId = String(body.recordId || '').trim();

    if (!['create', 'update', 'delete'].includes(action)) return jsonError('Unknown bridge action', 400, 'UNKNOWN_ACTION');
    if (!/^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(entityName)) return jsonError('Invalid entityName', 400, 'INVALID_ENTITY');
    if (!recordId) return jsonError('recordId is required', 400, 'RECORD_ID_REQUIRED');

    const collection = collectionForEntity(entityName);
    if (!collection) return jsonError('Entity is not federatable', 400, 'ENTITY_NOT_FEDERATABLE');

    const svc = base44.asServiceRole;
    const rows = await svc.entities[entityName].filter({ id: recordId }, '-created_date', 1).catch(() => []);
    const entity = rows?.[0];
    if (!entity) return jsonError('Record not found', 404, 'RECORD_NOT_FOUND');

    const callerDid = String(caller.did || caller.data?.did || '').trim();
    const ownsByCreator = Boolean(entity.created_by_id && String(entity.created_by_id) === String(caller.id));
    const ownsByDid = Boolean(entity.did && callerDid && String(entity.did) === callerDid);
    if (caller.role !== 'admin' && !ownsByCreator && !ownsByDid) {
      return jsonError('You can only federate your own records', 403, 'FORBIDDEN');
    }

    if (action === 'create') {
      const result = await publishRecord(base44, entityName, recordId, collection);
      if (!result.ok) return jsonError(result.error || 'Federation publish failed', 502, 'FEDERATION_PUBLISH_FAILED');
      return Response.json({ ok: true, action, collection, ...result });
    }

    if (action === 'update') {
      const result = await updateBridgedRecord(base44, entityName, recordId, collection);
      if (!result.ok) return jsonError(result.error || 'Federation update failed', 502, 'FEDERATION_UPDATE_FAILED');
      return Response.json({ ok: true, action, collection, ...result });
    }

    const result = await deleteBridgedRecord(base44, entityName, recordId, collection);
    if (!result.ok) return jsonError(result.error || 'Federation delete failed', 502, 'FEDERATION_DELETE_FAILED');
    return Response.json({ ok: true, action, collection });
  } catch (error: any) {
    console.error('bridge-record failed:', error?.message || error);
    return jsonError('Federation operation failed', 500, 'BRIDGE_RECORD_FAILED');
  }
}
