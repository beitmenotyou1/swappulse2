// timingSafeEqual — constant-time string comparison to prevent timing
// attacks on OTP/2FA code verification. Shared by verify-2fa and
// verify-login-code. This is a general security utility, NOT crypto/wallet
// infrastructure.
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  // HMAC both inputs with the same random key, then compare the MACs.
  // This leaks no timing information about the plaintext.
  const key = crypto.getRandomValues(new Uint8Array(32));
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const aSig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, aBuf));
  const bSig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, bBuf));
  let diff = 0;
  for (let i = 0; i < aSig.length; i++) {
    diff |= aSig[i] ^ bSig[i];
  }
  return diff === 0;
}