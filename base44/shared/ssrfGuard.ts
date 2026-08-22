// ssrfGuard — resolves a hostname via DNS and verifies none of the resolved
// IP addresses fall within private, loopback, link-local, or cloud-metadata
// ranges. Used by outbound-fetching backend functions (atproto-auth,
// fetch-link-preview) to block SSRF via wildcard-DNS / custom-domain tricks
// (e.g. 169.254.169.254.nip.io resolving to a metadata endpoint).

// Returns true if the given IP literal (IPv4 or IPv6) is private/loopback/
// link-local/multicast/reserved or a cloud-metadata address.
export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, '');
  // IPv6-mapped IPv4 (::ffff:127.0.0.1)
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  // IPv6 loopback / unspecified / link-local / unique-local
  if (v === '::1' || v === '::' || v === '0:0:0:0:0:0:0:0' || v === '0:0:0:0:0:0:0:1') return true;
  if (v.startsWith('fe80:')) return true;
  if (v.startsWith('fc') || v.startsWith('fd')) return true;
  // IPv4 literal
  const m = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (a === 0) return true;                          // 0.0.0.0/8
    if (a === 10) return true;                         // 10.0.0.0/8
    if (a === 127) return true;                        // 127.0.0.0/8 (loopback)
    if (a === 169 && b === 254) return true;           // 169.254.0.0/16 (link-local + metadata)
    if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
    if (a === 192 && b === 168) return true;           // 192.168.0.0/16
    if (a >= 224) return true;                         // 224.0.0.0/4 (multicast/reserved)
  }
  return false;
}

// Resolves hostname to IP addresses and throws if any resolved IP is private.
// IP literals are checked directly without DNS. Throws on resolution failure
// or if any resolved address is in a blocked range (fail-closed).
export async function assertSafeHost(hostname: string): Promise<void> {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost')) {
    throw new Error('Internal hosts are not allowed.');
  }
  // IP literal — validate directly (no DNS needed).
  if (isPrivateIp(h)) throw new Error('Internal hosts are not allowed.');

  // Resolve via DNS and check every resolved address.
  let addresses: string[] = [];
  try {
    const a = await Deno.resolveDns(h, 'A').catch(() => [] as string[]);
    const aaaa = await Deno.resolveDns(h, 'AAAA').catch(() => [] as string[]);
    addresses = [...(a || []), ...(aaaa || [])];
  } catch {
    // DNS resolution unavailable — fail closed.
    throw new Error('Could not resolve host.');
  }
  if (addresses.length === 0) {
    throw new Error('Could not resolve host.');
  }
  for (const addr of addresses) {
    if (isPrivateIp(addr)) {
      throw new Error('Host resolves to a private/internal address.');
    }
  }
}