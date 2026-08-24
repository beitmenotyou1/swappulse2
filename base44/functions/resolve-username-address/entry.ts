// resolve-username-address — resolves a minted SwapPulse username to the
// wallet address on a specific chain. EVM chains share one address; Solana
// and Bitcoin each have their own. Returns { address, chain, did, handle }.
// Used by send/transfer flows so senders can enter @username instead of a
// raw address.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getChainType } from '../../shared/chainConfig.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { username, chain } = body;

    if (!username) return Response.json({ error: 'Username is required' }, { status: 400 });
    if (!chain) return Response.json({ error: 'Chain is required' }, { status: 400 });

    // Normalise: strip @ prefix, lowercase
    const handle = String(username).replace(/^@/, '').toLowerCase();

    // Find the username NFT (case-insensitive handle match)
    // Fetch all username assets and filter in code — handles are unique
    const allUsernameAssets = await base44.asServiceRole.entities.OnChainAsset
      .filter({ asset_type: 'username' }, '-minted_at', 500).catch(() => []);

    const match = allUsernameAssets.find(
      (a: any) => (a.handle || '').toLowerCase() === handle
    );

    if (!match) {
      return Response.json({ error: `Username @${handle} is not minted on SwapPulse` }, { status: 404 });
    }

    const ownerDid = match.owner_did;
    if (!ownerDid) return Response.json({ error: 'Owner DID not found' }, { status: 404 });

    // Find the owner's wallet — prefer MultiChainWallet, fall back to CustodialWallet
    let wallet: any = null;
    let walletType = '';

    const multiWallets = await base44.asServiceRole.entities.MultiChainWallet
      .filter({ did: ownerDid, active: true }, '-created_date', 1).catch(() => []);
    if (multiWallets.length) {
      wallet = multiWallets[0];
      walletType = 'multi';
    }

    if (!wallet) {
      const custodialWallets = await base44.asServiceRole.entities.CustodialWallet
        .filter({ did: ownerDid, active: true }, '-created_date', 1).catch(() => []);
      if (custodialWallets.length) {
        wallet = custodialWallets[0];
        walletType = 'custodial';
      }
    }

    if (!wallet) {
      return Response.json({ error: `@${handle} has not set up a wallet yet` }, { status: 404 });
    }

    // Determine the address based on the requested chain type
    const chainType = getChainType(chain);
    let address: string | null = null;

    if (chainType === 'evm') {
      address = walletType === 'multi' ? wallet.evm_address : wallet.wallet_address;
    } else if (chainType === 'solana') {
      address = wallet.solana_address || null;
    } else if (chainType === 'bitcoin') {
      address = wallet.bitcoin_address || null;
    } else {
      // 'other' chain types — fall back to EVM address
      address = walletType === 'multi' ? wallet.evm_address : wallet.wallet_address;
    }

    if (!address) {
      return Response.json({
        error: `@${handle} does not have a ${chain} address configured`,
        did: ownerDid,
        handle: match.handle,
      }, { status: 404 });
    }

    return Response.json({
      address,
      chain,
      chain_type: chainType,
      did: ownerDid,
      handle: match.handle,
    });
  } catch (error: any) {
    console.error('resolve-username-address error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}