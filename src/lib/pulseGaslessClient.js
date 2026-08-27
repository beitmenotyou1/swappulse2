// Client-side helper for the PulseChain gasless relay.
//
// For custodial wallets the signing happens server-side (the key is encrypted)
// — call queuePulseGaslessTransfer(), which invokes the
// queue-pulse-gasless-transfer backend function.
//
// The EIP-712 domain + types below mirror the PulseGaslessRelay contract's
// typehashes and are exported for any future linked-wallet (MetaMask) signing
// path, where the user signs in the browser.

import { base44 } from '@/api/base44Client';

export const PULSE_GASLESS_RELAY_TYPES = {
  MetaTx: [
    { name: 'user', type: 'address' },
    { name: 'target', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'data', type: 'bytes' },
  ],
};

export const PULSE_GASLESS_RELAY_DOMAIN = {
  name: 'SwapPulse Gasless Relay',
  version: '1',
};

// Queue a gasless $PULSE transfer from a custodial wallet. The backend
// decrypts the wallet (after passkey/PIN unlock), signs the EIP-712 intent,
// and creates a pending MetaTransaction. The scheduled processor relays it
// on-chain (the treasury pays gas). Resolves with { success, meta_tx_id,
// status, nonce } or { requiresUnlock, hasPasskey, hasPin }.
export async function queuePulseGaslessTransfer({ toAddress, amountWei, unlockCredential, pin }) {
  const res = await base44.functions.invoke('queue-pulse-gasless-transfer', {
    to_address: toAddress,
    amount_wei: amountWei.toString(),
    unlockCredential,
    pin,
  });
  return res.data;
}