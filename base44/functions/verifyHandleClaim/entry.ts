// org.swappulse.handleClaim verification - confirms a user owns a custom domain
// by looking up the AT Protocol handle TXT record (_atproto.<domain>) via
// DNS-over-HTTPS, with an HTML well-known fallback. Returns the verification
// result; the caller persists the HandleClaim record and updates the user.
//
// Security: requires an authenticated user, strictly validates that `domain`
// is a public hostname (blocking IP addresses, loopback, private/internal
// suffixes, and metadata endpoints), and disables HTTP redirect following so
// an attacker cannot redirect the outbound fetch to an internal target.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function isValidPublicDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  // Block IPv4 addresses (covers 169.254.169.254, 127.x, 10.x, 192.168.x, etc.).
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) return false;
  // Block IPv6 or anything with a port.
  if (domain.includes(':')) return false;
  // Must be a valid hostname with a dot.
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(domain)) return false;
  if (!domain.includes('.')) return false;
  const blocked = ['localhost', 'local', 'internal', 'arpa', 'example', 'invalid', 'test', 'onion', 'metadata'];
  const tld = domain.split('.').pop()!.toLowerCase();
  if (blocked.includes(tld) || blocked.includes(domain)) return false;
  return true;
}

Deno.serve(async (req) => {
  try {
    // Require authentication — only logged-in users can trigger domain verification.
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const domain = String(body.domain || '').trim().toLowerCase();
    const did = String(body.did || '').trim();
    if (!domain || !did) {
      return Response.json({ error: 'domain and did are required' }, { status: 400 });
    }
    if (!isValidPublicDomain(domain)) {
      return Response.json({ error: 'Invalid or non-public domain' }, { status: 400 });
    }

    const txtName = `_atproto.${domain}`;
    // Parallelize the two independent verification fetches (DNS-over-HTTPS + well-known HTML).
    let txtRecords = [];
    let txtMatch = false;
    let htmlMatch = false;
    const [dohResult, htmlResult] = await Promise.allSettled([
      fetch(`https://dns.google/resolve?name=${encodeURIComponent(txtName)}&type=TXT`).then((r) => r.json()),
      fetch(`https://${domain}/.well-known/atproto-did`, { redirect: 'error' }).then(async (r) => {
        if (r.ok) return (await r.text()).trim();
        return '';
      }),
    ]);
    if (dohResult.status === 'fulfilled') {
      txtRecords = (dohResult.value?.Answer || [])
        .filter((a) => a.type === 16)
        .map((a) => String(a.data || '').replace(/"/g, ''));
      txtMatch = txtRecords.some((t) => t.includes(`did=${did}`));
    } else {
      console.error('handleClaim DNS lookup failed', dohResult.reason?.message || dohResult.reason);
    }
    if (htmlResult.status === 'fulfilled') {
      htmlMatch = htmlResult.value === did;
    } else {
      console.error('handleClaim well-known fetch failed', htmlResult.reason?.message || htmlResult.reason);
    }

    const verified = txtMatch || htmlMatch;
    const method = txtMatch ? 'txt_record' : htmlMatch ? 'html_file' : null;

    return Response.json({ verified, method, domain, did, txtRecords });
  } catch (error) {
    console.error('verifyHandleClaim error', error?.message || error);
    return Response.json({ error: error?.message || 'verification failed' }, { status: 500 });
  }
});