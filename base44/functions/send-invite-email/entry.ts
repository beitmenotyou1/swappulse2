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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    if (!EMAIL_RE.test(email)) {
      return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const did = user.data?.did || '';
    if (!did) {
      return Response.json({ error: 'Your identity is still provisioning — try again in a moment.' }, { status: 409 });
    }

    // Per-inviter daily rate limit using a counter on the user's profile data.
    const sentDate = user.data?.inviteEmailSentDate || '';
    const sentCount = Number(user.data?.inviteEmailSentCount || 0);
    const today = todayStr();
    if (sentDate === today && sentCount >= DAILY_CAP) {
      return Response.json(
        { error: `You've sent the daily limit of ${DAILY_CAP} invite emails. Try again tomorrow.` },
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

    const inviterName = user.full_name || user.email || 'a SwapPulse collector';
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

    // Increment the daily counter (reset if the day rolled over).
    await base44.auth.updateMe({
      inviteEmailSentDate: today,
      inviteEmailSentCount: sentDate === today ? sentCount + 1 : 1,
    });

    return Response.json({ ok: true, sentTo: email });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}