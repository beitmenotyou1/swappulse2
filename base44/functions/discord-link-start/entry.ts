import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  createSignedState,
  discordApplicationId,
  discordGuildId,
  discordRedirectUri,
  getGuildConfig,
  randomToken,
  sha256Hex,
} from '../../shared/discordBot.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 });
    const svc = base44.asServiceRole;
    await getGuildConfig(svc, true);

    const nonce = randomToken(24);
    const exp = Date.now() + 10 * 60 * 1000;
    const state = await createSignedState({
      user_id: user.id,
      guild_id: discordGuildId(),
      nonce,
      exp,
    });
    await svc.entities.DiscordVerificationChallenge.create({
      state_hash: await sha256Hex(state),
      user_id: user.id,
      guild_id: discordGuildId(),
      purpose: 'account_link',
      expires_at: new Date(exp).toISOString(),
    });

    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('client_id', discordApplicationId());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', discordRedirectUri());
    url.searchParams.set('scope', 'identify guilds.join');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'consent');
    return Response.json({ ok: true, authorize_url: url.toString(), expires_at: new Date(exp).toISOString() });
  } catch (error) {
    const code = String(error?.message || 'DISCORD_LINK_START_FAILED').split(':')[0];
    const status = code === 'DISCORD_SYNC_DISABLED' || code === 'DISCORD_NOT_BOOTSTRAPPED' ? 503 : 500;
    return Response.json({ error: 'Discord account linking is not ready yet.', code }, { status });
  }
});
