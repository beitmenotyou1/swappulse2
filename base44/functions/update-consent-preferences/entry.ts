// update-consent-preferences — upserts the user's ConsentRecord (GDPR/CCPA/UK
// DPA consent preferences). Auth required. Uses a server-owned writer and binds
// every record to the authenticated account. One record
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

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ error: 'Invalid preferences' }, { status: 400 });
    }

    // Identity and the existing row are resolved by the server. A collector
    // cannot create another user's consent record or rewrite its subject DID.
    const svc = base44.asServiceRole;
    const existing = await svc.entities.ConsentRecord.filter(
      { created_by_id: user.id, user_id: user.id }, '-created_date', 1
    );
    const current = existing?.[0] || {};
    const requested = body.cookie_categories && typeof body.cookie_categories === 'object'
      && !Array.isArray(body.cookie_categories) ? body.cookie_categories : {};
    const supplied = (value: any, key: string) => Object.prototype.hasOwnProperty.call(value, key);
    const enabled = (value: any) => value === true;
    // A partial update never resets a separate consent or privacy setting.
    // Unset optional consents default to off until explicitly granted.
    const analytics = supplied(body, 'analytics_consent') ? enabled(body.analytics_consent)
      : supplied(requested, 'analytics') ? enabled(requested.analytics) : current.analytics_consent === true;
    const marketing = supplied(body, 'marketing_consent') ? enabled(body.marketing_consent)
      : supplied(requested, 'marketing') ? enabled(requested.marketing) : current.marketing_consent === true;
    const cookieCategories = {
      essential: true,
      analytics,
      marketing,
      functional: supplied(requested, 'functional') ? enabled(requested.functional)
        : current.cookie_categories?.functional !== false,
    };
    const data: any = {
      user_id: user.id,
      did: user.did || '',
      cookie_categories: cookieCategories,
      do_not_sell: supplied(body, 'do_not_sell') ? enabled(body.do_not_sell) : current.do_not_sell === true,
      marketing_consent: marketing,
      analytics_consent: analytics,
      notification_consent: supplied(body, 'notification_consent')
        ? enabled(body.notification_consent) : current.notification_consent === true,
      consent_given_at: new Date().toISOString(),
      consent_version: CONSENT_VERSION,
    };

    const record = current.id
      ? await svc.entities.ConsentRecord.update(current.id, data)
      : await svc.entities.ConsentRecord.create({ ...data, created_by_id: user.id });

    return Response.json({ ok: true, record });
  } catch (error: any) {
    console.error('update-consent-preferences error:', error?.message || error);
    return Response.json({ error: 'Could not update consent preferences' }, { status: 500 });
  }
}