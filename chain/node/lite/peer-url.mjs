function isTailscaleIpv4(hostname) {
  const parts = hostname.split('.');

  if (
    parts.length !== 4
    || parts.some((part) => !/^(0|[1-9][0-9]{0,2})$/.test(part))
  ) {
    return false;
  }

  const octets = parts.map(Number);

  return octets.every((part) => part >= 0 && part <= 255)
    && octets[0] === 100
    && octets[1] >= 64
    && octets[1] <= 127;
}

export function safePeerUrl(
  value,
  { allowTailscaleHttp = false } = {},
) {
  const url = new URL(String(value || '').trim());

  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error('RPC_PEER_PROTOCOL_NOT_ALLOWED');
  }

  if (url.username || url.password) {
    throw new Error('RPC_PEER_CREDENTIALS_NOT_ALLOWED');
  }

  if (url.protocol === 'http:') {
    const hostname = url.hostname.toLowerCase();
    const isLocal = [
      '127.0.0.1',
      'localhost',
      '::1',
      '[::1]',
    ].includes(hostname);

    const isApprovedTailscale =
      allowTailscaleHttp === true
      && isTailscaleIpv4(hostname);

    if (!isLocal && !isApprovedTailscale) {
      throw new Error(
        'HTTP_RPC_PEER_MUST_BE_LOCAL_OR_APPROVED_TAILSCALE',
      );
    }
  }

  return url.toString();
}
