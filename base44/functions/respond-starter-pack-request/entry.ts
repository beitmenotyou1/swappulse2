// respond-starter-pack-request — a collector accepts or denies a pending
// starter pack inclusion request. On accept, their DID is promoted into the
// pack's confirmed member_dids and the pack is re-bridged. Either way the
// author is notified of the decision. Only the target of the request may
// respond.
//
// Input:  { requestId, accept: boolean }
// Output: { ok, status }
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { dispatchNotification } from '../../shared/notificationDispatcher.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({} as any));
    const requestId = String(body.requestId || '').trim();
    const accept = !!body.accept;
    if (!requestId) return Response.json({ error: 'requestId required' }, { status: 400 });

    const myDid = user.data?.did || user.did || '';
    if (!myDid) return Response.json({ error: 'Identity not provisioned yet.' }, { status: 409 });

    const svc = base44.asServiceRole;
    const request = await svc.entities.StarterPackRequest.get(requestId).catch(() => null);
    if (!request) return Response.json({ error: 'Request not found' }, { status: 404 });
    if (request.target_did !== myDid) {
      return Response.json({ error: 'Only the requested collector can respond.' }, { status: 403 });
    }
    if (request.status !== 'pending') {
      return Response.json({ ok: true, status: request.status, reason: 'already_resolved' });
    }

    const packId = request.pack_id;
    const pack = await svc.entities.StarterPack.get(packId).catch(() => null);

    if (accept) {
      // Promote into confirmed members and re-bridge.
      if (pack) {
        const members: string[] = Array.isArray(pack.member_dids) ? pack.member_dids : [];
        if (!members.includes(myDid)) {
          await svc.entities.StarterPack.update(packId, { member_dids: [...members, myDid].slice(0, 100) });
        }
        base44.functions.invoke('bridge-record', { action: 'update', entityName: 'StarterPack', recordId: packId }).catch(() => {});
      }
      await svc.entities.StarterPackRequest.update(requestId, {
        status: 'accepted',
        responded_at: new Date().toISOString(),
      });
    } else {
      await svc.entities.StarterPackRequest.update(requestId, {
        status: 'denied',
        responded_at: new Date().toISOString(),
      });
    }

    // Notify the author of the decision.
    if (request.requester_did) {
      try {
        await svc.entities.Notification.create({
          did: request.requester_did,
          action_type: 'starter_pack',
          source_uri: pack?.at_uri || '',
          actor_did: myDid,
          actor_name: user.full_name || user.display_name || '',
          actor_handle: user.data?.bsky_handle || user.username || '',
          actor_avatar: user.data?.avatar_url || user.avatar || '',
          target_type: 'profile',
          target_path: `/starter-packs/${packId}`,
          target_label: pack?.name || 'their starter pack',
          group_key: `starter_pack_response:${packId}:${myDid}`,
          group_count: 1,
          is_read: false,
          metadata: {
            kind: accept ? 'accepted' : 'denied',
            packId,
            packName: pack?.name || '',
          },
        });
      } catch (e) {
        console.error('respond-starter-pack-request: notify author failed', e?.message || e);
      }

      try {
        await dispatchNotification(svc, {
          recipientDid: request.requester_did,
          type: 'starter_pack',
          title: `${user.full_name || 'A collector'} ${accept ? 'accepted' : 'declined'} your starter pack request`,
          body: pack?.name || '',
          params: { packId },
          subjectUri: pack?.at_uri || '',
          priority: 'standard',
          actorDid: myDid,
        });
      } catch (e) {
        console.error('respond-starter-pack-request: dispatch failed', e?.message || e);
      }
    }

    return Response.json({ ok: true, status: accept ? 'accepted' : 'denied' });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}