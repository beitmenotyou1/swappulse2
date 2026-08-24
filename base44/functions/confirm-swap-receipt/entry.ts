// confirm-swap-receipt — a party in a card-for-card swap confirms receipt
// of the other party's card by uploading a photo (with tracking code visible).
// When both parties have confirmed, the escrow transitions to 'released'.
// No USDC changes hands and no fee is charged — this is the free card-to-card
// exchange.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { escrow_id, confirmation_photo_url } = body;
    if (!escrow_id) return Response.json({ error: 'Missing escrow id' }, { status: 400 });
    if (!confirmation_photo_url) return Response.json({ error: 'Confirmation photo is required' }, { status: 400 });

    const escrow = await base44.entities.EscrowTrade.get(escrow_id).catch(() => null);
    if (!escrow) return Response.json({ error: 'Escrow not found' }, { status: 404 });
    if (escrow.trade_type !== 'card_swap') {
      return Response.json({ error: 'This function is for card swaps only' }, { status: 400 });
    }

    const isBuyer = escrow.buyer_did === did;
    const isSeller = escrow.seller_did === did;
    if (!isBuyer && !isSeller) {
      return Response.json({ error: 'Not a party to this escrow' }, { status: 403 });
    }
    if (!['created', 'shipped'].includes(escrow.status)) {
      return Response.json({ error: `Cannot confirm in status: ${escrow.status}` }, { status: 400 });
    }

    const updates: any = { updated_at: new Date().toISOString() };

    if (isBuyer) {
      updates.buyer_confirmation_photo = confirmation_photo_url;
      updates.buyer_confirmed_at = new Date().toISOString();
    } else {
      updates.seller_confirmation_photo = confirmation_photo_url;
      updates.seller_confirmed_at = new Date().toISOString();
    }

    // Check if both parties have confirmed
    const buyerConfirmed = isBuyer || !!escrow.buyer_confirmed_at;
    const sellerConfirmed = isSeller || !!escrow.seller_confirmed_at;

    if (buyerConfirmed && sellerConfirmed) {
      updates.status = 'released';
    }

    const updated = await base44.entities.EscrowTrade.update(escrow_id, updates);

    // When both parties have confirmed, notify both that the swap is complete
    if (buyerConfirmed && sellerConfirmed) {
      try {
        const { dispatchNotification } = await import('../../shared/notificationDispatcher.ts');
        const cardSummary = (escrow.card_names || []).slice(0, 2).join(', ') || 'cards';
        const tradePath = `/trade/${escrow.trade_listing_id}`;

        for (const recipientDid of [escrow.buyer_did, escrow.seller_did]) {
          if (!recipientDid) continue;
          await base44.asServiceRole.entities.Notification.create({
            did: recipientDid,
            action_type: 'escrow_released',
            actor_name: 'SwapPulse',
            actor_handle: 'swappulse',
            target_type: 'trade',
            target_path: tradePath,
            target_label: cardSummary,
            is_read: false,
            metadata: { escrowId: escrow_id, tradeType: 'card_swap', cardNames: escrow.card_names },
          });
          await dispatchNotification(base44.asServiceRole, {
            recipientDid,
            type: 'escrow_released',
            title: '✅ Swap Complete',
            body: `Both parties have confirmed receipt. Your card swap (${cardSummary}) is complete.`,
            params: { tradeId: escrow.trade_listing_id },
            priority: 'high',
          });
        }
      } catch (e) {
        console.error('Swap release notification failed:', (e as any)?.message);
      }
    }

    return Response.json({
      success: true,
      status: updated.status,
      both_confirmed: buyerConfirmed && sellerConfirmed,
    });
  } catch (error: any) {
    console.error('confirm-swap-receipt error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}