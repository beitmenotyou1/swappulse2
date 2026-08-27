import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';

// Links a collector's Polygon wallet to their SwapPulse account via
// EIP-4361-style signature verification. The frontend asks the user to
// sign a message containing their DID and a nonce; this function verifies
// the signature matches the claimed address, then creates a WalletLink.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Use the authenticated user's own DID — never trust a client-supplied
    // DID. Letting the caller choose the DID would allow linking a wallet
    // to another user's account or creating duplicate links under a victim's DID.
    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found for your account' }, { status: 400 });

    const body = await req.json();
    const { address, signature, message, nonce, hardware, wallet_type } = body;

    if (!address || !signature || !message) {
      return Response.json({ error: 'Missing address, signature, or message' }, { status: 400 });
    }

    // Verify the signature was produced by the claimed wallet
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return Response.json({ error: 'Signature verification failed' }, { status: 400 });
    }

    // Verify the message references the correct DID (prevents replay with a different DID)
    if (!message.includes(`DID: ${did}`)) {
      return Response.json({ error: 'Message does not match your DID' }, { status: 400 });
    }

    // Deactivate any existing active wallet links for this user
    const existing = await base44.entities.WalletLink.filter({ did });
    for (const link of existing) {
      if (link.active) {
        await base44.entities.WalletLink.update(link.id, { active: false });
      }
    }

    // Also check no other user has this wallet linked
    const dupCheck = await base44.asServiceRole.entities.WalletLink.filter({
      wallet_address: address.toLowerCase(),
      active: true,
    });
    for (const dup of dupCheck) {
      if (dup.did !== did) {
        await base44.asServiceRole.entities.WalletLink.update(dup.id, { active: false });
      }
    }

    const link = await base44.entities.WalletLink.create({
      wallet_address: address.toLowerCase(),
      did,
      handle: user.bsky_handle || user.username || '',
      chain_id: '137',
      nonce,
      signature,
      hardware: !!hardware,
      wallet_type: wallet_type || 'extension',
      linked_at: new Date().toISOString(),
      active: true,
    });

    // Auto-disable the receive allowlist strict mode and set the default
    // wallet to the linked wallet, so the collector's external wallet handles
    // all sends and receives by default.
    try {
      const settingsList = await base44.entities.SettingsConfig.filter({ did }, '-updated_date', 1).catch(() => []);
      if (settingsList.length) {
        const config = settingsList[0].config || {};
        const walletConfig = config.wallet || {};
        await base44.entities.SettingsConfig.update(settingsList[0].id, {
          config: { ...config, wallet: { ...walletConfig, receive_strict_mode: false, default_wallet: 'linked' } },
          updated_at: new Date().toISOString(),
        });
      } else {
        await base44.entities.SettingsConfig.create({
          did,
          config: { wallet: { receive_strict_mode: false, default_wallet: 'linked' } },
          updated_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('link-wallet: settings update failed:', (e as any)?.message || e);
    }

    return Response.json({ link });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}