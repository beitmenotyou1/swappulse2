import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  discordGuildId,
  discordPublicKey,
  getGuildConfig,
  randomToken,
  sha256Hex,
  syncDiscordLink,
} from '../../shared/discordBot.ts';

function hexBytes(value: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error('DISCORD_PUBLIC_KEY_INVALID');
  return Uint8Array.from(value.match(/.{2}/g) || [], (pair) => Number.parseInt(pair, 16));
}

async function verifySignature(req: Request, raw: string): Promise<boolean> {
  const signature = req.headers.get('x-signature-ed25519') || '';
  const timestamp = req.headers.get('x-signature-timestamp') || '';
  if (!/^[0-9a-f]{128}$/i.test(signature) || !/^\d{10,13}$/.test(timestamp)) return false;
  const timeMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timeMs) || Math.abs(Date.now() - timeMs) > 5 * 60 * 1000) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    hexBytes(discordPublicKey()),
    { name: 'Ed25519' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    'Ed25519',
    key,
    hexBytes(signature),
    new TextEncoder().encode(timestamp + raw),
  );
}

function message(content: string) {
  return Response.json({ type: 4, data: { content, flags: 64 } });
}

Deno.serve(async (req) => {
  try {
    const raw = await req.text();
    if (!await verifySignature(req, raw)) {
      return Response.json({ error: 'Invalid Discord signature' }, { status: 401 });
    }
    const interaction = JSON.parse(raw);
    if (interaction.type === 1) return Response.json({ type: 1 });
    if (interaction.type !== 2) return message('That interaction is not supported.');

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const config = await getGuildConfig(svc, true);
    if (String(interaction.guild_id || '') !== String(config.guild_id)) {
      return message('SwapPulse Bot is not configured for this server.');
    }
    const discordUser = interaction.member?.user || interaction.user;
    if (!discordUser?.id) return message('Discord could not confirm your account.');
    const command = String(interaction.data?.name || '');

    if (command === 'verify') {
      const token = randomToken(32);
      const expires = Date.now() + 15 * 60 * 1000;
      await svc.entities.DiscordVerificationChallenge.create({
        challenge_hash: await sha256Hex(token),
        discord_user_id: String(discordUser.id),
        guild_id: discordGuildId(),
        purpose: 'captcha',
        expires_at: new Date(expires).toISOString(),
      });
      const captchaUrl = `https://swappulse.org/discord-verify?challenge=${encodeURIComponent(token)}`;
      return message(
        [
          '**Verify with SwapPulse**',
          'Connect your SwapPulse account for reputation and staff roles:',
          'https://swappulse.org/settings?tab=discord',
          '',
          'Or complete the bot check to receive the Collector role:',
          captchaUrl,
          '',
          'This private link expires in 15 minutes and works once.',
        ].join('\n'),
      );
    }

    if (command === 'roles') {
      const links = await svc.entities.DiscordAccountLink
        .filter({ discord_user_id: String(discordUser.id), guild_id: discordGuildId(), status: 'verified' }, '-created_date', 1)
        .catch(() => []);
      const link = links?.[0];
      if (!link) return message('You are not verified yet. Use /verify to begin.');
      try {
        const result = await syncDiscordLink(svc, link, 'interaction');
        return message(`Your roles are up to date: ${result.desired_roles.join(', ') || 'no managed roles'}.`);
      } catch {
        return message('Your roles could not be refreshed just now. Please try again later or use the support forum.');
      }
    }

    if (command === 'support') {
      const channels = config.channel_ids || {};
      const links = [
        channels.support ? `Support: <#${channels.support}>` : '',
        channels.developers ? `Developer forum: <#${channels.developers}>` : '',
        channels.features ? `Feature requests: <#${channels.features}>` : '',
        channels.announcements ? `Announcements: <#${channels.announcements}>` : '',
      ].filter(Boolean);
      return message(links.length ? links.join('\n') : 'Support channels are still being configured.');
    }

    return message('Unknown command. Try /verify, /roles, or /support.');
  } catch (error) {
    console.error('discord-interactions:', String(error?.message || error).split(':')[0]);
    return message('SwapPulse Bot could not complete that request. Please try again shortly.');
  }
});
