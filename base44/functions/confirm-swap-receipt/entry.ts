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