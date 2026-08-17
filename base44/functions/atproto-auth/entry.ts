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

const APPVIEW = 'https://public.api.bsky.app';

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

// Fetches the full profile (including banner) from the public AppView.
// Tries without auth first (public profiles are publicly readable), then with
// the PDS access token, then falls back to fetching the profile record directly
// from the PDS via com.atproto.repo.getRecord. Logs each failure so issues are
// debuggable instead of silently returning empty data.
async function getFullProfile(
  accessJwt: string,
  did: string,
  pdsUrl?: string,
): Promise<{ displayName?: string; avatar?: string; banner?: string; description?: string }> {
  const actorParam = encodeURIComponent(did);

  // 1. Try AppView without auth (public endpoint)
  try {
    const res = await fetch(`${APPVIEW}/xrpc/app.bsky.actor.getProfile?actor=${actorParam}`);
    if (res.ok) {
      const data = await res.json();
      return {
        displayName: data.displayName || data.handle || '',
        avatar: data.avatar || '',
        banner: data.banner || '',
        description: data.description || '',
      };
    }
  } catch (e) {
    console.error('atproto-auth: AppView getProfile (no auth) failed:', e?.message || e);
  }

  // 2. Try AppView with the PDS access token
  try {
    const res = await fetch(`${APPVIEW}/xrpc/app.bsky.actor.getProfile?actor=${actorParam}`, {
      headers: { Authorization: `Bearer ${accessJwt}` },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        displayName: data.displayName || data.handle || '',
        avatar: data.avatar || '',
        banner: data.banner || '',
        description: data.description || '',
      };
    }
  } catch (e) {
    console.error('atproto-auth: AppView getProfile (auth) failed:', e?.message || e);
  }

  // 3. Fallback: fetch the profile record directly from the PDS
  if (pdsUrl) {
    try {
      const res = await fetch(
        `${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${actorParam}&collection=app.bsky.actor.profile&rkey=self`,
        { headers: { Authorization: `Bearer ${accessJwt}` } },
      );
      if (res.ok) {
        const data = await res.json();
        const value = data?.value || {};
        return {
          displayName: value.displayName || '',
          avatar: value.avatar || '',
          banner: value.banner || '',
          description: value.description || '',
        };
      }
    } catch (e) {
      console.error('atproto-auth: PDS getRecord fallback failed:', e?.message || e);
    }
  }

  return {};
}

// Paginates through the user's follows via the public AppView.
// Returns up to `max` follows with did/handle/displayName/avatar.
async function getFollows(
  accessJwt: string,
  did: string,
  max = 200,
): Promise<Array<{ did: string; handle: string; displayName: string; avatar: string }>> {
  const follows: Array<{ did: string; handle: string; displayName: string; avatar: string }> = [];
  let cursor: string | undefined;
  while (follows.length < max) {
    const params = new URLSearchParams({ actor: did, limit: '100' });
    if (cursor) params.set('cursor', cursor);
    try {
      const res = await fetch(
        `${APPVIEW}/xrpc/app.bsky.graph.getFollows?${params}`,
        { headers: { Authorization: `Bearer ${accessJwt}` } },
      );
      if (!res.ok) break;
      const data = await res.json();
      for (const f of data.follows || []) {
        follows.push({
          did: f.did,
          handle: f.handle || '',
          displayName: f.displayName || '',
          avatar: f.avatar || '',
        });
        if (follows.length >= max) break;
      }
      cursor = data.cursor;
      if (!cursor) break;
    } catch {
      break;
    }
  }
  return follows;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}

// --- Login code generation + email (mirrors send-login-code) ---

