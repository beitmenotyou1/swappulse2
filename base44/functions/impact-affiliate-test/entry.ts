// impact-affiliate-test — admin-only live verification for the Impact-backed
// TCGplayer affiliate path. Never returns credentials.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  decorateTcgplayerAffiliateUrl,
  getImpactAffiliatePolicy,
  getImpactAffiliateUsageStatus,
} from '../../shared/tcgplayerAffiliate.ts';

const DEFAULT_DESTINATION = 'https://www.tcgplayer.com/search/pokemon/product?page=1&productLineName=pokemon&productName=Furret&view=grid';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const destination = String(body?.destination || DEFAULT_DESTINATION).trim();
    const policy = getImpactAffiliatePolicy();

    if (!policy.configured) {
      return Response.json({
        configured: false,
        affiliate: false,
        reason: 'impact_not_configured',
        policy,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const result = await decorateTcgplayerAffiliateUrl(base44.asServiceRole, destination);
    const usage = await getImpactAffiliateUsageStatus(base44.asServiceRole).catch(() => null);

    let trackingHost = null;
    let destinationHost = null;
    try { trackingHost = result.url ? new URL(result.url).hostname : null; } catch {}
    try { destinationHost = new URL(destination).hostname; } catch {}

    return Response.json({
      configured: true,
      affiliate: Boolean(result.affiliate),
      fromCache: Boolean(result.fromCache),
      reason: result.reason || null,
      programId: result.programId || null,
      destinationHost,
      trackingHost,
      trackingUrl: result.affiliate ? result.url : null,
      fallbackUrl: result.affiliate ? null : result.url,
      policy,
      usage,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('impact-affiliate-test failed:', error instanceof Error ? error.message : String(error));
    return Response.json({
      configured: true,
      affiliate: false,
      reason: 'internal_error',
    }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }
}
