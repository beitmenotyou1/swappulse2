// update-escrow-shipping — a party enters their shipping details (address,
// tracking code, carrier) for an escrow trade. The caller is identified
// as buyer or seller by matching their DID. Updates the EscrowTrade and
// transitions status to 'shipped' when the seller (for usdc_purchase) or
// either party (for card_swap) has entered shipping details.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { escrow_id, shipping_name, shipping_address, tracking_code, carrier } = body;
    if (!escrow_id) return Response.json({ error: 'Missing escrow id' }, { status: 400 });
    if (!shipping_name || !shipping_address || !tracking_code) {
      return Response.json({ error: 'Shipping name, address, and tracking code are required' }, { status: 400 });
    }

    const escrow = await base44.entities.EscrowTrade.get(escrow_id).catch(() => null);
    if (!escrow) return Response.json({ error: 'Escrow not found' }, { status: 404 });

    // Verify the caller is a party to this escrow
    const isBuyer = escrow.buyer_did === did;
    const isSeller = escrow.seller_did === did;
    if (!isBuyer && !isSeller) {
      return Response.json({ error: 'Not a party to this escrow' }, { status: 403 });
    }

    const updates: any = { updated_at: new Date().toISOString() };

    if (isBuyer) {
      updates.buyer_shipping_name = shipping_name;
      updates.buyer_shipping_address = shipping_address;
      updates.buyer_tracking_code = tracking_code;
      updates.buyer_carrier = carrier || '';
    } else {
      updates.seller_shipping_name = shipping_name;
      updates.seller_shipping_address = shipping_address;
      updates.seller_tracking_code = tracking_code;
      updates.seller_carrier = carrier || '';
    }

    // Transition to 'shipped' when the seller has shipped (usdc_purchase)
    // or when both parties have entered tracking (card_swap)
    if (escrow.trade_type === 'usdc_purchase') {
      if (isSeller) {
        updates.status = 'shipped';
      }
    } else {
      // card_swap: both parties need to enter shipping
      const buyerShipped = isBuyer || !!escrow.buyer_tracking_code;
      const sellerShipped = isSeller || !!escrow.seller_tracking_code;
      if (buyerShipped && sellerShipped) {
        updates.status = 'shipped';
      }
    }

    const updated = await base44.entities.EscrowTrade.update(escrow_id, updates);

    return Response.json({
      success: true,
      status: updated.status,
    });
  } catch (error: any) {
    console.error('update-escrow-shipping error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}