// consentCheck.ts — shared helpers for checking user consent preferences under
// GDPR, CCPA, and the UK Data Protection Act. Used by:
//   - outbound federation (outbound-reconcile, initial-push) to skip users
//     who opted out of sale/sharing (do_not_sell = true)
//   - communication dispatchers (onboarding emails, weekly digest, push) to
//     skip users who withdrew marketing or notification consent
//
// All functions take a service-role client (svc = base44.asServiceRole) and
// operate on a consent map built from the ConsentRecord entity. Missing record
// = defaults (all consent true, do_not_sell false) — the opt-out model.

export interface ConsentRecord {
  user_id: string;
  did: string;
  cookie_categories?: { essential?: boolean; analytics?: boolean; marketing?: boolean; functional?: boolean };
  do_not_sell?: boolean;
  marketing_consent?: boolean;
  analytics_consent?: boolean;
  notification_consent?: boolean;
  consent_given_at?: string;
  consent_version?: string;
}

// Fetches all ConsentRecords and returns a Map keyed by user_id.
// Service-role only — call from backend functions with svc = base44.asServiceRole.
export async function getConsentMap(svc: any): Promise<Map<string, ConsentRecord>> {
  const map = new Map<string, ConsentRecord>();
  try {
    const records = await svc.entities.ConsentRecord.list('-created_date', 500);
    for (const r of (records || []) as any[]) {
      if (r.user_id) map.set(r.user_id, r as ConsentRecord);
    }
  } catch (e: any) {
    console.error('consentCheck: failed to load consent records', e?.message || e);
  }
  return map;
}

// Returns true if the user has opted out of sale/sharing (CCPA).
// When true, outbound federation must be skipped for this user.
export function isDoNotSell(consent: ConsentRecord | undefined): boolean {
  return !!consent?.do_not_sell;
}

// Returns true if the user has marketing consent (onboarding emails, digest).
// Default true (opt-out model) unless explicitly set to false.
export function hasMarketingConsent(consent: ConsentRecord | undefined): boolean {
  return consent?.marketing_consent !== false;
}

// Returns true if the user has notification consent (push notifications).
// Default true (opt-out model) unless explicitly set to false.
export function hasNotificationConsent(consent: ConsentRecord | undefined): boolean {
  return consent?.notification_consent !== false;
}