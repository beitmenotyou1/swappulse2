// get-set-buddies — privacy-contained during the collection privacy migration.
//
// The previous implementation used the service role to aggregate private
// CollectionEntry rows across users and returned other collectors' card IDs.
// That bypassed owner-only RLS. The feature is intentionally disabled until
// Phase 1 can source it from sanitised, explicitly published collection data.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const setId = String(body.set_id || '');
    if (!setId) {
      return Response.json({ error: 'set_id is required' }, { status: 400 });
    }

    return Response.json({
      buddies: [],
      total_collectors: 0,
      privacy_mode: true,
      message: 'Set Buddies is temporarily unavailable while collection privacy controls are being upgraded.',
    });
  } catch (error: any) {
    console.error('get-set-buddies privacy containment error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}
