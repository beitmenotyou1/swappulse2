// check-bot-risk — pre-flight bot-protection check the client calls before
// any write action. Runs the shared botGuard and returns a verdict. When a
// challenge is required, also returns the Turnstile site key (if configured)
// so the client can render the captcha widget; otherwise the client uses the
// behavioural fallback challenge. On retry, the client sends the captcha
// token (or the issued challenge token) and this function verifies it.
//
// Auth flows (login code, register) call this with an `anonId` (email) since
// there is no session yet. Authenticated writes call it with the session user.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { checkBotRisk } from '../../shared/botGuard.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { actionType, content, captchaToken, challengeToken, anonId } = body;
    if (!actionType) {
      return Response.json({ error: 'actionType is required' }, { status: 400 });
    }

    let user: any = null;
    try { user = await base44.auth.me(); } catch { /* no session, auth flow */ }

    const verdict = await checkBotRisk(svc, {
      user, actionType, content, req, captchaToken, challengeToken, anonId,
      turnstileSecret: secrets.get('TURNSTILE_SECRET_KEY') || '',
    });

    const siteKey = (verdict.challengeRequired ? (secrets.get('TURNSTILE_SITE_KEY') || '') : '');
    return Response.json({ ...verdict, captchaSiteKey: siteKey });
  } catch (error: any) {
    console.error('check-bot-risk error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}