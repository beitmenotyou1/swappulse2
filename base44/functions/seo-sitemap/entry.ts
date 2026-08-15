import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Returns a sitemap.xml enumerating public static routes + dynamic entity-backed
// detail pages (posts, binders, circles, meetups, challenges, spaces, profiles).
// Called by the SitemapXml page, which renders the XML with application/xml type.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const origin = getAppUrl(req);

    const staticRoutes = [
      '/', '/explore', '/sets', '/trades', '/trade-board', '/packs', '/market',
      '/share', '/binders', '/trust', '/circles', '/meetups', '/profile',
      '/predictions', '/spaces', '/challenges', '/pack-parties', '/pull-of-the-week',
      '/help', '/status', '/donate',
    ];

    const now = new Date().toISOString();
    const urls: string[] = [];

    for (const route of staticRoutes) {
      urls.push(`  <url><loc>${origin}${route}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`);
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
      if (p.id) urls.push(`  <url><loc>${origin}/post/${p.id}</loc><lastmod>${(p.updated_date || p.created_date || now)}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`);
    }
    for (const b of binders) {
      if (b.id) urls.push(`  <url><loc>${origin}/binder/${b.id}</loc><lastmod>${(b.updated_date || b.created_date || now)}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>`);
    }
    for (const c of circles) {
      if (c.id) urls.push(`  <url><loc>${origin}/circles/${c.id}</loc><lastmod>${(c.updated_date || c.created_date || now)}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>`);
    }
    for (const m of meetups) {
      if (m.id) urls.push(`  <url><loc>${origin}/meetups/${m.id}</loc><lastmod>${(m.updated_date || m.created_date || now)}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>`);
    }
    for (const ch of challenges) {
      if (ch.id) urls.push(`  <url><loc>${origin}/challenges/${ch.id}</loc><lastmod>${(ch.updated_date || ch.created_date || now)}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>`);
    }
    for (const s of spaces) {
      if (s.id) urls.push(`  <url><loc>${origin}/spaces/${s.id}</loc><lastmod>${(s.updated_date || s.created_date || now)}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>`);
    }

    // Distinct profile DIDs from posts (members who have authored content).
    const dids = new Set<string>();
    for (const p of posts) {
      if (p.did) dids.add(p.did);
    }
    for (const did of dids) {
      urls.push(`  <url><loc>${origin}/profile/${did}</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;

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
  if (custom) return custom.replace(/\/$/, '');
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}