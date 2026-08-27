// get-trails-config — returns the Polygon Cross-chain SDK (Trails) access key
// to the frontend so the on-ramp widget can initialise. The access key is
// publishable (safe for client-side use, like a Stripe publishable key) — get
// yours from https://dashboard.trails.build/. See
// https://docs.polygon.technology/cross-chain/sdk
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Verify the caller is an authenticated SwapPulse user before returning
    // payment configuration.
    try {
      const me = await base44.auth.me();
      if (!me?.id) throw new Error('unauthenticated');
    } catch {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const accessKey = secrets.get('TRAILS_ACCESS_KEY') || '';
    return Response.json({ accessKey, enabled: !!accessKey });
  } catch (error) {
    return Response.json({ error: 'unavailable' }, { status: 500 });
  }
}