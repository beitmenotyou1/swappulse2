const ALLOWED_DEST_HOSTS = new Set(['tcgplayer.com', 'www.tcgplayer.com']);

function safeDestination(value: unknown) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || !ALLOWED_DEST_HOSTS.has(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function decorateTcgplayerAffiliateUrl(destination: unknown) {
  const safe = safeDestination(destination);
  if (!safe) return { url: null, affiliate: false };

  // Impact link formats vary by approved account/campaign. We therefore accept
  // only an explicit runtime template supplied after affiliate approval.
  // The template must contain `{url}` and must itself be HTTPS.
  const template = String(Deno.env.get('TCGPLAYER_AFFILIATE_URL_TEMPLATE') || '').trim();
  if (!template || !template.includes('{url}')) return { url: safe, affiliate: false };

  try {
    const tracked = template.replaceAll('{url}', encodeURIComponent(safe));
    const parsed = new URL(tracked);
    if (parsed.protocol !== 'https:') return { url: safe, affiliate: false };
    return { url: parsed.toString(), affiliate: true };
  } catch {
    return { url: safe, affiliate: false };
  }
}

export const TCGPLAYER_AFFILIATE_DISCLOSURE = 'Affiliate link: SwapPulse may earn a commission from qualifying TCGplayer purchases at no extra cost to you.';
