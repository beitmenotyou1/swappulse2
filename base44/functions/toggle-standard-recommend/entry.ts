// toggle-standard-recommend — toggles a site.standard.graph.recommend record
// on the user's PDS for a journal, card review, or binder. Idempotent: if a
// recommend already exists for (did, documentUri), it's deleted (un-recommend);
// otherwise it's created (recommend). The local StandardRecommend entity and
// the content's recommend_count are kept in sync.
//
// Also creates a notification for the document's author when a new recommend
// is created.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createRecommendRecord, deleteRecommendRecord } from '../../shared/standardSite.ts';

const ENTITY_MAP: Record<string, string> = {
  journal: 'Journal',
  card_review: 'CardReview',
  binder: 'Binder',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Authentication required' }, { status: 401 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const { documentUri, entityType, entityId, authorDid } = body;

    if (!documentUri || !entityType || !entityId) {
      return Response.json({ error: 'documentUri, entityType, and entityId are required' }, { status: 400 });
    }
    const entityName = ENTITY_MAP[entityType];
    if (!entityName) return Response.json({ error: 'Invalid entityType' }, { status: 400 });

    // Check if the user already has a recommend for this document
    const existing = await svc.entities.StandardRecommend
      .filter({ did: caller.did, document_uri: documentUri }, '-created_date', 1).catch(() => []);

    if (existing?.length > 0) {
      // Un-recommend: delete the PDS record, the local entity, and decrement the count
      await deleteRecommendRecord(base44, documentUri).catch(() => {});
      await svc.entities.StandardRecommend.delete(existing[0].id).catch(() => {});
      const target = await svc.entities[entityName].get(entityId).catch(() => null);
      if (target) {
        const nextCount = Math.max(0, (target.recommend_count || 0) - 1);
        await svc.entities[entityName].update(entityId, { recommend_count: nextCount }).catch(() => {});
      }
      return Response.json({ ok: true, recommended: false, count: Math.max(0, (existing[0] ? 1 : 0)) });
    }

    // Recommend: create the PDS record, the local entity, and increment the count
    const pdsUri = await createRecommendRecord(base44, documentUri);
    if (!pdsUri) {
      return Response.json({ error: 'Failed to create recommend record on PDS' }, { status: 502 });
    }

    await svc.entities.StandardRecommend.create({
      did: caller.did,
      document_uri: documentUri,
      entity_type: entityType,
      entity_id: entityId,
      author_did: authorDid || '',
    }).catch((e: any) => console.error('toggle-standard-recommend: local create failed', e?.message || e));

    const target = await svc.entities[entityName].get(entityId).catch(() => null);
    let count = 0;
    if (target) {
      count = (target.recommend_count || 0) + 1;
      await svc.entities[entityName].update(entityId, { recommend_count: count }).catch(() => {});
    }

    // Notify the author
    if (authorDid && authorDid !== caller.did) {
      await base44.functions.invoke('notify-interaction', {
        recipientDid: authorDid,
        actionType: 'reaction',
        actorDid: caller.did,
        actorName: caller.full_name || '',
        actorHandle: caller.custom_handle || '',
        actorAvatar: caller.avatar || '',
        target_type: entityType === 'journal' ? 'post' : entityType === 'card_review' ? 'card' : 'post',
        target_label: `${entityType.replace('_', ' ')} recommended`,
        origin: 'local',
      }).catch(() => {});
    }

    return Response.json({ ok: true, recommended: true, count });
  } catch (error) {
    console.error('toggle-standard-recommend error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});