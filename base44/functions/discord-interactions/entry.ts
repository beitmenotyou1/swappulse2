import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  discordApplicationId,
  discordGuildId,
  discordPublicKey,
  getGuildConfig,
  randomToken,
  sha256Hex,
} from '../../shared/discordBot.ts';
import { discordCopy } from '../../shared/discordLocale.ts';

export function hexBytes(value: string, expectedBytes: number): Uint8Array {
  if (!new RegExp(`^[0-9a-f]{${expectedBytes * 2}}$`, 'i').test(value)) {
    throw new Error('DISCORD_HEX_INVALID');
  }
  return Uint8Array.from(value.match(/.{2}/g) || [], (pair) => Number.parseInt(pair, 16));
}

async function boundedBody(req: Request): Promise<string> {
  const maxBytes = 64 * 1024;
  const length = Number(req.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes) throw new Error('DISCORD_BODY_TOO_LARGE');
  const reader = req.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error('DISCORD_BODY_TOO_LARGE');
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(combined);
}

async function verifySignature(req: Request, raw: string): Promise<boolean> {
  const signature = req.headers.get('x-signature-ed25519') || '';
  const timestamp = req.headers.get('x-signature-timestamp') || '';
  if (!/^[0-9a-f]{128}$/i.test(signature) || !/^\d{10,13}$/.test(timestamp)) return false;
  const timeMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timeMs) || Math.abs(Date.now() - timeMs) > 5 * 60 * 1000) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    hexBytes(discordPublicKey(), 32),
    { name: 'Ed25519' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    'Ed25519',
    key,
    hexBytes(signature, 64),
    new TextEncoder().encode(timestamp + raw),
  );
}

function message(content: string, components: any[] = []) {
  return Response.json({
    type: 4,
    data: {
      content,
      flags: 64,
      allowed_mentions: { parse: [] },
      ...(components.length ? { components } : {}),
    },
  });
}

function linkButtons(accountUrl: string, accountLabel: string, captchaUrl: string, captchaLabel: string) {
  return [{
    type: 1,
    components: [
      { type: 2, style: 5, label: accountLabel, url: accountUrl },
      { type: 2, style: 5, label: captchaLabel, url: captchaUrl },
    ],
  }];
}

Deno.serve(async (req) => {
  let raw: string;
  try {
    raw = await boundedBody(req);
  } catch {
    return Response.json({ error: 'Discord interaction body too large or invalid' }, { status: 413 });
  }
  let copy = discordCopy('en-GB');
  try {
    if (!await verifySignature(req, raw)) {
      return Response.json({ error: 'Invalid Discord signature' }, { status: 401 });
    }
  } catch {
    return Response.json({ error: 'Invalid Discord signature' }, { status: 401 });
  }

  try {
    const interaction = JSON.parse(raw);
    copy = discordCopy(interaction.locale || interaction.guild_locale);
    if (String(interaction.application_id || '') !== discordApplicationId()) {
      return Response.json({ error: 'Wrong Discord application' }, { status: 401 });
    }
    if (interaction.type === 1) return Response.json({ type: 1 });
    if (interaction.type !== 2) return message(copy.unsupported);

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const config = await getGuildConfig(svc, true);
    if (String(interaction.guild_id || '') !== String(config.guild_id)) {
      return message(copy.wrongServer);
    }
    const discordUser = interaction.member?.user || interaction.user;
    if (!discordUser?.id) return message(copy.accountUnknown);
    const command = String(interaction.data?.name || '');

    if (command === 'verify') {
      const now = Date.now();
      const interactionHash = await sha256Hex(String(interaction.id || ''));
      const previous = await svc.entities.DiscordVerificationChallenge.filter(
        { discord_user_id: String(discordUser.id), guild_id: discordGuildId(), purpose: 'captcha' },
        '-created_date', 20,
      );
      if (previous.some((row: any) => row.interaction_id_hash === interactionHash
        || (!row.used_at && Date.parse(row.expires_at) > now
          && Date.parse(row.created_date) > now - 60_000))) {
        return message(copy.verifyCooldown);
      }
      for (const row of previous.filter((item: any) => !item.used_at && Date.parse(item.expires_at) > now)) {
        await svc.entities.DiscordVerificationChallenge.update(row.id, { used_at: new Date(now).toISOString() });
      }
      const token = randomToken(32);
      const expires = now + 15 * 60 * 1000;
      await svc.entities.DiscordVerificationChallenge.create({
        challenge_hash: await sha256Hex(token),
        interaction_id_hash: interactionHash,
        discord_user_id: String(discordUser.id),
        guild_id: discordGuildId(),
        purpose: 'captcha',
        expires_at: new Date(expires).toISOString(),
      });
      const captchaUrl = `https://swappulse.org/discord-verify?challenge=${encodeURIComponent(token)}`;
      const accountUrl = 'https://swappulse.org/settings?tab=discord';
      return message(
        [copy.verifyTitle, copy.verifyBody].join('\n\n'),
        linkButtons(
          accountUrl,
          copy.accountButton,
          captchaUrl,
          copy.captchaButton,
        ),
      );
    }

    if (command === 'roles') {
      const links = await svc.entities.DiscordAccountLink
        .filter({ discord_user_id: String(discordUser.id), guild_id: discordGuildId(), status: 'verified' }, '-created_date', 1)
        .catch(() => []);
      const link = links?.[0];
      if (!link) return message(copy.notVerified);
      if (link.user_id) {
        const users = await svc.entities.User
          .filter({ id: link.user_id }, '-created_date', 1)
          .catch(() => []);
        copy = discordCopy(users?.[0]?.locale || interaction.locale || interaction.guild_locale);
      }
      const roles = Array.isArray(link.applied_roles)
        ? link.applied_roles.filter(Boolean).join(', ')
        : '';
      return message(roles ? copy.rolesCurrent(roles) : copy.rolesPending);
    }

    if (command === 'support') {
      const channels = config.channel_ids || {};
      const links = [
        channels.support ? `${copy.support}: <#${channels.support}>` : '',
        channels.developers ? `${copy.developers}: <#${channels.developers}>` : '',
        channels.features ? `${copy.features}: <#${channels.features}>` : '',
        channels.announcements ? `${copy.announcements}: <#${channels.announcements}>` : '',
      ].filter(Boolean);
      return message(links.length ? links.join('\n') : copy.supportPending);
    }

    return message(copy.unknownCommand);
  } catch (error) {
    console.error('discord-interactions:', String(error?.message || error).split(':')[0]);
    return message(copy.temporaryError);
  }
});
