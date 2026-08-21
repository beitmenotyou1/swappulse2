// bridgeSession.ts — shared PDS session resolution for AT Protocol bridge
// functions. Resolves a per-user session (when the caller has a real did:plc
// + stored PdsCredential) or falls back to the shared bridge account.
//
// Used by atproto-bridge and migrate-to-swappulse / unmove-from-bluesky so both
// share one session resolution implementation instead of duplicating logic.

import { getPdsSession, getPdsSessionForUser } from './pdsSession.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export async function resolveBridgeSession(req: Request): Promise<{ pdsUrl: string; session: { accessJwt: string; refreshJwt: string; did: string; handle: string; expiresAt: number } }> {
  const pdsUrl = Deno.env.get('PDS_URL');
  if (!pdsUrl) throw new Error('PDS_URL not configured');

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.did?.startsWith('did:plc:')) {
      const creds = await base44.asServiceRole.entities.PdsCredential
        .filter({ user_id: user.id }).catch(() => []);
      if (creds && creds.length > 0 && creds[0].app_password) {
        try {
          return await getPdsSessionForUser(pdsUrl, user.did, creds[0].app_password);
        } catch (e) {
          console.error('bridgeSession: per-user session failed, falling back to shared', e?.message || e);
        }
      }
    }
  } catch {
    // No auth context (e.g. unauthenticated call) — use shared session
  }

  return getPdsSession();
}