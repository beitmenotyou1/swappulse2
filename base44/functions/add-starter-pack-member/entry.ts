// add-starter-pack-member — a pack author adds a collector to their starter
// pack. Creates a pending StarterPackRequest and notifies the collector so
// they can accept or deny being included. If the collector has the
// auto_accept_starter_pack setting enabled on their user data, the request is
// auto-promoted: their DID is added to StarterPack.member_dids immediately and
// the pack is re-bridged, with no pending record left behind.
//
// Input:  { packId, targetDid, targetName?, targetHandle?, targetAvatar? }
// Output: { ok, autoAccepted?, pending?, requestId?, reason? }
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { dispatchNotification } from '../../shared/notificationDispatcher.ts';
import { shouldDeliverNotification } from '../../shared/notificationFilter.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({} as any));
    const packId = String(body.packId || '').trim();
    const targetDid = String(body.targetDid || '').trim();
    if (!packId || !targetDid) {
      return Response.json({ error: 'packId and targetDid are required' }, { status: 400 });
    }

    const myDid = user.data?.did || user.did || '';
    if (!myDid) return Response.json({ error: 'Identity not provisioned yet.' }, { status: 409 });

    const svc = base44.asServiceRole;
    const pack = await svc.entities.StarterPack.get(packId).catch(() => null);
    if (!pack) return Response.json({ error: 'Pack not found' }, { status: 404 });
    if (pack.did !== myDid) {
      return Response.json({ error: 'Only the pack author can add members.' }, { status: 403 });
    }

    // Already a confirmed member — nothing to do.
    const members: string[] = Array.isArray(pack.member_dids) ? pack.member_dids : [];
    if (members.includes(targetDid)) {
      return Response.json({ ok: true, alreadyMember: true });
    }

    // Check for an existing pending request — don't duplicate.
    const existing = await svc.entities.StarterPackRequest.filter(
      { pack_id: packId, target_did: targetDid, status: 'pending' },
      '-created_date',
      1,
    ).catch(() => []);
    if (existing && existing.length > 0) {
      return Response.json({ ok: true, pending: true, requestId: existing[0].id, reason: 'already_pending' });
    }

    const targetName = String(body.targetName || '').trim();
    const targetHandle = String(body.targetHandle || '').trim();
    const targetAvatar = String(body.targetAvatar || '').trim();

    // Look up the target's auto_accept_starter_pack setting. The User entity is
    // read via the service role so we can read another collector's data flag.
    let autoAccept = false;
    try {
      const targetUsers = await svc.entities.User.filter({ did: targetDid }, '-created_date', 1);
      const tu = targetUsers?.[0];
      if (tu && tu.data?.auto_accept_starter_pack) autoAccept = true;
    } catch {}

    if (autoAccept) {
      // Auto-promote: add to member_dids immediately and re-bridge.
      const nextMembers = [...members, targetDid].slice(0, 100);
      await svc.entities.StarterPack.update(packId, { member_dids: nextMembers });
      base44.functions.invoke('bridge-record', { action: 'update', entityName: 'StarterPack', recordId: packId }).catch(() => {});
      return Response.json({ ok: true, autoAccepted: true });
    }

    // Create a pending request.
    const request = await svc.entities.StarterPackRequest.create({
      pack_id: packId,
      pack_name: pack.name || '',
      requester_did: myDid,
      requester_name: user.full_name || user.display_name || user.email || '',
      requester_handle: user.data?.bsky_handle || user.username || '',
      requester_avatar: user.data?.avatar_url || user.avatar || '',
      target_did: targetDid,
      target_name: targetName,
      target_handle: targetHandle,
      target_avatar: targetAvatar,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    // Respect the target's notification preferences before creating the record.
    let filtered = false;
    try {
      const f = await shouldDeliverNotification(svc, { recipientDid: targetDid, actorDid: myDid });
      if (!f.allowed) filtered = true;
    } catch {}

    // Create an in-app Notification for the target with accept/deny actions.
    if (!filtered) {
      try {
        await svc.entities.Notification.create({
          did: targetDid,
          action_type: 'starter_pack',
          source_uri: pack.at_uri || '',
          actor_did: myDid,
          actor_name: user.full_name || user.display_name || '',
          actor_handle: user.data?.bsky_handle || user.username || '',
          actor_avatar: user.data?.avatar_url || user.avatar || '',
          target_type: 'profile',
          target_path: `/starter-packs/${packId}`,
          target_label: pack.name || 'a starter pack',
          group_key: `starter_pack:${packId}:${targetDid}`,
          group_count: 1,
          is_read: false,
          metadata: {
            kind: 'request',
            packId,
            requestId: request.id,
            packName: pack.name || '',
          },
        });
      } catch (e) {
        console.error('add-starter-pack-member: notification create failed', e?.message || e);
      }

      // Dispatch push.
      try {
        await dispatchNotification(svc, {
          recipientDid: targetDid,
          type: 'starter_pack',
          title: `${user.full_name || 'Someone'} added you to a starter pack`,
          body: pack.name || '',
          params: { packId, requestId: request.id },
          subjectUri: pack.at_uri || '',
          priority: 'standard',
          actorDid: myDid,
        });
      } catch (e) {
        console.error('add-starter-pack-member: dispatch failed', e?.message || e);
      }
    }

    return Response.json({ ok: true, pending: true, requestId: request.id });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}