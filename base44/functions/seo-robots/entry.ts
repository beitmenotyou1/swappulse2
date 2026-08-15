// Returns robots.txt allowing all crawlers and pointing to the sitemap.
// Called by the RobotsTxt page, which renders it as text/plain.
export default async function(req: Request): Promise<Response> {
  try {
    const origin = getAppUrl(req);
    const body = `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (error) {
    console.error('seo-robots error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function getAppUrl(req: Request): string {
  const custom = req.headers.get('X-Base44-App-Url');
  if (custom) return custom.replace(/\/$/, '');
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}