// Frontend helper for connecting a Polygon wallet and signing the
// wallet-link message. Uses window.ethereum (MetaMask / Polygon-compatible
// wallets). The private key never leaves the user's wallet — we only
// request a signature to prove ownership.

export function hasWallet() {
  return typeof window !== 'undefined' && !!window.ethereum;
}

export async function connectWallet() {
  if (!hasWallet()) {
    throw new Error('No Polygon wallet found. Install MetaMask or a compatible wallet extension.');
  }
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts || !accounts.length) {
    throw new Error('No account returned by wallet');
  }
  return accounts[0];
}

// Constructs and signs the wallet-link message containing the collector's
// DID and a single-use nonce. Returns { address, signature, message, nonce }
// to send to the link-wallet backend function for verification.
export async function signWalletLinkMessage(address, did) {
  if (!hasWallet()) {
    throw new Error('No Polygon wallet found');
  }
  const nonce = (crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2, 10);
  const message = [
    'SwapPulse Wallet Link',
    `DID: ${did}`,
    `Nonce: ${nonce}`,
    `Timestamp: ${Date.now()}`,
  ].join('\n');

  const signature = await window.ethereum.request({
    method: 'personal_sign',
    params: [message, address],
  });

  return { address, signature, message, nonce };
}