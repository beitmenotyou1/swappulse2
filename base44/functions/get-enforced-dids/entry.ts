// get-enforced-dids — public endpoint returning user IDs and DIDs of
// shadow-banned or suspended users. Used by client-side pages (TradeBoard,
// TradeStatusBoard) to filter content from enforced users. Returns only IDs,
// no PII.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    // Require an authenticated session — the penalized-ID list must not be
    // publicly scrapable. Unauthenticated callers get empty arrays (client
    // pages already handle empty results, so public browsing is unaffected).
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ dids: [], user_ids: [] });
    const svc = base44.asServiceRole;
    const records = await svc.entities.AccountStatus.filter(
      { status: { $in: ['shadow_banned', 'suspended'] } },
      '-updated_date',
      500,
    ).catch(() => []);
    const dids = (records || []).map((r: any) => r.user_did).filter(Boolean);
    const user_ids = (records || []).map((r: any) => r.user_id).filter(Boolean);
    return Response.json({ dids, user_ids });
  } catch (e) {
    console.error('get-enforced-dids error', e?.message);
    return Response.json({ dids: [], user_ids: [] });
  }
}