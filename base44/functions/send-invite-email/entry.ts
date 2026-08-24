// send-invite-email — lets a logged-in collector send a platform-delivered,
// site-personalised invite email to a friend. Reuses (or creates) an active
// personal InviteCode tied to the inviter, builds a branded HTML body showing
// who the invite is from, and sends it via the SendEmail integration. Enforces
// a per-inviter daily cap (10/day) via a counter on the user's profile data.
// SendEmail to non-registered recipients requires a paid plan + custom domain;
// if the platform refuses the send, we surface a clear, non-technical error.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveAppUrl } from '../../shared/appUrl.ts';
import { buildBrandedHtml, buildPlainText, esc } from '../../shared/emailTemplate.ts';
import { checkBotRisk } from '../../shared/botGuard.ts';

const DAILY_CAP = 10;
const LIFETIME_CAP = 50; // total invite emails a single inviter may ever send
const RECIPIENT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // same address can't be re-mailed within 24h
// Stricter regex: ASCII-only, no control chars/whitespace (prevents CRLF header injection — CWE-93).
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}$/;
const MAX_EMAIL_LEN = 254;

// Disposable/temporary email domains commonly used for relay abuse. Rejecting
// these restricts the endpoint to real, persistent mailboxes and prevents an
// attacker from spinning up throwaway addresses to relay spam.
const BLOCKED_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamailblock.com', 'sharklasers.com',
  '10minutemail.com', '10minutemail.net', 'tempmail.com', 'tempmail.net', 'temp-mail.org',
  'throwawaymail.com', 'throwaway.email', 'yopmail.com', 'yopmail.net', 'getnada.com',
  'nada.email', 'maildrop.cc', 'dispostable.com', 'fakeinbox.com', 'mailnesia.com',
  'trashmail.com', 'trashmail.net', 'trashmail.me', 'sharklasers.com', 'spam4.me',
  'mintemail.com', 'mohmal.com', 'mohmal.tech', 'tmpmail.org', 'tmpmail.net',
  'emailondeck.com', 'mytemp.email', 'tempinbox.com', 'spambog.com', 'spambog.ru',
  'discard.email', 'discardmail.com', 'mailcatch.com', 'harakirimail.com',
  'jetable.org', 'jetable.com', 'rtrtr.com', 'fakebox.com', 'filzmail.com',
  'byom.de', 'tempr.email', 'temprmail.com', 'tempmailo.com', 'vomoto.com',
]);

// Strip CR/LF and other control chars from values used in email headers
// (subject, from_name) to prevent header injection from user-controlled profile data.
function sanitizeHeader(str) {
  return String(str || '').replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 100);
}

// Validate the recipient domain actually accepts mail (MX, falling back to A as
// implicit MX). Blocks relay abuse via throwaway/non-existent domains. Fails
// CLOSED: if the DNS resolution API is unavailable we reject the send rather
// than allow it, so the recipient domain is always strictly verified before
// Core.SendEmail is called — no open-relay fallback path.
async function domainCanReceiveMail(domain) {
  if (typeof Deno === 'undefined' || !Deno.resolveDns) return false;
  try {
    const mx = await Deno.resolveDns(domain, 'MX');
    if (mx && mx.length) return true;
  } catch {}
  try {
    const a = await Deno.resolveDns(domain, 'A');
    if (a && a.length) return true;
  } catch {}
  return false;
}

function genCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Platform-level sender verification (CWE-862): only accounts that have
    // been registered for at least 24 hours can dispatch invite emails. This
    // prevents attackers from creating throwaway accounts purely to relay
    // spam through the platform's email infrastructure — the core open-relay
    // vector. Established accounts have reputational skin in the game.
    const MIN_ACCOUNT_AGE_MS = 24 * 60 * 60 * 1000;
    const accountAge = user.created_date ? Date.now() - new Date(user.created_date).getTime() : 0;
    if (accountAge < MIN_ACCOUNT_AGE_MS) {
      return Response.json(
        { error: 'Your account must be at least 24 hours old before sending invite emails.' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
      return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    const recipientDomain = email.split('@')[1];
    if (BLOCKED_DOMAINS.has(recipientDomain)) {
      return Response.json({ error: 'Invites cannot be sent to disposable email addresses. Please use a real email.' }, { status: 400 });
    }
    if (!await domainCanReceiveMail(recipientDomain)) {
      return Response.json({ error: 'That email domain cannot receive mail. Please check the address.' }, { status: 400 });
    }

    const did = user.data?.did || '';
    if (!did) {
      return Response.json({ error: 'Your identity is still provisioning — try again in a moment.' }, { status: 409 });
    }

    // Per-inviter rate limits are derived from the server-controlled
    // InviteEmailLog entity (admin-only RLS), NOT from user.data fields — a
    // user can reset user.data via the client SDK, which would bypass caps.
    const svc = base44.asServiceRole;

    // Bot-risk verification (A01 — Broken Access Control): run the caller
    // through the platform's bot-risk guard before dispatching any email.
    // This blocks automated relay scripts and requires a CAPTCHA challenge
    // for suspicious patterns, ensuring only real human collectors — not
    // bots — can use the platform's email infrastructure as a relay.
    const botVerdict = await checkBotRisk(svc, {
      user,
      actionType: 'invite_email',
      req,
      turnstileSecret: process.env.TURNSTILE_SECRET_KEY,
    });
    if (botVerdict.block) {
      return Response.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      );
    }
    if (botVerdict.challengeRequired) {
      return Response.json(
        { error: 'Human verification required to send invite emails.', challengeRequired: true },
        { status: 403 },
      );
    }

    // Anti-relay: the endpoint must only send invite emails to people who are
    // NOT already SwapPulse members. Sending branded platform emails to
    // existing members (or to yourself) has no legitimate invite purpose and
    // would be pure open-relay abuse, so we block both cases before dispatch.
    if (email === String(user.email || '').trim().toLowerCase()) {
      return Response.json({ error: "You can't send an invite to yourself." }, { status: 400 });
    }
    const existingMembers = await svc.entities.User.filter({ email }).catch(() => []);
    if (existingMembers && existingMembers.length > 0) {
      return Response.json({ error: 'That person is already on SwapPulse!' }, { status: 400 });
    }

    const today = todayStr();
    const now = Date.now();
    const cooldownSince = new Date(now - RECIPIENT_COOLDOWN_MS).toISOString();

    const [todayLogs, totalLogs, recentRecipientLogs] = await Promise.all([
      svc.entities.InviteEmailLog.filter({ inviter_did: did, sent_date: today }, '-created_date', 500).catch(() => []),
      svc.entities.InviteEmailLog.filter({ inviter_did: did }, '-created_date', 500).catch(() => []),
      svc.entities.InviteEmailLog.filter({ inviter_did: did, recipient_email: email }, '-created_date', 500).catch(() => []),
    ]);

    if ((todayLogs || []).length >= DAILY_CAP) {
      return Response.json(
        { error: `You've sent the daily limit of ${DAILY_CAP} invite emails. Try again tomorrow.` },
        { status: 429 },
      );
    }
    if ((totalLogs || []).length >= LIFETIME_CAP) {
      return Response.json(
        { error: `You've reached the invite email limit. Contact support if you need to send more.` },
        { status: 429 },
      );
    }
    // Per-recipient cooldown: block re-mailing the same address within 24h to
    // prevent an attacker from hammering one mailbox via this endpoint.
    if ((recentRecipientLogs || []).some((r) => r.sent_at && r.sent_at >= cooldownSince)) {
      return Response.json(
        { error: `An invite was already sent to that address recently. Try again later.` },
        { status: 429 },
      );
    }

    // Reuse the inviter's most recent active personal code, or create one.
    const existing = await svc.entities.InviteCode.filter(
      { inviter_did: did, status: 'active' },
      '-created_date',
      1,
    );
    let code;
    if (existing.length) {
      code = existing[0];
    } else {
      const created = await svc.entities.InviteCode.create({
        code: genCode(),
        status: 'active',
        origin: 'user',
        inviter_did: did,
        inviter_name: user.full_name || user.email || '',
        inviter_handle: user.data?.bsky_handle || '',
        inviter_avatar: user.data?.avatar_url || '',
        created_at: new Date().toISOString(),
        batch: `user-${user.id}`,
      });
      code = created;
    }

    const inviterName = sanitizeHeader(user.full_name || user.email || 'a SwapPulse collector');
    const inviterHandle = user.data?.bsky_handle || '';
    const appOrigin = resolveAppUrl(req);
    const inviteUrl = `${appOrigin}/invite/${code.code}`;

    // Immutable, branded email metadata. The subject and from_name are fixed
    // strings that never embed user-controlled profile text, so an attacker
    // cannot spoof the email envelope/headers by setting a misleading
    // full_name (e.g. "SwapPulse Security Team"). The inviter's name still
    // appears inside the escaped HTML body, which is clearly within a branded
    // SwapPulse template — that personalisation is the feature's purpose and
    // cannot inject HTML or control email headers.
    const SUBJECT = "You're invited to SwapPulse";
    const FROM_NAME = 'SwapPulse';
    const PREHEADER = 'A friend thinks you would love SwapPulse — the decentralized social network for Pokémon TCG collectors.';

    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#f1f5f9;">${esc(inviterName)} invited you to SwapPulse</p>
      <p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.7;">
        ${esc(inviterName)}${inviterHandle ? ` (@${esc(inviterHandle)})` : ''} thinks you'd love SwapPulse — the decentralized social network for Pokémon TCG collectors.
        Track your collection, trade cards, scan pulls, and connect with the community.
      </p>
      <p style="margin:0 0 8px;font-size:15px;color:#94a3b8;line-height:1.7;">
        Join via the link below and you'll automatically follow ${esc(inviterName)} and become friends — no request needed.
      </p>`;

    const html = buildBrandedHtml({
      subject: SUBJECT,
      preheader: PREHEADER,
      bodyHtml,
      ctaLink: inviteUrl,
      ctaLabel: 'Join SwapPulse',
      accentColor: '#6d4aff',
      footerReason: `You received this email because ${esc(inviterName)} sent you an invite from SwapPulse. If you don't know them, you can safely ignore this email.`,
    });

    const text = buildPlainText(
      SUBJECT,
      [
        `${esc(inviterName)}${inviterHandle ? ` (@${inviterHandle})` : ''} thinks you'd love SwapPulse — the decentralized social network for Pokémon TCG collectors.`,
        'Track your collection, trade cards, scan pulls, and connect with the community.',
        `Join via the link below and you'll automatically follow ${inviterName} and become friends.`,
      ],
      inviteUrl,
      'Join SwapPulse',
    );

    // CRLF injection defense-in-depth (CWE-93): strip any CR/LF or control
    // chars from the recipient address immediately before dispatch. EMAIL_RE
    // already rejects these, but this ensures no CRLF sequence can reach the
    // SMTP sink even if the regex validation is bypassed.
    const safeRecipient = email.replace(/[\x00-\x1F\x7F\r\n]/g, '');
    try {
      await base44.integrations.Core.SendEmail({
        to: safeRecipient,
        subject: SUBJECT,
        body: html,
        from_name: FROM_NAME,
      });
    } catch (sendErr) {
      // SendEmail to non-registered recipients requires a paid plan + custom
      // domain. Surface a clear, non-technical error so the user understands.
      const msg = String(sendErr?.message || sendErr || '');
      return Response.json(
        { error: 'Invite email could not be sent. Sending to email addresses that aren\'t SwapPulse members requires a connected custom domain on a paid plan — this is a platform limitation, not a bug.' },
        { status: 502 },
      );
    }

    // Record the send in the server-controlled InviteEmailLog so future rate-
    // limit checks are based on an immutable, admin-only audit trail the user
    // cannot reset via the client SDK.
    await svc.entities.InviteEmailLog.create({
      inviter_did: did,
      inviter_user_id: user.id || '',
      recipient_email: email,
      invite_code: code.code,
      sent_at: new Date(now).toISOString(),
      sent_date: today,
    });

    return Response.json({ ok: true, sentTo: email });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}