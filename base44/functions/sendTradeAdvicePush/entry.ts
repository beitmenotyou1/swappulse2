import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import webPush from 'npm:web-push@3.6.7';

function isPlatformInternalCall(req: Request): boolean {
  const authz = req.headers.get('base44-service-authorization') || '';
  if (!authz.startsWith('Bearer ')) return false;
  const token = authz.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const isInternal = payload?.internal_service_token === true || payload?.internal_service_token === 'true';
    return isInternal && payload?.caller === 'backend_functions';
  } catch {
    return false;
  }
}

// Sends a Web Push notification to a specific user with trade advice.
// Called by the Collection Trade Opportunity Alert workflow after the 10-minute wait.
export default async function(req) {
  if (!isPlatformInternalCall(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json();
    const { user_id, title, body: messageBody, url } = body;

    if (!user_id) {
      return Response.json({ error: 'user_id is required' }, { status: 400 });
    }

    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!publicKey || !privateKey) {
      return Response.json({ error: 'VAPID keys not configured' }, { status: 503 });
    }
    webPush.setVapidDetails('mailto:support@swappulse.org', publicKey, privateKey);

    const user = await svc.entities.User.get(user_id);
    if (!user || !user.push_subscription) {
      return Response.json({ error: 'User has no push subscription', user_id }, { status: 404 });
    }

    const payload = JSON.stringify({
      title: title || 'SwapPulse Trade Advice',
      body: messageBody || '',
      url: url || '/collection',
    });

    await webPush.sendNotification(JSON.parse(user.push_subscription), payload);

    return Response.json({ success: true, sent: true, user_id });
  } catch (error) {
    console.error('sendTradeAdvicePush error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}