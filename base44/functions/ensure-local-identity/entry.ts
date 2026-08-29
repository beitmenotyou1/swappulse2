// ensure-local-identity — authenticated helper for the legacy/simulated AT-style
// record signer used by the browser UI. The User.did and User.signing_key fields
// are backend-managed so a modified client cannot impersonate another DID or
// overwrite signing material directly.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

function randomBase32(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += BASE32[bytes[i] % 32];
  return out;
}

function generateLocalDid(): string {
  // Deliberately not did:plc. A local fallback must never be mistaken for a
  // PLC identity that was successfully created on the PDS.
  return `did:swappulse:${randomBase32(24)}`;
}

function generateSigningKey(): string {
  return `sk_${randomBase32(32)}`;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = String(me.did || '').trim() || generateLocalDid();
    const signingKey = String(me.signing_key || '').trim() || generateSigningKey();

    if (did !== me.did || signingKey !== me.signing_key) {
      await base44.asServiceRole.entities.User.update(me.id, {
        did,
        signing_key: signingKey,
      });
    }

    return Response.json({ did, signingKey });
  } catch (error) {
    console.error('ensure-local-identity error:', error?.message || error);
    return Response.json({ error: 'Could not initialise identity' }, { status: 500 });
  }
}
