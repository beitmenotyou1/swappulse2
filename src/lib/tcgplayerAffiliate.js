const TCGPLAYER_HOSTS = new Set(['tcgplayer.com', 'www.tcgplayer.com']);

function safeTcgplayerUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || !TCGPLAYER_HOSTS.has(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function affiliateTemplate() {
  // This is intentionally a public, non-secret build-time setting. Do not put
  // Impact credentials or private tokens here. The template must contain
  // `{url}` and is only configured after TCGplayer/Impact affiliate approval.
  return String(import.meta.env?.VITE_TCGPLAYER_AFFILIATE_URL_TEMPLATE || '').trim();
}

export function tcgplayerOutboundLink(destination) {
  const safe = safeTcgplayerUrl(destination);
  if (!safe) return { url: null, affiliate: false };

  const template = affiliateTemplate();
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
