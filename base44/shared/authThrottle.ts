// Shared authentication throttling for public credential-verification endpoints.
// Uses the existing AuthRateLimit entity with a namespaced, SHA-256-derived key
// so raw handles/DIDs are not stored in the rate-limit table.

const encoder = new TextEncoder();

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function throttleKey(namespace: string, identifier: string): Promise<string> {
  const normalised = String(identifier || '').trim().toLowerCase();
  return `auth:${namespace}:${await sha256Hex(normalised)}`;
}

export async function consumeAuthAttempt(
  svc: any,
  namespace: string,
  identifier: string,
  options: { maxAttempts?: number; windowMs?: number } = {},
): Promise<{ allowed: boolean; retryAfterSeconds?: number; key: string }> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 5);
  const windowMs = Math.max(60_000, options.windowMs ?? 15 * 60_000);
  const key = await throttleKey(namespace, identifier);
  const now = Date.now();

  const rows = await svc.entities.AuthRateLimit.filter({ email: key }, '-created_date', 1).catch(() => []);
  const existing = rows?.[0];

  if (!existing) {
    await svc.entities.AuthRateLimit.create({
      email: key,
      count: 1,
      window_start: new Date(now).toISOString(),
      last_request_at: new Date(now).toISOString(),
    });
    return { allowed: true, key };
  }

  const start = new Date(existing.window_start || existing.created_date || 0).getTime();
  const inWindow = Number.isFinite(start) && now - start < windowMs;
  const count = inWindow ? Number(existing.count || 0) : 0;

  if (inWindow && count >= maxAttempts) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - start)) / 1000)),
      key,
    };
  }

  await svc.entities.AuthRateLimit.update(existing.id, {
    count: inWindow ? count + 1 : 1,
    window_start: inWindow ? existing.window_start : new Date(now).toISOString(),
    last_request_at: new Date(now).toISOString(),
  });

  return { allowed: true, key };
}

export async function resetAuthAttempts(svc: any, namespace: string, identifier: string): Promise<void> {
  const key = await throttleKey(namespace, identifier);
  const rows = await svc.entities.AuthRateLimit.filter({ email: key }, '-created_date', 10).catch(() => []);
  for (const row of rows || []) {
    await svc.entities.AuthRateLimit.delete(row.id).catch(() => {});
  }
}
