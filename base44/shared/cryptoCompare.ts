// cryptoCompare — constant-time string comparison to resist timing attacks.
// Used by stripe-webhook (HMAC-SHA-256), nowpayments-ipn (HMAC-SHA-512),
// verify-2fa (TOTP), and verify-login-code (6-digit code) so secret
// comparisons don't leak match/mismatch via response-time differences.
//
// Always iterates over the longer of the two inputs, accumulating XOR of
// char codes. Returns false on length mismatch without short-circuiting
// (the length difference is folded into the same accumulator so the loop
// still runs for the full max length).

export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aLen = a.length;
  const bLen = b.length;
  let result = aLen ^ bLen;
  const maxLen = Math.max(aLen, bLen);
  for (let i = 0; i < maxLen; i++) {
    const ac = i < aLen ? a.charCodeAt(i) : 0;
    const bc = i < bLen ? b.charCodeAt(i) : 0;
    result |= ac ^ bc;
  }
  return result === 0;
}