// atproto-auth — verifies a user's AT Protocol (Bluesky) credentials and
// either returns their DID + profile (for registration porting) or sends a
// SwapPulse login code to the email on file for that DID (for login).
//
// This is a PUBLIC function — called before the user is authenticated.
// It only verifies credentials and returns profile info / sends a code;
// it does not grant access to anything.
//
// Modes:
//   verify (default): { handle, appPassword } → { did, handle, displayName, avatar, description }
//   login:           { handle, appPassword, mode: 'login' } → { code_sent, emailMasked } | { not_found }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';

// --- Handle / DID resolution ---

async function resolveHandle(handle: string): Promise<string> {
  // Already a DID?
  if (handle.startsWith('did:')) return handle;

  // Try bsky.social's resolveHandle XRPC (works for most users)
  try {
    const res = await fetch(
      `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.did) return data.did;
    }
  } catch {}

  // Fallback: HTTPS well-known
  try {
    const base = handle.includes('.') ? `https://${handle}` : `https://${handle}.bsky.social`;
    const res = await fetch(`${base}/.well-known/atproto-did`, { redirect: 'follow' });
    if (res.ok) {
      const text = (await res.text()).trim();
      if (text.startsWith('did:')) return text;
    }
  } catch {}

  throw new Error('Could not resolve handle to a DID. Check the handle and try again.');
}

async function resolvePdsUrl(did: string): Promise<string> {
  if (did.startsWith('did:plc:')) {
    const res = await fetch(`https://plc.directory/${encodeURIComponent(did)}`);
    if (!res.ok) throw new Error('Could not resolve DID at PLC directory.');
    const doc = await res.json();
    const service = (doc.service || []).find(
      (s: any) => s.type === 'AtprotoPersonalDataServer',
    );
    if (!service?.serviceEndpoint) throw new Error('DID has no PDS endpoint.');
    return service.serviceEndpoint;
  }
  if (did.startsWith('did:web:')) {
    const domain = did.replace('did:web:', '');
    const res = await fetch(`https://${domain}/.well-known/did.json`, { redirect: 'follow' });
    if (!res.ok) throw new Error('Could not resolve did:web DID.');
    const doc = await res.json();
    const service = (doc.service || []).find(
      (s: any) => s.type === 'AtprotoPersonalDataServer',
    );
    if (!service?.serviceEndpoint) throw new Error('DID has no PDS endpoint.');
    return service.serviceEndpoint;
  }
  throw new Error(`Unsupported DID method: ${did.split(':')[1]}`);
}

async function createSession(
  pdsUrl: string,
  identifier: string,
  appPassword: string,
): Promise<{ accessJwt: string; did: string; handle: string; email?: string }> {
  const res = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: appPassword }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new Error('Invalid handle or app password. Make sure you used an app password, not your main password.');
    }
    throw new Error(`PDS authentication failed (${res.status}). ${body.slice(0, 200)}`);
  }
  return await res.json();
}

async function getProfile(
  pdsUrl: string,
  accessJwt: string,
  did: string,
): Promise<{ displayName?: string; avatar?: string; description?: string }> {
  try {
    const res = await fetch(
      `${pdsUrl}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
      { headers: { Authorization: `Bearer ${accessJwt}` } },
    );
    if (!res.ok) return {};
    const data = await res.json();
    return {
      displayName: data.displayName || data.handle || '',
      avatar: data.avatar || '',
      description: data.description || '',
    };
  } catch {
    return {};
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}

// --- Login code generation + email (mirrors send-login-code) ---

async function sendLoginCode(svc: any, email: string): Promise<void> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  try {
    await svc.entities.LoginCode.deleteMany({ email });
  } catch (e) {
    console.error('atproto-auth: failed to delete old codes:', e?.message || e);
  }

  await svc.entities.LoginCode.create({
    email,
    code,
    expires_at: expiresAt,
    used: false,
  });

  const subject = 'Your SwapPulse Login Code';
  const textVersion =
    'Your SwapPulse Login Code\n\n' +
    'You requested a login code via your AT Protocol identity.\n\n' +
    'Here is your one-time login code:\n\n' +
    code + '\n\n' +
    'This code expires in 15 minutes. If you did not request this code, you can safely ignore this email.\n\n' +
    '— The SwapPulse Team';

  const htmlVersion =
    '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0F1117;color:#e2e8f0;">' +
    '<h1 style="color:#6d4aff;font-size:24px;margin-bottom:16px;">Your SwapPulse Login Code</h1>' +
    '<p style="line-height:1.6;">You requested a login code via your AT Protocol identity.</p>' +
    '<p style="line-height:1.6;">Here is your one-time login code:</p>' +
    '<div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:24px;background:#1a1d2e;border-radius:12px;margin:16px 0;color:#fbbf24;">' + code + '</div>' +
    '<p style="line-height:1.6;">This code expires in 15 minutes. If you did not request this code, you can safely ignore this email.</p>' +
    '<p style="color:#64748b;font-size:12px;margin-top:24px;text-align:center;">— The SwapPulse Team</p>' +
    '</div>';

  try {
    await sendBrandedEmail({ to: email, subject, html: htmlVersion, text: textVersion });
  } catch (e) {
    console.error('atproto-auth: email failed:', e?.message || e);
    throw new Error('Could not send login code email.');
  }
}

// --- Main handler ---

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const handle = String(body.handle || '').trim().replace(/^@/, '');
    const appPassword = String(body.appPassword || '').trim();
    const mode = body.mode === 'login' ? 'login' : 'verify';

    if (!handle || !appPassword) {
      return Response.json(
        { error: 'Handle and app password are required.' },
        { status: 400 },
      );
    }

    // 1. Resolve handle → DID
    const did = await resolveHandle(handle);

    // 2. Resolve DID → PDS URL
    const pdsUrl = await resolvePdsUrl(did);

    // 3. Authenticate against the PDS
    const session = await createSession(pdsUrl, handle, appPassword);

    // 4. Fetch profile
    const profile = await getProfile(pdsUrl, session.accessJwt, session.did);

    // 5. For login mode: look up SwapPulse user by DID, send login code
    if (mode === 'login') {
      const base44 = createClientFromRequest(req);
      const svc = base44.asServiceRole;
      const users = await svc.entities.User.filter({ did: session.did }, '-created_date', 1);
      if (!users || users.length === 0) {
        return Response.json({
          not_found: true,
          did: session.did,
          handle: session.handle,
        });
      }
      const user = users[0];
      if (!user.email) {
        return Response.json({ error: 'Account has no email on file.' }, { status: 400 });
      }
      if (!user.login_key) {
        return Response.json({ needs_setup: true });
      }
      await sendLoginCode(svc, user.email.toLowerCase());
      return Response.json({ code_sent: true, email: user.email, emailMasked: maskEmail(user.email) });
    }

    // 6. For verify mode: return DID + profile
    return Response.json({
      verified: true,
      did: session.did,
      handle: session.handle,
      email: session.email || '',
      displayName: profile.displayName || '',
      avatar: profile.avatar || '',
      description: profile.description || '',
    });
  } catch (error) {
    console.error('atproto-auth error:', error?.message || error);
    return Response.json(
      { error: error?.message || 'AT Protocol authentication failed.' },
      { status: 400 },
    );
  }
});