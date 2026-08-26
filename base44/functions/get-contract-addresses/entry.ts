// get-contract-addresses — admin-only: returns the currently configured
// contract addresses so the admin dashboard can display already-deployed
// contracts without prompting for redeployment on every page load.
//
// Reads from the ContractRegistry entity first (persisted by the deploy-*
// functions, survives refreshes), then falls back to secrets for any
// contract that was deployed before the registry existed or set manually.

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

    // Persisted registry records (survive refresh).
    const registry = await base44.asServiceRole.entities.ContractRegistry
      .list('-deployed_at', 100).catch(() => []);
    const byKey: Record<string, any> = {};
    for (const r of registry) byKey[r.contract_key] = r;

    // Resolve an address: registry first, then secret fallback.
    const resolve = (key: string, secretName: string, explorer: string) => {
      const rec = byKey[key];
      if (rec?.address) {
        return {
          address: rec.address,
          explorerUrl: rec.explorer_url || (explorer ? `${explorer}/address/${rec.address}` : ''),
          txHash: rec.tx_hash || '',
          deployedAt: rec.deployed_at || '',
        };
      }
      const addr = secrets.get(secretName) || null;
      return {
        address: addr,
        explorerUrl: addr && explorer ? `${explorer}/address/${addr}` : '',
        txHash: '',
        deployedAt: '',
      };
    };

    return Response.json({
      polygon: {
        username: resolve('polygon_username', 'POLYGON_USERNAME_CONTRACT', polygonExplorer),
        card: resolve('polygon_card', 'POLYGON_CARD_CONTRACT', polygonExplorer),
        bridge: resolve('polygon_bridge', 'POLYGON_BRIDGE_CONTRACT', polygonExplorer),
        oft: resolve('oft_polygon', 'OFT_POLYGON_TOKEN_CONTRACT', polygonExplorer),
        explorerUrl: polygonExplorer,
      },
      pulse: {
        username: resolve('pulse_username', 'PULSE_SPUN_CONTRACT', pulseExplorer),
        card: resolve('pulse_card', 'PULSE_SPCD_CONTRACT', pulseExplorer),
        bridge: resolve('pulse_bridge', 'PULSE_BRIDGE_CONTRACT', pulseExplorer),
        oft: resolve('oft_pulse', 'OFT_PULSE_TOKEN_CONTRACT', pulseExplorer),
        token: resolve('pulse_token', 'PULSE_TOKEN_CONTRACT', pulseExplorer),
        cardMetadataAnchor: resolve('card_metadata_anchor', 'CARD_METADATA_ANCHOR_CONTRACT', pulseExplorer),
        explorerUrl: pulseExplorer,
      },
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}