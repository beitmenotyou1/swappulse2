// Shared enforcement helpers — used by feed generators and auth functions
// to check whether a user is shadow-banned or suspended.
//
// All lookups use the service role (bypasses RLS) so backend functions can
// read enforcement state for any user.
//
// getEnforcedUserIds() returns a Set of user_ids whose content should be
// hidden from public feeds (shadow_banned or suspended). Feed generators
// call this once per request and filter by created_by_id or did.
//
// isUserSuspended() returns the suspension record if the user is currently
// suspended (and the suspension hasn't expired). Used by verify-login-code.

import type { Base44Client } from 'npm:@base44/sdk@0.8.40';

export interface AccountStatusRecord {
  id: string;
  user_id: string;
  user_did: string;
  status: 'active' | 'shadow_banned' | 'suspended';
  suspended_until: string | null;
  suspension_reason: string;
  suspended_by: string;
  suspended_by_name: string;
  suspended_at: string;
  shadow_banned_by: string;
  shadow_banned_by_name: string;
  shadow_banned_at: string;
  shadow_ban_reason: string;
  reinstated_at: string;
  reinstated_by: string;
}

/**
 * Returns a Set of user_ids whose content should be hidden from public feeds.
 * Includes both shadow_banned and suspended users.
 * Call once per request and filter feed items by created_by_id membership.
 */
export async function getEnforcedUserIds(svc: any): Promise<Set<string>> {
  try {
    const records = await svc.entities.AccountStatus.filter(
      { status: { $in: ['shadow_banned', 'suspended'] } },
      '-updated_date',
      500,
    );
    return new Set((records || []).map((r: AccountStatusRecord) => r.user_id));
  } catch (e) {
    console.error('enforcement: getEnforcedUserIds failed', e?.message || e);
    return new Set();
  }
}

/**
 * Returns a Set of DIDs whose content should be hidden from public feeds.
 * Used by network-feed which filters by authorDid.
 */
export async function getEnforcedDids(svc: any): Promise<Set<string>> {
  try {
    const records = await svc.entities.AccountStatus.filter(
      { status: { $in: ['shadow_banned', 'suspended'] } },
      '-updated_date',
      500,
    );
    return new Set((records || []).map((r: AccountStatusRecord) => r.user_did).filter(Boolean));
  } catch (e) {
    console.error('enforcement: getEnforcedDids failed', e?.message || e);
    return new Set();
  }
}

/**
 * Returns the AccountStatus record for a user if they are currently suspended
 * (status === 'suspended' AND (suspended_until is null OR suspended_until is in the future).
 * Returns null if the user is not suspended.
 */
export async function getActiveSuspension(
  svc: any,
  userId: string,
): Promise<AccountStatusRecord | null> {
  try {
    const records = await svc.entities.AccountStatus.filter(
      { user_id: userId, status: 'suspended' },
      '-updated_date',
      1,
    );
    if (!records || records.length === 0) return null;
    const record = records[0];
    // Check if the suspension has expired
    if (record.suspended_until) {
      if (new Date(record.suspended_until) < new Date()) {
        return null; // Suspension has expired
      }
    }
    return record;
  } catch (e) {
    console.error('enforcement: getActiveSuspension failed', e?.message || e);
    return null;
  }
}

/**
 * Checks if an email or handle is on the BlockedRegistration blocklist.
 * Returns the matching blocklist record if blocked, null otherwise.
 */
export async function checkBlocklist(
  svc: any,
  email?: string,
  handle?: string,
): Promise<boolean> {
  try {
    const orParts: any[] = [];
    if (email) orParts.push({ email: email.toLowerCase() });
    if (handle) orParts.push({ handle: handle.toLowerCase() });
    if (orParts.length === 0) return false;
    const records = await svc.entities.BlockedRegistration.filter(
      { $or: orParts },
      '-blocked_at',
      1,
    );
    return !!(records && records.length > 0);
  } catch (e) {
    console.error('enforcement: checkBlocklist failed', e?.message || e);
    return false;
  }
}