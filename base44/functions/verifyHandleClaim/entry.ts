// Verify and persist a custom handle for the signed-in account. A DNS TXT
// proof must bind the domain to the immutable account DID. Only this backend
// writes the trust badge and claim. No requests are sent to the claimed host.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSessionForUser, pdsRequest } from '../../shared/pdsSession.ts';
import { getUserIdentity } from '../../shared/userIdentity.ts';

function isValidPublicDomain(domain: string): boolean {
  if (!domain || domain.length > 253 || !/^[a-z0-9.-]+$/.test(domain)) return false;
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some((s) => !s || s.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(s))) return false;
  const tld = labels[labels.length - 1];
  if (!/^(?:[a-z]{2,}|xn--[a-z0-9-]{2,})$/.test(tld)) return false;
  return !['localhost', 'local', 'internal', 'arpa', 'example', 'invalid', 'test', 'onion', 'metadata'].includes(tld);
}

async function hasDidProof(domain: string, did: string): Promise<boolean> {
  const name = '_atproto.' + domain;
  // A fixed DNS-over-HTTPS origin removes the custom-domain SSRF path.
  const response = await fetch('https://dns.google/resolve?name=' + encodeURIComponent(name) + '&type=TXT', {
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
    headers: { accept: 'application/dns-json' },
  });
  if (!response.ok) throw new Error('DNS verification is unavailable');
  if (Number(response.headers.get('content-length') || 0) > 65536) throw new Error('DNS reply too large');
  const raw = await response.text();
  if (raw.length > 65536) throw new Error('DNS reply too large');
  const answer = JSON.parse(raw);
  if (answer.Status !== 0 || !Array.isArray(answer.Answer)) return false;
  return answer.Answer.some((row: any) =>
    row.type === 16 && String(row.data || '').replace(/"/g, '').trim() === 'did=' + did
  );
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorised' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    // A caller may not substitute a different account's DID.
    if (body.did !== undefined) return Response.json({ error: 'DID is derived from your account' }, { status: 400 });
    const did = String(user.did || '').trim();
    if (!did.startsWith('did:plc:')) return Response.json({ error: 'A linked federated identity is required' }, { status: 400 });
    const domain = String(body.domain || '').trim().toLowerCase();
    if (!isValidPublicDomain(domain)) return Response.json({ error: 'Invalid domain' }, { status: 400 });
    const verified = await hasDidProof(domain, did);
    if (!verified) return Response.json({ verified: false, domain });

    const identity = await getUserIdentity(base44.asServiceRole, user);
    if (!identity) return Response.json({ error: 'Re-link your federated identity before updating the handle' }, { status: 400 });
    const { pdsUrl, session } = await getPdsSessionForUser(identity.pdsUrl, did, identity.appPassword);
    const result = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.identity.updateHandle', { handle: domain });
    if (result?.error) return Response.json({ error: 'Your PDS did not accept this handle yet. Check your DNS record and retry.' }, { status: 409 });

    const svc = base44.asServiceRole;
    const now = new Date().toISOString();
    const claim = {
      domain, did, verification_method: 'txt_record', status: 'verified',
      verified_at: now, claimed_at: now,
      legacy_handle: (user.username || 'collector') + '.swappulse.org',
    };
    const existing = await svc.entities.HandleClaim.filter({ domain, created_by_id: user.id }, '-created_date', 1);
    if (existing.length) await svc.entities.HandleClaim.update(existing[0].id, claim);
    else await svc.entities.HandleClaim.create({ ...claim, created_by_id: user.id });
    await svc.entities.User.update(user.id, {
      custom_handle: domain, handle_verified: true, bsky_handle: domain,
    });
    return Response.json({ verified: true, method: 'txt_record', domain, did });
  } catch (error) {
    console.error('verifyHandleClaim error', error?.message || error);
    return Response.json({ error: 'Handle verification failed. Please retry.' }, { status: 503 });
  }
});
