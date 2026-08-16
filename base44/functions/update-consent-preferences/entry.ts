// update-consent-preferences — upserts the user's ConsentRecord (GDPR/CCPA/UK
// DPA consent preferences). Auth required. Uses the user-scoped client so
// created_by_id is set correctly and RLS ownership is maintained. One record
// per user; called by the cookie consent banner and the Data & Privacy Rights
// settings tab.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const CONSENT_VERSION = '1.0';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    // Find existing record (user-scoped — RLS allows reading own record)
    const existing = await base44.entities.ConsentRecord
      .filter({}, '-created_date', 1)
      .catch(() => []);

    const cookieCategories = body.cookie_categories || {
      essential: true,
      analytics: !!body.analytics_consent,
      marketing: !!body.marketing_consent,
      functional: true,
    };

    const data: any = {
      user_id: user.id,
      did: user.did || '',
      cookie_categories: cookieCategories,
      do_not_sell: body.do_not_sell ?? false,
      marketing_consent: body.marketing_consent ?? true,
      analytics_consent: body.analytics_consent ?? true,
      notification_consent: body.notification_consent ?? true,
      consent_given_at: new Date().toISOString(),
      consent_version: CONSENT_VERSION,
    };

    let record;
    if (existing && existing.length > 0) {
      record = await base44.entities.ConsentRecord.update(existing[0].id, data);
    } else {
      record = await base44.entities.ConsentRecord.create(data);
    }

    return Response.json({ ok: true, record });
  } catch (error: any) {
    console.error('update-consent-preferences error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}