// autonomous-moderation — DEPRECATED / QUARANTINED legacy escrow resolver.
//
// Escrow is not part of the current SwapPulse V1 architecture. This endpoint
// intentionally performs strict authentication and then fails closed with 410.
// It must never infer internal trust from a service-style header alone and it
// must never execute escrow, refund, release, or payment mutations.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);

    // Internal calls must present the actual registered backend secret.
    // A Base44-looking Authorization header is not evidence of authenticity.
    const { secrets } = await import('base44:runtime');
    const sharedSecret = secrets.get('BACKEND_FUNCTION_SECRET');
    const provided = req.headers.get('x-backend-function-secret');
    const isInternalCall = Boolean(
      sharedSecret && provided && timingSafeEqual(provided, sharedSecret),
    );

    if ((!caller || caller.role !== 'admin') && !isInternalCall) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return Response.json({
      error: 'Legacy autonomous escrow moderation is disabled',
      code: 'LEGACY_ESCROW_DISABLED',
    }, { status: 410 });
  } catch (error: any) {
    console.error('autonomous-moderation auth failure:', error?.message || error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
});