async function sendLoginCode(svc: any, email: string): Promise<void> {
  // Rate-limit: min 60s between sends, max 5 per hour per email.
  const rlNow = Date.now();
  const rlRecords = await svc.entities.AuthRateLimit.filter({ email }, '-created_date', 1).catch(() => []);
  const rlExisting = rlRecords[0];
  if (rlExisting) {
    const lastAgo = rlNow - new Date(rlExisting.last_request_at || rlExisting.created_date).getTime();
    if (lastAgo < 60_000) {
      throw new Error('Please wait a minute before requesting another code.');
    }
    const windowStart = new Date(rlExisting.window_start || rlExisting.created_date).getTime();
    const inWindow = rlNow - windowStart < 3_600_000;
    if (inWindow && (rlExisting.count || 0) >= 5) {
      throw new Error('Too many code requests. Please try again later.');
    }
    await svc.entities.AuthRateLimit.update(rlExisting.id, {
      last_request_at: new Date(rlNow).toISOString(),
      count: inWindow ? (rlExisting.count || 0) + 1 : 1,
      window_start: inWindow ? rlExisting.window_start : new Date(rlNow).toISOString(),
    });
  } else {
    await svc.entities.AuthRateLimit.create({
      email,
      last_request_at: new Date(rlNow).toISOString(),
      window_start: new Date(rlNow).toISOString(),
      count: 1,
    });
  }

  const code = String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
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
    'The SwapPulse Team';

  const htmlVersion =
    '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0F1117;color:#e2e8f0;">' +
    '<h1 style="color:#6d4aff;font-size:24px;margin-bottom:16px;">Your SwapPulse Login Code</h1>' +
    '<p style="line-height:1.6;">You requested a login code via your AT Protocol identity.</p>' +
    '<p style="line-height:1.6;">Here is your one-time login code:</p>' +
    '<div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:24px;background:#1a1d2e;border-radius:12px;margin:16px 0;color:#fbbf24;">' + code + '</div>' +
    '<p style="line-height:1.6;">This code expires in 15 minutes. If you did not request this code, you can safely ignore this email.</p>' +
    '<p style="color:#64748b;font-size:12px;margin-top:24px;text-align:center;">The SwapPulse Team</p>' +
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

    // 4. Fetch full profile (including banner) from the AppView, with PDS fallback
    const profile = await getFullProfile(session.accessJwt, session.did, pdsUrl);

    // 5. For link mode: persist the credential + DID on the user's account.
    //    The user is already authenticated (they're in Settings linking their
    //    Bluesky account). Stores the app password in PdsCredential (service
    //    role bypasses RLS) and sets the did:plc on the User record.
    if (mode === 'link') {
      const base44 = createClientFromRequest(req);
      const me = await base44.auth.me().catch(() => null);
      if (!me) return Response.json({ error: 'Sign in to link your Bluesky account.' }, { status: 401 });

      // Persist the app password in PdsCredential (service role bypasses RLS).
      // If a credential already exists (re-linking), update it in place.
      const existing = await base44.asServiceRole.entities.PdsCredential
        .filter({ user_id: me.id }).catch(() => []);
      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.PdsCredential.update(existing[0].id, {
          did: session.did, pds_url: pdsUrl, app_password: appPassword,
        });
      } else {
        await base44.asServiceRole.entities.PdsCredential.create({
          user_id: me.id, did: session.did, pds_url: pdsUrl, app_password: appPassword,
        });
      }

      // Set the did:plc + bsky_handle on the user record
      await base44.auth.updateMe({ did: session.did, bsky_handle: session.handle });

      return Response.json({
        linked: true,
        did: session.did,
        handle: session.handle,
        displayName: profile.displayName || session.handle || '',
        avatar: profile.avatar || '',
      });
    }

    // 6. For login mode: look up SwapPulse user by DID, send login code
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

    // 6. For verify mode: fetch follows then return DID + profile + follows
    const follows = await getFollows(session.accessJwt, session.did, 200);

    return Response.json({
      verified: true,
      did: session.did,
      handle: session.handle,
      email: session.email || '',
      // Fall back to the AT Protocol handle if displayName wasn't retrieved
      displayName: profile.displayName || session.handle || '',
      avatar: profile.avatar || '',
      banner: profile.banner || '',
      description: profile.description || '',
      follows,
    });
  } catch (error) {
    console.error('atproto-auth error:', error?.message || error);
    return Response.json(
      { error: error?.message || 'AT Protocol authentication failed.' },
      { status: 400 },
    );
  }
});