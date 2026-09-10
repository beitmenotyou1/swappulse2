import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  discordApplicationId,
  discordGuildId,
  discordRedirectUri,
  discordRequest,
  getGuildConfig,
  readSignedState,
  sha256Hex,
  syncDiscordLink,
  upsertDiscordLink,
} from '../../shared/discordBot.ts';

const SETTINGS_URL = 'https://swappulse.org/settings?tab=discord';

function finish(status: string, detail = '') {
  const url = new URL(SETTINGS_URL);
  url.searchParams.set('discord', status);
  if (detail) url.searchParams.set('reason', detail.slice(0, 60));
  return Response.redirect(url.toString(), 302);
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code') || '';
    const state = url.searchParams.get('state') || '';
    if (!code || !state) return finish('failed', 'missing_response');

    const payload = await readSignedState(state);
    if (payload.guild_id !== discordGuildId()) return finish('failed', 'guild_mismatch');
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    await getGuildConfig(svc, true);

    const stateHash = await sha256Hex(state);
    const challenges = await svc.entities.DiscordVerificationChallenge
      .filter({ state_hash: stateHash, purpose: 'account_link' }, '-created_date', 1)
      .catch(() => []);
    const challenge = challenges?.[0];
    if (!challenge || challenge.used_at || Date.parse(challenge.expires_at) < Date.now()) {
      return finish('failed', 'expired_state');
    }

    const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: discordApplicationId(),
        client_secret: String(Deno.env.get('DISCORD_CLIENT_SECRET') || ''),
        grant_type: 'authorization_code',
        code,
        redirect_uri: discordRedirectUri(),
      }),
    });
    const token = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !token?.access_token) return finish('failed', 'oauth_rejected');

    const profileResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const profile = await profileResponse.json().catch(() => ({}));
    if (!profileResponse.ok || !profile?.id) return finish('failed', 'profile_unavailable');

    const users = await svc.entities.User.filter({ id: payload.user_id }, '-created_date', 1).catch(() => []);
    const user = users?.[0];
    if (!user) return finish('failed', 'account_unavailable');

    const collisions = await svc.entities.DiscordAccountLink
      .filter({ discord_user_id: profile.id, guild_id: discordGuildId(), status: 'verified' }, '-created_date', 5)
      .catch(() => []);
    if (collisions.some((link: any) => link.user_id && link.user_id !== user.id)) {
      return finish('failed', 'already_linked');
    }

    const previousUserLinks = await svc.entities.DiscordAccountLink
      .filter({ user_id: user.id, guild_id: discordGuildId(), status: 'verified' }, '-created_date', 50)
      .catch(() => []);
    for (const previous of previousUserLinks) {
      if (String(previous.discord_user_id) === String(profile.id)) continue;
      await svc.entities.DiscordAccountLink.update(previous.id, {
        status: 'revoked',
        desired_roles: [],
        last_sync_error: '',
      });
      await syncDiscordLink(svc, { ...previous, status: 'revoked' }, 'oauth').catch(() => null);
    }

    await discordRequest(
      `/guilds/${encodeURIComponent(discordGuildId())}/members/${encodeURIComponent(profile.id)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ access_token: token.access_token }),
      },
    );
    const now = new Date().toISOString();
    const link = await upsertDiscordLink(svc, {
      user_id: user.id,
      discord_user_id: String(profile.id),
      discord_username: String(profile.global_name || profile.username || '').slice(0, 100),
      guild_id: discordGuildId(),
      verification_method: 'swappulse_account',
      status: 'verified',
      verified_at: now,
      last_sync_error: '',
    });
    await svc.entities.DiscordVerificationChallenge.update(challenge.id, { used_at: now });
    await syncDiscordLink(svc, link, 'oauth');
    return finish('linked');
  } catch (error) {
    console.error('discord-link-callback:', String(error?.message || error).split(':')[0]);
    return finish('failed', String(error?.message || 'callback_failed').split(':')[0]);
  }
});
