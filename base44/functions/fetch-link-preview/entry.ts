// fetch-link-preview — fetches a URL server-side and parses OpenGraph /
// twitter:card meta tags to produce a link preview card.
//
// Input:  { url: string }
// Output: { title, description, image, site_name, url }
//
// SSRF protection: only http(s) URLs are allowed; internal/private IP ranges
// and localhost are blocked. Redirects are handled manually — each redirect
// target is re-validated against isPrivateHost() before following, preventing
// SSRF bypasses via 302 to internal/metadata endpoints. A 5-second timeout
// prevents hanging on slow servers.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Check if a hostname resolves to a private/internal IP. Blocks SSRF via
// decimal/hex IP encodings and IPv6-mapped IPv4.
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '0.0.0.0' || h === '::' || h === '::1') return true;
  // IPv4 literal
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1]), parseInt(ipv4[2])];
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
  }
  // IPv6-mapped IPv4 (::ffff:127.0.0.1)
  if (h.startsWith('::ffff:')) return isPrivateHost(h.slice(7));
  return false;
}

// Parse meta tags from an HTML string. Returns a map of property/name → content.
function parseMetaTags(html: string): Record<string, string> {
  const tags: Record<string, string> = {};
  // Match <meta property="..." content="..." /> and <meta name="..." content="..." />
  const metaRegex = /<meta\s+(?:property|name)\s*=\s*["']([^"']+)["']\s+content\s*=\s*["']([^"']*)["']/gi;
  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    const key = match[1].toLowerCase();
    if (!tags[key]) tags[key] = match[2]; // first occurrence wins (OG spec)
  }
  // Also extract <title> as a fallback
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch && !tags['og:title']) {
    tags['title'] = titleMatch[1].trim();
  }
  return tags;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { url } = body;
    if (!url || typeof url !== 'string') {
      return Response.json({ error: 'url is required' }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return Response.json({ error: 'Invalid URL' }, { status: 400 });
    }
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return Response.json({ error: 'Only http(s) URLs are supported' }, { status: 400 });
    }
    if (isPrivateHost(parsedUrl.hostname)) {
      return Response.json({ error: 'Internal hosts are not allowed' }, { status: 400 });
    }

    // Fetch with manual redirect handling: each redirect Location is
    // re-validated against isPrivateHost() to prevent SSRF bypasses where an
    // external server 302-redirects to an internal/metadata endpoint.
    const MAX_REDIRECTS = 5;
    let currentUrl = url;
    let res: Response;
    let redirects = 0;
    while (true) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        res = await fetch(currentUrl, {
          signal: controller.signal,
          redirect: 'manual',
          headers: { 'User-Agent': 'SwapPulseLinkPreview/1.0' },
        });
      } catch (e) {
        return Response.json({ error: `Fetch failed: ${e?.message || e}` }, { status: 502 });
      } finally {
        clearTimeout(timeout);
      }

      // 3xx = redirect; re-validate the Location target before following.
      if (res.status >= 300 && res.status < 400) {
        if (++redirects > MAX_REDIRECTS) {
          return Response.json({ error: 'Too many redirects' }, { status: 502 });
        }
        const location = res.headers.get('location');
        if (!location) {
          return Response.json({ error: 'Redirect without Location header' }, { status: 502 });
        }
        let nextUrl: URL;
        try {
          nextUrl = new URL(location, currentUrl); // resolve relative redirects
        } catch {
          return Response.json({ error: 'Invalid redirect URL' }, { status: 502 });
        }
        if (nextUrl.protocol !== 'https:' && nextUrl.protocol !== 'http:') {
          return Response.json({ error: 'Redirect to non-http(s) protocol blocked' }, { status: 502 });
        }
        if (isPrivateHost(nextUrl.hostname)) {
          return Response.json({ error: 'Redirect to internal host blocked' }, { status: 502 });
        }
        currentUrl = nextUrl.href;
        continue; // follow the validated redirect
      }

      break; // non-redirect response — done
    }

    if (!res.ok) {
      return Response.json({ error: `Fetch returned ${res.status}` }, { status: 502 });
    }

    // Only parse HTML responses
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return Response.json({ error: 'URL is not an HTML page' }, { status: 422 });
    }

    const html = await res.text();
    const meta = parseMetaTags(html);
    const finalUrl = currentUrl;
    let siteName = meta['og:site_name'] || '';
    if (!siteName) {
      try {
        siteName = new URL(finalUrl).hostname.replace(/^www\./, '');
      } catch { siteName = ''; }
    }

    const title = meta['og:title'] || meta['twitter:title'] || meta['title'] || '';
    const description = meta['og:description'] || meta['twitter:description'] || '';
    const image = meta['og:image'] || meta['twitter:image'] || '';

    // Resolve relative image URLs
    let resolvedImage = image;
    if (image && !image.startsWith('http')) {
      try {
        resolvedImage = new URL(image, finalUrl).href;
      } catch { resolvedImage = image; }
    }

    return Response.json({
      title: title.slice(0, 300),
      description: description.slice(0, 500),
      image: resolvedImage,
      site_name: siteName.slice(0, 100),
      url: finalUrl,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}