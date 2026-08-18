// publish-standard-publication — creates or retrieves the SwapPulse
// site.standard.publication record on the shared bridge PDS. Admin-triggered
// (from the Admin dashboard or the Register Lexicons workflow). Idempotent:
// if a StandardSiteConfig row already exists, returns the stored URI.
//
// The publication is verified against the swappulse.org domain via the
// /.well-known/site.standard.publication route, which returns the publication
// at:// URI so external verifiers can confirm the publication belongs to the
// site.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ensureSitePublication } from '../../shared/standardSite.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { uri, did } = await ensureSitePublication(base44);
    return Response.json({ ok: true, uri, did });
  } catch (error) {
    console.error('publish-standard-publication error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});