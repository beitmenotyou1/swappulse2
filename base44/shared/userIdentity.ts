// userIdentity.ts — shared helper for reading/writing a user's consolidated
// AT Protocol identity (did, pds_url, pds_app_password) from the User entity.
//
// This replaces the retired PdsCredential entity so the account is one cohesive
// identity record. The app password is AES-GCM encrypted at rest
// (APP_PASSWORD_ENCRYPTION_KEY) and decrypted on read. All backend functions
// that previously queried PdsCredential now call getUserIdentity instead.
//
// Migration: consolidate-identity copies existing PdsCredential records onto
// User.pds_url + User.pds_app_password (encrypted). After that runs, PdsCredential
// is no longer needed.

import { encryptPassword, decryptPassword } from './appPasswordCrypto.ts';

export interface UserIdentity {
  did: string;
  pdsUrl: string;
  appPassword: string; // decrypted plaintext
}

// Read a user's consolidated PDS identity from the User record.
// Returns null if the user has no did:plc, no pds_url, or no stored app password.
// Handles both encrypted (new) and plaintext (pre-consolidation) app passwords.
export async function getUserIdentity(svc: any, user: any): Promise<UserIdentity | null> {
  const did = user?.did;
  if (!did || !did.startsWith('did:plc:')) return null;
  const pdsUrl = user.pds_url || Deno.env.get('PDS_URL') || '';
  if (!pdsUrl) return null;
  const raw = user.pds_app_password;
  if (!raw) return null;

  let appPassword = '';
  // Try decrypt first (encrypted storage). Fall back to plaintext for
  // records not yet consolidated (or if the encryption key changed).
  try {
    appPassword = await decryptPassword(raw);
  } catch {
    appPassword = raw;
  }
  if (!appPassword) return null;

  return { did, pdsUrl, appPassword };
}

// Write a user's PDS identity onto the User record (encrypting the app password).
// Used by provision-identity, atproto-auth, and consolidate-identity.
export async function setUserIdentity(
  svc: any,
  userId: string,
  did: string,
  pdsUrl: string,
  appPassword: string,
): Promise<void> {
  const encrypted = await encryptPassword(appPassword);
  await svc.entities.User.update(userId, {
    did,
    pds_url: pdsUrl,
    pds_app_password: encrypted,
  });
}

// Resolve a per-user PDS session from the User record, or fall back to the
// shared bridge account. Replaces bridgeSession's PdsCredential lookup.
// Returns { pdsUrl, session } on success, or null if the user has no
// per-user credential (caller should use the shared session).
import { getPdsSessionForUser, getPdsSession } from './pdsSession.ts';

export async function resolveUserSession(svc: any, user: any): Promise<{ pdsUrl: string; session: any } | null> {
  const identity = await getUserIdentity(svc, user);
  if (!identity) return null;
  try {
    return await getPdsSessionForUser(identity.pdsUrl, identity.did, identity.appPassword);
  } catch (e) {
    console.error('userIdentity: per-user session failed', e?.message || e);
    return null;
  }
}

// Convenience: resolve a session for the calling user (authenticated), or
// fall back to the shared bridge session. Used by functions that have a
// Request and need a PDS session.
export async function resolveSessionForRequest(req: Request): Promise<{ pdsUrl: string; session: any }> {
  const pdsUrl = Deno.env.get('PDS_URL');
  if (!pdsUrl) throw new Error('PDS_URL not configured');

  try {
    const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.40');
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.did?.startsWith('did:plc:')) {
      const identity = await getUserIdentity(base44.asServiceRole, user);
      if (identity) {
        const session = await getPdsSessionForUser(identity.pdsUrl, identity.did, identity.appPassword);
        return { pdsUrl: identity.pdsUrl, session };
      }
    }
  } catch {
    // No auth context — use shared session
  }

  return getPdsSession();
}