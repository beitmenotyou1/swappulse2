// Validates the platform's internal service token
// (`base44-service-authorization` JWT) injected on internal calls (workflow
// runtime, function-to-function). Decodes the JWT payload and requires
// `internal_service_token === "true"` and `caller === "backend_functions"`.
// A public internet caller has no such token, so this prevents header-spoofing
// bypasses where a caller only needs to set the header name to gain service
// role access.
//
// Returns true only when the token is present AND its decoded payload carries
// the legitimate platform service claims.

function base64UrlDecode(str: string): string {
  const pad = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = pad + '==='.slice((pad.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function isInternalServiceCall(req: Request): boolean {
  // Header lookup is case-insensitive per the Headers spec.
  const header =
    req.headers.get('base44-service-authorization') ||
    req.headers.get('Base44-Service-Authorization');
  if (!header) return false;
  const parts = header.split('.');
  // A JWT has three dot-separated segments; a bare opaque token is not trusted.
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]) || '{}');
    return payload?.internal_service_token === true && payload?.caller === 'backend_functions';
  } catch {
    return false;
  }
}