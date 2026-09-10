// bridgeSession.ts — shared PDS session resolution for AT Protocol bridge
// functions. Resolves a per-user session (when the caller has a real did:plc
// + consolidated pds_app_password on their User record) or falls back to the
// shared bridge account.
//
// Used by atproto-bridge and migrate-to-swappulse / unmove-from-bluesky so both
// share one session resolution implementation instead of duplicating logic.
//
// NOTE: This now reads identity from the User entity (consolidated) via the
// userIdentity helper, not the retired PdsCredential entity.

import { getPdsSession, getPdsSessionForUser } from './pdsSession.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getUserIdentity } from './userIdentity.ts';

export async function resolveBridgeSession(req: Request): Promise<{ pdsUrl: string; session: { accessJwt: string; refreshJwt: string; did: string; handle: string; expiresAt: number } }> {
  const pdsUrl = Deno.env.get('PDS_URL');
  if (!pdsUrl) throw new Error('PDS_URL not configured');

  let user: any = null;
  try {
    const base44 = createClientFromRequest(req);
    user = await base44.auth.me();
    if (user?.did?.startsWith('did:plc:')) {
      const identity = await getUserIdentity(base44.asServiceRole, user);
      if (!identity) {
        throw new Error('Personal AT Protocol credentials are missing. Reconnect the account in Settings.');
      }
      return await getPdsSessionForUser(
        identity.pdsUrl,
        identity.did,
        identity.appPassword,
      );
    }
  } catch (error) {
    // A linked identity must fail closed. Falling back to the shared account
    // could publish an administrator's post under the wrong DID.
    if (user?.did?.startsWith('did:plc:')) throw error;
  }

  // The shared bridge account is reserved for callers that have no personal
  // DID, such as explicitly configured service-owned records.
  return getPdsSession();
}