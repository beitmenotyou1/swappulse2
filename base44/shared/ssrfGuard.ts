// ssrfGuard — resolves a hostname via DNS and verifies none of the resolved
// IP addresses fall within private, loopback, link-local, carrier-grade NAT,
// documentation, benchmark, multicast, reserved or cloud-metadata ranges.
//
// Some managed runtimes do not grant Deno.resolveDns. In that case, the guard
// falls back to Cloudflare's fixed HTTPS DNS endpoint. It still fails closed
// unless at least one syntactically valid address is returned and every
// returned address is public.

const DNS_QUERY_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
const DNS_QUERY_TIMEOUT_MS = 5_000;

function parseIpv4(value: string): number[] | null {
  const match = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return null;
  const octets = match.slice(1).map(Number);
  return octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? octets
    : null;
}

function isIpLiteral(value: string): boolean {
  if (parseIpv4(value)) return true;
  if (!value.includes(':') || !/^[0-9a-f:.]+$/i.test(value)) return false;
  if ((value.match(/::/g) || []).length > 1) return false;

  const parts = value.split('::');
  const left = parts[0] ? parts[0].split(':') : [];
  const right = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  const segments = [...left, ...right];
  let segmentCount = 0;

  for (const segment of segments) {
    if (segment.includes('.')) {
      if (!parseIpv4(segment)) return false;
      segmentCount += 2;
    } else {
      if (!/^[0-9a-f]{1,4}$/i.test(segment)) return false;
      segmentCount += 1;
    }
  }

  return parts.length === 2 ? segmentCount < 8 : segmentCount === 8;
}

// Returns true if the given IP literal (IPv4 or IPv6) is private, loopback,
// link-local, multicast, reserved or otherwise unsuitable for outbound fetches.
export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, '');
  const ipv4 = parseIpv4(v);

  if (ipv4) {
    const [a, b, c] = ipv4;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 0 && c === 0) return true;
    if (a === 192 && b === 0 && c === 2) return true;
    if (a === 192 && b === 168) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    if (a >= 224) return true;
    return false;
  }

  // IPv4 embedded in IPv6, including mapped forms.
  const embeddedIpv4 = v.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  if (embeddedIpv4 && isPrivateIp(embeddedIpv4)) return true;

  if (
    v === '::'
    || v === '::1'
    || v === '0:0:0:0:0:0:0:0'
    || v === '0:0:0:0:0:0:0:1'
  ) return true;
  if (v.startsWith('fc') || v.startsWith('fd')) return true;
  const firstHextet = Number.parseInt(v.split(':')[0] || '0', 16);
  if (firstHextet >= 0xfe80 && firstHextet <= 0xfebf) return true;
  if (v.startsWith('ff')) return true;
  if (v.startsWith('2001:db8:') || v === '2001:db8::') return true;
  return false;
}

async function resolveWithHttpsDns(
  hostname: string,
  type: 'A' | 'AAAA',
): Promise<string[]> {
  const url = new URL(DNS_QUERY_ENDPOINT);
  url.searchParams.set('name', hostname);
  url.searchParams.set('type', type);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DNS_QUERY_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/dns-json' },
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) return [];

    const result = await response.json().catch(() => null);
    if (!result || result.Status !== 0 || !Array.isArray(result.Answer)) return [];

    const expectedType = type === 'A' ? 1 : 28;
    return result.Answer
      .filter((answer: any) => answer?.type === expectedType)
      .map((answer: any) => String(answer?.data || '').trim().toLowerCase())
      .filter((answer: string) => isIpLiteral(answer));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function resolveAddresses(hostname: string): Promise<string[]> {
  const denoResolver = typeof Deno !== 'undefined'
    && typeof Deno.resolveDns === 'function'
    ? Deno.resolveDns.bind(Deno)
    : null;

  if (denoResolver) {
    try {
      const [a, aaaa] = await Promise.all([
        denoResolver(hostname, 'A').catch(() => [] as string[]),
        denoResolver(hostname, 'AAAA').catch(() => [] as string[]),
      ]);
      const nativeAddresses = [...(a || []), ...(aaaa || [])]
        .map((address) => String(address).trim().toLowerCase())
        .filter((address) => isIpLiteral(address));
      if (nativeAddresses.length > 0) return nativeAddresses;
    } catch {
      // Fall through to the fixed HTTPS resolver.
    }
  }

  const [a, aaaa] = await Promise.all([
    resolveWithHttpsDns(hostname, 'A'),
    resolveWithHttpsDns(hostname, 'AAAA'),
  ]);
  return [...new Set([...a, ...aaaa])];
}

// Resolves hostname to IP addresses and throws if any resolved IP is private.
// IP literals are checked directly without DNS. Resolution always fails closed.
export async function assertSafeHost(hostname: string): Promise<void> {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!h || h === 'localhost' || h.endsWith('.localhost')) {
    throw new Error('Internal hosts are not allowed.');
  }

  if (isIpLiteral(h)) {
    if (isPrivateIp(h)) throw new Error('Internal hosts are not allowed.');
    return;
  }

  const addresses = await resolveAddresses(h);
  if (addresses.length === 0) throw new Error('Could not resolve host.');

  for (const address of addresses) {
    if (isPrivateIp(address)) {
      throw new Error('Host resolves to a private/internal address.');
    }
  }
}