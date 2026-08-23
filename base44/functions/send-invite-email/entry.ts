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
// implicit MX). Blocks relay abuse via throwaway/non-existent domains.
async function domainCanReceiveMail(domain) {
  if (typeof Deno === 'undefined' || !Deno.resolveDns) return true; // skip if DNS API unavailable
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

    // Per-inviter daily rate limit using a counter on the user's profile data.
    const sentDate = user.data?.inviteEmailSentDate || '';
    const sentCount = Number(user.data?.inviteEmailSentCount || 0);
    const sentTotal = Number(user.data?.inviteEmailSentTotal || 0);
    const today = todayStr();
    if (sentDate === today && sentCount >= DAILY_CAP) {
      return Response.json(
        { error: `You've sent the daily limit of ${DAILY_CAP} invite emails. Try again tomorrow.` },
        { status: 429 },
      );
    }
    if (sentTotal >= LIFETIME_CAP) {
      return Response.json(
        { error: `You've reached the invite email limit. Contact support if you need to send more.` },
        { status: 429 },
      );
    }
    // Per-recipient cooldown: block re-mailing the same address within 24h to
    // prevent an attacker from hammering one mailbox via this endpoint.
    const now = Date.now();
    const recipients = Array.isArray(user.data?.inviteEmailRecipients) ? user.data.inviteEmailRecipients : [];
    const recent = recipients.filter((r) => r && r.email && now - Number(r.ts || 0) < RECIPIENT_COOLDOWN_MS);
    if (recent.some((r) => r.email === email)) {
      return Response.json(
        { error: `An invite was already sent to that address recently. Try again later.` },
        { status: 429 },
      );
    }

    // Reuse the inviter's most recent active personal code, or create one.
    const existing = await base44.asServiceRole.entities.InviteCode.filter(
      { inviter_did: did, status: 'active' },
      '-created_date',
      1,
    );
    let code;
    if (existing.length) {
      code = existing[0];
    } else {
      const created = await base44.asServiceRole.entities.InviteCode.create({
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
      subject: `${inviterName} invited you to SwapPulse`,
      preheader: `${inviterName} thinks you'd love SwapPulse — join and connect automatically.`,
      bodyHtml,
      ctaLink: inviteUrl,
      ctaLabel: 'Join SwapPulse',
      accentColor: '#6d4aff',
      footerReason: `You received this email because ${esc(inviterName)} sent you an invite from SwapPulse. If you don't know them, you can safely ignore this email.`,
    });

    const text = buildPlainText(
      `${inviterName} invited you to SwapPulse`,
      [
        `${inviterName}${inviterHandle ? ` (@${inviterHandle})` : ''} thinks you'd love SwapPulse — the decentralized social network for Pokémon TCG collectors.`,
        'Track your collection, trade cards, scan pulls, and connect with the community.',
        `Join via the link below and you'll automatically follow ${inviterName} and become friends.`,
      ],
      inviteUrl,
      'Join SwapPulse',
    );

    try {
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: `${inviterName} invited you to SwapPulse`,
        body: html,
        from_name: inviterName,
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

    // Increment the daily + lifetime counters (reset daily if the day rolled
    // over) and append the recipient to the 24h cooldown list (capped to last 20).
    const updatedRecipients = [...recent, { email, ts: now }].slice(-20);
    await base44.auth.updateMe({
      inviteEmailSentDate: today,
      inviteEmailSentCount: sentDate === today ? sentCount + 1 : 1,
      inviteEmailSentTotal: sentTotal + 1,
      inviteEmailRecipients: updatedRecipients,
    });

    return Response.json({ ok: true, sentTo: email });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}