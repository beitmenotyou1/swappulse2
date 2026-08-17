// Returns server-rendered HTML for crawlers that don't execute JavaScript.
// Produces a minimal but complete HTML document with meta tags + JSON-LD for
// the requested path, so search engines and social scrapers see real content.
export default async function(req: Request): Promise<Response> {
  try {
    const origin = getAppUrl(req);
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const rawPath = body.path || url.searchParams.get('path') || '/';
    const path = sanitizePath(rawPath);
    const title = titleForPath(path);
    const description = 'SwapPulse — the decentralized social network for Pokémon TCG collectors. Track your collection, trade cards, and build community on the AT Protocol.';

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'SwapPulse',
      url: origin,
      description,
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${origin}${path}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="${origin}${path}" />
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<h1>${title}</h1>
<p>${description}</p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (error) {
    console.error('seo-prerender error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function getAppUrl(req: Request): string {
  const custom = req.headers.get('X-Base44-App-Url');
  if (custom) return custom.replace(/\/$/, '');
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function sanitizePath(input: string): string {
  // Only allow safe URL path characters: letters, digits, /, -, _, ., ~.
  // Strip anything that could break out of an HTML attribute context (quotes,
  // angle brackets, etc.) and ensure the result starts with a single leading slash.
  if (typeof input !== 'string') return '/';
  const cleaned = input.replace(/[^a-zA-Z0-9\-_/.~]/g, '');
  const slash = cleaned.startsWith('/') ? cleaned : '/' + cleaned;
  return slash.replace(/\/+/g, '/') || '/';
}

function titleForPath(path: string): string {
  if (path === '/' || path === '') return 'SwapPulse — Pokémon TCG Collector Community';
  if (path.startsWith('/explore')) return 'Explore Cards — SwapPulse';
  if (path.startsWith('/sets')) return 'Set Checklists — SwapPulse';
  if (path.startsWith('/trades') || path.startsWith('/trade-board')) return 'Trade Board — SwapPulse';
  if (path.startsWith('/packs')) return 'Pack Openings — SwapPulse';
  if (path.startsWith('/market')) return 'Market Watch — SwapPulse';
  if (path.startsWith('/challenges')) return 'Community Challenges — SwapPulse';
  if (path.startsWith('/meetups')) return 'Collector Meetups — SwapPulse';
  if (path.startsWith('/spaces')) return 'Voice Spaces — SwapPulse';
  if (path.startsWith('/circles')) return 'Circles — SwapPulse';
  if (path.startsWith('/help')) return 'Help Centre — SwapPulse';
  if (path.startsWith('/status')) return 'System Status — SwapPulse';
  if (path.startsWith('/profile/')) return 'Collector Profile — SwapPulse';
  if (path.startsWith('/post/')) return 'Post — SwapPulse';
  if (path.startsWith('/card/')) return 'Card Details — SwapPulse';
  return 'SwapPulse — Pokémon TCG Collector Community';
}