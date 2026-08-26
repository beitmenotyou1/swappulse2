// get-contract-addresses — admin-only: returns the currently configured
// contract addresses from secrets so the admin dashboard can display
// already-deployed contracts without prompting for redeployment on every
// page load. Reads Polygon and PulseChain contract addresses + explorer URLs.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const polygonExplorer = secrets.get('POLYGON_EXPLORER_URL') || 'https://amoy.polygonscan.com';
    const pulseExplorer = secrets.get('PULSE_EXPLORER_URL') || '';

    return Response.json({
      polygon: {
        username: secrets.get('POLYGON_USERNAME_CONTRACT') || null,
        card: secrets.get('POLYGON_CARD_CONTRACT') || null,
        bridge: secrets.get('POLYGON_BRIDGE_CONTRACT') || null,
        explorerUrl: polygonExplorer,
      },
      pulse: {
        username: secrets.get('PULSE_SPUN_CONTRACT') || null,
        card: secrets.get('PULSE_SPCD_CONTRACT') || null,
        bridge: secrets.get('PULSE_BRIDGE_CONTRACT') || null,
        explorerUrl: pulseExplorer,
      },
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}