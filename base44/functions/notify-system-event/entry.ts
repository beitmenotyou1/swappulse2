// notify-system-event — creates an in-app Notification for a system-generated
// event (trade_match, price_alert) AFTER checking the recipient's notification
// preferences (paused / who_filter / on_site_only). Replaces the client-side
// RealTimeManager.notifyForMe path so the master pause is respected even for
// system events.
//
// Input: { recipientDid, actionType, source, fields }
//   fields: any extra Notification columns (actor_name, target_path, etc.)
// Returns: { ok, notificationId?, skipped? }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { shouldDeliverNotification } from '../../shared/notificationFilter.ts';
import { dispatchNotification } from '../../shared/notificationDispatcher.ts';

const VALID_TYPES = new Set(['trade_match', 'price_alert', 'pack_pull', 'voice_live', 'podcast']);

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { recipientDid, actionType, source, fields } = body;

    if (!recipientDid || !actionType) {
      return Response.json({ error: 'recipientDid and actionType are required' }, { status: 400 });
    }
    if (!VALID_TYPES.has(actionType)) {
      return Response.json({ error: `actionType must be one of ${[...VALID_TYPES].join(', ')}` }, { status: 400 });
    }

    // Enforce the recipient's notification preferences before creating.
    try {
      const filter = await shouldDeliverNotification(svc, { recipientDid, actorDid: 'system' });
      if (!filter.allowed) {
        return Response.json({ ok: true, skipped: 'filtered', reason: filter.reason });
      }
    } catch (e) {
      console.error('notify-system-event: pref filter failed', e?.message || e);
      // Fail open — don't silently mute on a filter error.
    }

    const rec: any = {
      did: recipientDid,
      action_type: actionType,
      is_read: false,
      source_uri: source?.at_uri || source?.uri || '',
      ...(fields || {}),
    };

    let notificationId: string | null = null;
    try {
      const notif = await svc.entities.Notification.create(rec);
      notificationId = notif?.id || null;
    } catch (e) {
      console.error('notify-system-event: create failed', e?.message || e);
      return Response.json({ error: 'create failed' }, { status: 500 });
    }

    // Dispatch push (also enforces preferences + quiet hours + rate limits).
    try {
      const title = fields?.actor_name
        ? `${fields.actor_name} ${actionType === 'trade_match' ? 'matched your wishlist' : actionType === 'price_alert' ? 'price drop' : ''}`
        : actionType === 'trade_match' ? 'New Trade Match!' : actionType === 'price_alert' ? 'Price Drop Alert' : 'SwapPulse';
      await dispatchNotification(svc, {
        recipientDid,
        type: actionType,
        title,
        body: fields?.target_label || '',
        params: {},
        subjectUri: rec.source_uri,
        priority: (actionType === 'trade_match' || actionType === 'price_alert') ? 'high' : 'standard',
      });
    } catch (e) {
      console.error('notify-system-event: dispatch failed', e?.message || e);
    }

    return Response.json({ ok: true, notificationId });
  } catch (error) {
    console.error('notify-system-event error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}