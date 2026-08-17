import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Generates a branded social share image for a given page path via the
// GenerateImage integration. Returns { url }. Called by pages that want a
// custom OG image beyond the default site banner.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    // Security: image generation via the service role costs integration
    // credits and is a DOS surface. Restrict to authenticated admins (pages
    // that need OG images are built/admin-triggered, not public).
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const path: string = body.path || '/';
    const label: string = body.label || 'SwapPulse';

    const prompt = `A premium social share banner for a Pokémon TCG collector community called SwapPulse. Dark midnight-vault background with subtle purple and gold rarity glow accents. Bold modern sans-serif title text "${label}". Clean, elegant, award-winning editorial layout. 1200x630 aspect ratio composition. No real people, no copyrighted Pokémon artwork — abstract card-collector aesthetic only.`;

    const result = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt });
    const url = result?.url || result?.data?.url || '';
    if (!url) {
      return Response.json({ error: 'Image generation returned no URL' }, { status: 502 });
    }
    return Response.json({ url, path });
  } catch (error) {
    console.error('seo-og-image error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}