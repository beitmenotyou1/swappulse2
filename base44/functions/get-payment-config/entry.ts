// get-payment-config — returns the Stripe publishable key to the frontend.
// Base44 has no NEXT_PUBLIC_ convention, so this small public function exposes
// the publishable key (safe for client-side use) for any future embedded
// Stripe.js checkout. Hosted Checkout (the current flow) does not require it.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Verify the caller is an authenticated SwapPulse user before returning
    // payment configuration.
    try {
      const me = await base44.auth.me();
      if (!me?.id) throw new Error('unauthenticated');
    } catch {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const publishableKey = secrets.get('STRIPE_PUBLISHABLE_KEY') || '';
    return Response.json({ stripePublishableKey: publishableKey });
  } catch (error) {
    return Response.json({ error: 'unavailable' }, { status: 500 });
  }
}