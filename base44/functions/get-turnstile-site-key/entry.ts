// get-turnstile-site-key — returns the Cloudflare Turnstile site key so public
// pages (donate, checkout) can render the captcha widget. The site key is
// public by design (Cloudflare docs); the secret key never leaves the server.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req); // initialise context

    // Verify the caller is an authenticated SwapPulse user.
    try {
      const me = await base44.auth.me();
      if (!me?.id) throw new Error('unauthenticated');
    } catch {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const siteKey = Deno.env.get('TURNSTILE_SITE_KEY') || '';
    return Response.json({ siteKey });
  } catch (error) {
    console.error('get-turnstile-site-key error', error?.message || error);
    return Response.json({ siteKey: '' }, { status: 500 });
  }
});