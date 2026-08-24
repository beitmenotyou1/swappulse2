// resolve-wallet-alias — maps a SwapPulse username to its owner's per-chain
// wallet addresses. Used by the send flow so users can enter a username instead
// of a raw address. Reads the minted username OnChainAsset + MultiChainWallet.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const username = (body.username || '').trim().toLowerCase().replace(/^@/, '');
    if (!username) return Response.json({ error: 'Username required' }, { status: 400 });

    // Find the username NFT (OnChainAsset with asset_type 'username')
    const assets = await base44.asServiceRole.entities.OnChainAsset
      .filter({ asset_type: 'username' }, '-created_date', 50).catch(() => []);

    const match = assets.find((a: any) =>
      (a.handle || '').toLowerCase() === username,
    );
    if (!match) return Response.json({ error: 'Username not found' }, { status: 404 });

    const ownerDid = match.owner_did;

    // Get the owner's MultiChainWallet
    const wallets = await base44.asServiceRole.entities.MultiChainWallet
      .filter({ did: ownerDid, active: true }, '-created_date', 1).catch(() => []);

    if (wallets.length) {
      const w = wallets[0];
      return Response.json({
        username,
        did: ownerDid,
        addresses: {
          evm: w.evm_address,
          solana: w.solana_address || '',
          bitcoin: w.bitcoin_address || '',
        },
      });
    }

    // Fall back to CustodialWallet (legacy, Polygon only)
    const legacy = await base44.asServiceRole.entities.CustodialWallet
      .filter({ did: ownerDid, active: true }, '-created_date', 1).catch(() => []);
    if (legacy.length) {
      return Response.json({
        username,
        did: ownerDid,
        addresses: {
          evm: legacy[0].wallet_address,
          solana: '',
          bitcoin: '',
        },
      });
    }

    return Response.json({ error: 'User has no wallet' }, { status: 404 });
  } catch (error: any) {
    console.error('resolve-wallet-alias error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}