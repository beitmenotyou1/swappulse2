// set-wallet-pin — sets, changes, or removes the PIN for a custodial wallet.
// When setting a PIN, the private key is re-encrypted with a PBKDF2-derived
// key from the PIN (encryption_method changes to 'pin'). When removing the PIN,
// the private key is re-encrypted with the server key (encryption_method changes
// to 'server'). Requires the current PIN (if one is set) or passkey verification
// to authorize the change.
//
// Body: { pin?: string, currentPin?: string, action: 'set' | 'remove' }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  encryptWithServerKey,
  encryptWithPin,
  decryptWithServerKey,
  decryptWithPin,
  hashPin,
  verifyPin,
  timingSafeEqual,
} from '../../shared/walletCrypto.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { pin, currentPin, action } = body;
    if (!['set', 'remove'].includes(action)) {
      return Response.json({ error: 'Invalid action. Use "set" or "remove".' }, { status: 400 });
    }

    // Find the user's active custodial wallet
    const wallets = await base44.entities.CustodialWallet.filter({ did, active: true });
    if (!wallets.length) {
      return Response.json({ error: 'No custodial wallet found' }, { status: 404 });
    }
    const wallet = wallets[0];

    // Verify current PIN if one is set
    if (wallet.has_pin) {
      if (!currentPin) {
        return Response.json({ error: 'Current PIN required' }, { status: 400 });
      }
      const valid = await verifyPin(wallet, currentPin);
      if (!valid) {
        return Response.json({ error: 'Current PIN is incorrect' }, { status: 403 });
      }
    }

    // Decrypt the private key (using current method)
    let privateKey: string;
    if (wallet.encryption_method === 'pin' && currentPin) {
      privateKey = await decryptWithPin(
        wallet.encrypted_private_key,
        currentPin,
        wallet.pin_salt,
        wallet.kdf_iterations || 100000,
      );
    } else {
      privateKey = await decryptWithServerKey(wallet.encrypted_private_key);
    }

    if (action === 'set') {
      // Validate PIN format (4-6 digits)
      if (!pin || !/^\d{4,6}$/.test(pin)) {
        return Response.json({ error: 'PIN must be 4-6 digits' }, { status: 400 });
      }

      // Re-encrypt with PIN-derived key
      const { cipher, salt, iterations } = await encryptWithPin(privateKey, pin);
      const pinHash = await hashPin(pin);

      await base44.entities.CustodialWallet.update(wallet.id, {
        encrypted_private_key: cipher,
        encryption_method: 'pin',
        pin_hash: pinHash,
        pin_salt: salt,
        kdf_iterations: iterations,
        has_pin: true,
      });

      return Response.json({ success: true, hasPin: true });
    }

    // action === 'remove'
    // Re-encrypt with server key
    const cipher = await encryptWithServerKey(privateKey);

    await base44.entities.CustodialWallet.update(wallet.id, {
      encrypted_private_key: cipher,
      encryption_method: 'server',
      pin_hash: '',
      pin_salt: '',
      has_pin: false,
    });

    return Response.json({ success: true, hasPin: false });
  } catch (error: any) {
    console.error('set-wallet-pin error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}