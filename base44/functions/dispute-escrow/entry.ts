// dispute-escrow — a party in an escrow trade files a dispute, escalating
// to moderation. Transitions the escrow to 'disputed' status and records
// the dispute reason. Moderators/admins can then resolve via resolve-escrow-dispute.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { escrow_id, reason } = body;
    if (!escrow_id) return Response.json({ error: 'Missing escrow id' }, { status: 400 });
    if (!reason || !reason.trim()) return Response.json({ error: 'Dispute reason is required' }, { status: 400 });

    const escrow = await base44.entities.EscrowTrade.get(escrow_id).catch(() => null);
    if (!escrow) return Response.json({ error: 'Escrow not found' }, { status: 404 });

    const isBuyer = escrow.buyer_did === did;
    const isSeller = escrow.seller_did === did;
    if (!isBuyer && !isSeller) {
      return Response.json({ error: 'Not a party to this escrow' }, { status: 403 });
    }
    if (escrow.status === 'disputed') {
      return Response.json({ error: 'Dispute already filed' }, { status: 400 });
    }
    if (escrow.status === 'released' || escrow.status === 'cancelled') {
      return Response.json({ error: `Cannot dispute a ${escrow.status} escrow` }, { status: 400 });
    }

    const updated = await base44.entities.EscrowTrade.update(escrow_id, {
      status: 'disputed',
      dispute_reason: reason.trim(),
      dispute_filed_by: did,
      dispute_filed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Create a ContentReport for moderator visibility
    await base44.entities.ContentReport.create({
      content_type: 'trade_listing',
      content_id: escrow.trade_listing_id,
      content_preview: `Escrow dispute: ${reason.trim().slice(0, 200)}`,
      author_handle: user.bsky_handle || user.username || '',
      reason: 'other',
      details: `Escrow trade ${escrow_id} disputed by ${isBuyer ? 'buyer' : 'seller'}: ${reason.trim()}`,
      status: 'pending',
    });

    return Response.json({
      success: true,
      status: 'disputed',
    });
  } catch (error: any) {
    console.error('dispute-escrow error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}