import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Returns a sitemap.xml enumerating public static routes + dynamic entity-backed
// detail pages (posts, binders, circles, meetups, challenges, spaces, profiles).
// Each URL declares hreflang alternates (via xhtml:link) for all 9 SwapPulse
// supported locales — the app localises via ?lang=LOCALE, so each language
// variant lives at the same path with a different ?lang= value. An x-default
// alternate points at the lang-less canonical URL. Called by the SitemapXml
// page, which renders the XML with application/xml type.

const HREFLANG_LOCALES = [
  'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR',
  'ja-JP', 'zh-CN', 'ko-KR',
];

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Build the xhtml:link alternate block for a single <loc> URL: x-default
// (lang-less) + one entry per supported locale (?lang=LOCALE).
function alternates(loc: string): string {
  const lines = [`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(loc)}"/>`];
  for (const l of HREFLANG_LOCALES) {
    const sep = loc.includes('?') ? '&' : '?';
    lines.push(`    <xhtml:link rel="alternate" hreflang="${l}" href="${escapeXml(loc)}${sep}lang=${l}"/>`);
  }
  return lines.join('\n');
}

function urlEntry(loc: string, lastmod: string | null, changefreq: string, priority: string): string {
  const lm = lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : '';
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n${lm}    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n${alternates(loc)}\n  </url>`;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const origin = getAppUrl(req);

    const staticRoutes = [
      '/', '/explore', '/sets', '/trades', '/trade-board', '/packs', '/market',
      '/share', '/binders', '/trust', '/circles', '/meetups', '/profile',
      '/predictions', '/spaces', '/challenges', '/pack-parties', '/pull-of-the-week',
      '/help', '/status', '/donate', '/discover/users',
    ];

    const now = new Date().toISOString();
    const urls: string[] = [];

    for (const route of staticRoutes) {
      urls.push(urlEntry(`${origin}${route}`, now, 'daily', '0.8'));
    }

    // Dynamic entity-backed pages (service role — sitemap is public).
    const [posts, binders, circles, meetups, challenges, spaces] = await Promise.all([
      base44.asServiceRole.entities.Post.list('-created_date', 500).catch(() => []),
      base44.asServiceRole.entities.Binder.list('-created_date', 500).catch(() => []),
      base44.asServiceRole.entities.Circle.list('-created_date', 500).catch(() => []),
      base44.asServiceRole.entities.Meetup.list('-created_date', 500).catch(() => []),
      base44.asServiceRole.entities.Challenge.list('-created_date', 500).catch(() => []),
      base44.asServiceRole.entities.VoiceSpace.list('-created_date', 500).catch(() => []),
    ]);

    for (const p of posts) {
      if (p.id) urls.push(urlEntry(`${origin}/post/${p.id}`, p.updated_date || p.created_date || now, 'weekly', '0.6'));
    }
    for (const b of binders) {
      if (b.id) urls.push(urlEntry(`${origin}/binder/${b.id}`, b.updated_date || b.created_date || now, 'weekly', '0.5'));
    }
    for (const c of circles) {
      if (c.id) urls.push(urlEntry(`${origin}/circles/${c.id}`, c.updated_date || c.created_date || now, 'weekly', '0.5'));
    }
    for (const m of meetups) {
      if (m.id) urls.push(urlEntry(`${origin}/meetups/${m.id}`, m.updated_date || m.created_date || now, 'weekly', '0.5'));
    }
    for (const ch of challenges) {
      if (ch.id) urls.push(urlEntry(`${origin}/challenges/${ch.id}`, ch.updated_date || ch.created_date || now, 'weekly', '0.5'));
    }
    for (const s of spaces) {
      if (s.id) urls.push(urlEntry(`${origin}/spaces/${s.id}`, s.updated_date || s.created_date || now, 'weekly', '0.5'));
    }

    // Distinct profile DIDs from posts (members who have authored content).
    const dids = new Set<string>();
    for (const p of posts) {
      if (p.did) dids.add(p.did);
    }
    for (const did of dids) {
      urls.push(urlEntry(`${origin}/profile/${did}`, null, 'weekly', '0.5'));
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (error) {
    console.error('seo-sitemap error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function getAppUrl(req: Request): string {
  const custom = req.headers.get('X-Base44-App-Url');
  if (custom) {
    // Validate the header is a well-formed http(s) URL and return only its
    // origin — stripping any path/query and rejecting anything that isn't a
    // clean URL prevents XML/HTML injection into the sitemap <loc> elements.
    try {
      const parsed = new URL(custom);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return `${parsed.protocol}//${parsed.host}`;
      }
    } catch {
      // invalid URL — fall through to request-derived origin
    }
  }
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}