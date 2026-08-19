// payments — shared helpers for the dual donation system (Stripe + NowPayments).
// Turnstile verification, crypto currency whitelist, and order id generation.
// Imported by create-fiat-donation, create-crypto-donation, create-checkout, and
// donation-contact so bot-protection and currency validation stay in one place.

const ALLOWED_CRYPTO_CURRENCIES = [
  // Stablecoins (pegged to USD, no volatility)
  { symbol: 'usdcsol', name: 'USDC', network: 'Solana', category: 'stablecoins' },
  { symbol: 'usdceth', name: 'USDC', network: 'Ethereum', category: 'stablecoins' },
  { symbol: 'usdcmatic', name: 'USDC', network: 'Polygon', category: 'stablecoins' },
  { symbol: 'usdtsol', name: 'USDT', network: 'Solana', category: 'stablecoins' },
  { symbol: 'usdteth', name: 'USDT', network: 'Ethereum', category: 'stablecoins' },
  { symbol: 'usdtpolygon', name: 'USDT', network: 'Polygon', category: 'stablecoins' },
  // Privacy coins (untraceable or shielded)
  { symbol: 'xmr', name: 'Monero', network: 'XMR', category: 'privacy' },
  { symbol: 'zec', name: 'Zcash', network: 'ZEC', category: 'privacy' },
  { symbol: 'dash', name: 'Dash', network: 'DASH', category: 'privacy' },
  // Major coins (native chain transfers)
  { symbol: 'btc', name: 'Bitcoin', network: 'BTC', category: 'major' },
  { symbol: 'eth', name: 'Ethereum', network: 'ETH', category: 'major' },
  { symbol: 'sol', name: 'Solana', network: 'SOL', category: 'major' },
  { symbol: 'matic', name: 'Polygon', network: 'MATIC', category: 'major' },
];

export const CRYPTO_CURRENCIES = ALLOWED_CRYPTO_CURRENCIES;

export function isAllowedCryptoCurrency(symbol: string): boolean {
  return ALLOWED_CRYPTO_CURRENCIES.some((c) => c.symbol === symbol);
}

export function generateOrderId(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `DON-${ts}-${rand}`;
}

// Cloudflare Turnstile verification — keeps the public donation endpoints open
// (no login required) while blocking automated session-creation abuse.
export async function verifyTurnstile(token: string): Promise<boolean> {
  if (!token) return false;
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) {
    console.error('payments: TURNSTILE_SECRET_KEY not configured');
    return false;
  }
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json();
    return data?.success === true;
  } catch (e) {
    console.error('payments: Turnstile verify failed', e?.message || e);
    return false;
  }
}