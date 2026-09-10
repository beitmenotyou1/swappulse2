import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  discordRequest,
  discordTurnstileSiteKey,
  getGuildConfig,
  sha256Hex,
  syncDiscordLink,
  upsertDiscordLink,
} from '../../shared/discordBot.ts';

function clientIp(req: Request): string {
  return (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '')
    .split(',')[0]
    .trim();
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'GET') {
      return Response.json({ ok: true, site_key: discordTurnstileSiteKey() });
    }
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const config = await getGuildConfig(svc, true);
    const body = await req.json().catch(() => ({}));
    if (body?.op === 'config') {
      return Response.json({ ok: true, site_key: discordTurnstileSiteKey() });
    }
    const challengeToken = String(body?.challenge || '');
    const captchaToken = String(body?.captcha_token || '');
    if (!challengeToken || !captchaToken) {
      return Response.json({ error: 'The verification challenge is incomplete.' }, { status: 400 });
    }

    const challengeHash = await sha256Hex(challengeToken);
    const rows = await svc.entities.DiscordVerificationChallenge
      .filter({ challenge_hash: challengeHash, purpose: 'captcha' }, '-created_date', 1)
      .catch(() => []);
    const challenge = rows?.[0];
    if (
      !challenge
      || challenge.used_at
      || Date.parse(challenge.expires_at) < Date.now()
      || challenge.guild_id !== config.guild_id
    ) {
      return Response.json({ error: 'This verification link has expired or has already been used.' }, { status: 410 });
    }

    const secret = String(Deno.env.get('TURNSTILE_SECRET_KEY') || '');
    if (!secret) throw new Error('TURNSTILE_SECRET_MISSING');
    const verifyBody = new URLSearchParams({ secret, response: captchaToken });
    const ip = clientIp(req);
    if (ip) verifyBody.set('remoteip', ip);
    const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: verifyBody,
    });
    const verified = await verifyResponse.json().catch(() => ({}));
    if (!verifyResponse.ok || !verified?.success) {
      return Response.json({ error: 'The bot check was not accepted. Please try again.' }, { status: 400 });
    }
    const hostname = String(verified?.hostname || '').toLowerCase();
    if (hostname && hostname !== 'swappulse.org' && !hostname.endsWith('.swappulse.org')) {
      return Response.json({ error: 'The bot check came from an unexpected site.' }, { status: 400 });
    }

    await discordRequest(
      `/guilds/${encodeURIComponent(config.guild_id)}/members/${encodeURIComponent(challenge.discord_user_id)}`,
    );
    const existingRows = await svc.entities.DiscordAccountLink
      .filter({ discord_user_id: challenge.discord_user_id, guild_id: config.guild_id, status: 'verified' }, '-created_date', 1)
      .catch(() => []);
    const existing = existingRows?.[0];
    const now = new Date().toISOString();
    const link = existing?.verification_method === 'swappulse_account'
      ? existing
      : await upsertDiscordLink(svc, {
        user_id: existing?.user_id || '',
        discord_user_id: challenge.discord_user_id,
        discord_username: existing?.discord_username || '',
        guild_id: config.guild_id,
        verification_method: 'captcha',
        status: 'verified',
        verified_at: now,
        last_sync_error: '',
      });
    await svc.entities.DiscordVerificationChallenge.update(challenge.id, { used_at: now });
    const result = await syncDiscordLink(svc, link, 'captcha');
    return Response.json({ ok: true, roles: result.desired_roles });
  } catch (error) {
    const code = String(error?.message || 'DISCORD_CAPTCHA_FAILED').split(':')[0];
    console.error('discord-captcha-verify:', code);
    return Response.json({ error: 'Discord verification could not be completed.', code }, { status: 502 });
  }
});
