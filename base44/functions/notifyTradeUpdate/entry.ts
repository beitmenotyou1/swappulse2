// notifyTradeUpdate — triggered by the Trade Status Notifications workflow
// when a TradeListing's status changes. Finds all users who participated in
// the trade thread (via TradeMessage) plus the listing owner, and creates
// in-app Notification records + dispatches web push for each interested user.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { dispatchNotification } from '../../shared/notificationDispatcher.ts';

function toDid(user: any): string {
  return user.did || 'did:plc:' + String(user.id).replace(/-/g, '').slice(0, 24);
}

// MongoDB ObjectId: 24-char hex string. Service accounts use "service_..." prefixes
// which aren't valid ObjectIds and would cause User.filter to throw.
function isValidObjectId(id: string): boolean {
  return typeof id === 'string' && /^[a-f0-9]{24}$/.test(id);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const { trade_id, old_status, new_status } = body;
    if (!trade_id) {
      return Response.json({ error: 'trade_id is required' }, { status: 400 });
    }

    // Fetch the trade listing
    let listing: any;
    try {
      listing = await svc.entities.TradeListing.get(trade_id);
    } catch {
      return Response.json({ error: 'Trade listing not found' }, { status: 404 });
    }

    // Find all participants: TradeMessage authors + listing owner
    const messages = await svc.entities.TradeMessage.filter(
      { trade_id }, '-created_date', 200,
    ).catch(() => []);

    const participantIds = new Set<string>();
    if (listing.created_by_id) participantIds.add(listing.created_by_id);
    for (const m of messages) {
      if (m.created_by_id) participantIds.add(m.created_by_id);
    }

    if (participantIds.size === 0) {
      return Response.json({ notified: 0, reason: 'no_participants' });
    }

    // Fetch User records to get DIDs (batch via $in).
    // Filter out non-ObjectId IDs (service accounts) to avoid query errors.
    const userIds = [...participantIds].filter(isValidObjectId);
    const users = userIds.length > 0
      ? await svc.entities.User.filter({ id: { $in: userIds } }, '-created_date', 100).catch(() => [])
      : [];
    const userById = new Map(users.map((u: any) => [u.id, u]));

    // Build notification content
    const offerSummary = (listing.offer_card_names || []).slice(0, 2).join(', ') || 'cards';
    const wantSummary = (listing.wanted_card_names || []).slice(0, 2).join(', ') || 'cards';
    const isCompleted = new_status === 'completed';
    const title = isCompleted ? '✅ Trade Completed' : 'Trade Status Updated';
    const bodyText = isCompleted
      ? `Your trade (${offerSummary} → ${wantSummary}) has been marked as completed.`
      : `Trade (${offerSummary} → ${wantSummary}) status changed to ${new_status}.`;
    const targetLabel = `${offerSummary} → ${wantSummary}`;

    let notified = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      const user = userById.get(userId);
      if (!user) continue;
      const recipientDid = toDid(user);

      // Create in-app Notification record
      try {
        await svc.entities.Notification.create({
          did: recipientDid,
          action_type: 'trade_match',
          actor_name: 'SwapPulse',
          actor_handle: 'swappulse',
          target_type: 'trade',
          target_path: `/trade/${trade_id}`,
          target_label: targetLabel,
          is_read: false,
          metadata: { tradeId: trade_id, oldStatus: old_status, newStatus: new_status },
        });
      } catch (e: any) {
        console.error('[notifyTradeUpdate] notification create failed', userId, e?.message || e);
        errors.push(`notification_${userId}: ${e?.message || e}`);
      }

      // Dispatch push notification
      try {
        await dispatchNotification(svc, {
          recipientDid,
          type: 'trade_update',
          title,
          body: bodyText,
          params: { tradeId: trade_id },
          subjectUri: listing.at_uri,
          priority: 'standard',
        });
      } catch (e: any) {
        console.error('[notifyTradeUpdate] push failed', userId, e?.message || e);
        errors.push(`push_${userId}: ${e?.message || e}`);
      }

      notified++;
    }

    return Response.json({ notified, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error('notifyTradeUpdate error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});