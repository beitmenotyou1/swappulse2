import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  discordApplicationId,
  discordGuildId,
  discordPublicKey,
  discordRequest,
  DISCORD_INSTALL_PERMISSIONS,
  ROLE_DEFINITIONS,
} from '../../shared/discordBot.ts';

const APPLY_CONFIRMATION = 'CREATE_SWAPPULSE_DISCORD_STRUCTURE';
const INTERACTIONS_URL = 'https://swappulse.org/functions/discord-interactions';
const OAUTH_CALLBACK_URL = 'https://swappulse.org/functions/discord-link-callback';
const TERMS_URL = 'https://swappulse.org/terms';
const PRIVACY_URL = 'https://swappulse.org/privacy';
const APP_DESCRIPTION = 'Official SwapPulse support, account verification and community role synchronisation for Pokémon TCG collectors.';
const LOGO_URL = 'https://media.base44.com/images/public/6a63d9d64a4d65d370c70892/32ce16a82_a_transparent_version_of_the_socialpulse_logo_a_digital_pulse_line_forming_an_s1.png';

async function logoDataUri(): Promise<string | null> {
  try {
    const response = await fetch(LOGO_URL, { redirect: 'follow' });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 1_000_000) return null;
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:image/png;base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

async function ensureRole(existing: any[], definition: any) {
  const expectedHoist = ['Moderator', 'Administrator'].includes(definition.name);
  const found = existing.find((role) => role.name === definition.name);
  if (found) {
    const exact = !found.managed
      && Number(found.color || 0) === Number(definition.colour)
      && String(found.permissions || '0') === String(definition.permissions)
      && Boolean(found.mentionable) === false
      && Boolean(found.hoist) === expectedHoist;
    if (!exact) throw new Error(`DISCORD_ROLE_CONFLICT:${definition.name}`);
    return found;
  }
  return discordRequest(
    `/guilds/${encodeURIComponent(discordGuildId())}/roles`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: definition.name,
        color: definition.colour,
        permissions: definition.permissions,
        mentionable: false,
        hoist: expectedHoist,
      }),
    },
  );
}

function privateOverwrites(
  guildId: string,
  roleIds: Record<string, string>,
  botUserId: string,
) {
  return [
    { id: guildId, type: 0, deny: '1024', allow: '0' },
    { id: roleIds.Collector, type: 0, deny: '0', allow: String(1024n | 2048n | 65536n | 34359738368n | 274877906944n) },
    { id: roleIds.Moderator, type: 0, deny: '0', allow: String(1024n | 2048n | 8192n | 65536n | 8589934592n | 17179869184n | 34359738368n | 274877906944n) },
    { id: roleIds.Administrator, type: 0, deny: '0', allow: String(1024n | 2048n | 8192n | 65536n | 8589934592n | 17179869184n | 34359738368n | 274877906944n) },
    { id: botUserId, type: 1, deny: '0', allow: String(1024n | 2048n | 8192n | 65536n | 17179869184n | 34359738368n | 274877906944n) },
  ].filter((item) => item.id);
}

function normaliseOverwrites(overwrites: any[] = []) {
  return overwrites
    .map((item) => ({
      id: String(item.id || ''),
      type: Number(item.type),
      allow: String(item.allow || '0'),
      deny: String(item.deny || '0'),
    }))
    .sort((left, right) => `${left.type}:${left.id}`.localeCompare(`${right.type}:${right.id}`));
}

function normaliseTags(tags: any[] = []) {
  return tags
    .map((tag) => ({
      name: String(tag.name || ''),
      moderated: Boolean(tag.moderated),
      emoji_id: tag.emoji_id ? String(tag.emoji_id) : null,
      emoji_name: tag.emoji_name ? String(tag.emoji_name) : null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function installationUrl(applicationId: string): string {
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', applicationId);
  url.searchParams.set('permissions', DISCORD_INSTALL_PERMISSIONS);
  url.searchParams.set('integration_type', '0');
  url.searchParams.set('scope', 'bot applications.commands');
  return url.toString();
}

function effectivePermissions(guildId: string, member: any, roles: any[]): bigint {
  const memberRoleIds = new Set([guildId, ...(member?.roles || []).map(String)]);
  return roles
    .filter((role) => memberRoleIds.has(String(role.id)))
    .reduce((permissions, role) => permissions | BigInt(String(role.permissions || '0')), 0n);
}

async function ensureChannel(existing: any[], values: any) {
  const named = existing.filter((channel) => channel.name === values.name);
  if (named.length === 0) {
    return discordRequest(
      `/guilds/${encodeURIComponent(discordGuildId())}/channels`,
      { method: 'POST', body: JSON.stringify(values) },
    );
  }
  const found = named.find((channel) => channel.type === values.type);
  const exact = found
    && String(found.parent_id || '') === String(values.parent_id || '')
    && String(found.topic || '') === String(values.topic || '')
    && (
      !Array.isArray(values.permission_overwrites)
      || JSON.stringify(normaliseOverwrites(found.permission_overwrites))
        === JSON.stringify(normaliseOverwrites(values.permission_overwrites))
    )
    && (
      values.default_auto_archive_duration === undefined
      || Number(found.default_auto_archive_duration) === Number(values.default_auto_archive_duration)
    )
    && (
      !Array.isArray(values.available_tags)
      || JSON.stringify(normaliseTags(found.available_tags))
        === JSON.stringify(normaliseTags(values.available_tags))
    );
  if (!exact) throw new Error(`DISCORD_CHANNEL_CONFLICT:${values.name}`);
  return found;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const apply = body?.apply === true;
    if (!apply) {
      const configuredApplicationId = String(Deno.env.get('DISCORD_APPLICATION_ID') || '').trim();
      return Response.json({
        ok: true,
        mode: 'preview',
        confirmation_required: APPLY_CONFIRMATION,
        bot_name: 'SwapPulse Bot',
        roles: ROLE_DEFINITIONS.map((role) => role.name),
        channels: ['verify-with-swappulse', 'announcements', 'support', 'developer-forum', 'feature-requests'],
        portal: {
          application_id: configuredApplicationId || 'Configure DISCORD_APPLICATION_ID',
          interactions_endpoint_url: INTERACTIONS_URL,
          oauth_redirect_uri: OAUTH_CALLBACK_URL,
          terms_url: TERMS_URL,
          privacy_url: PRIVACY_URL,
          install_scopes: ['bot', 'applications.commands'],
          install_permissions: DISCORD_INSTALL_PERMISSIONS,
          install_url: configuredApplicationId ? installationUrl(configuredApplicationId) : '',
          user_install: 'Disable',
          guild_install: 'Enable',
          public_bot_during_private_testing: 'Disable',
          privileged_gateway_intents: 'Keep all disabled',
          activities_social_sdk_rich_presence: 'Not used',
        },
        notes: [
          'New community forums are hidden from @everyone and visible to Collector or staff roles.',
          'Existing Discord channels and permissions are not changed.',
          'No Administrator permission is granted to the bot-managed Administrator role.',
          'The exact Developer Portal prerequisites are checked before any Discord structure is created.',
        ],
      });
    }
    if (body?.confirmation !== APPLY_CONFIRMATION) {
      return Response.json({ error: 'Exact confirmation is required.' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const guildId = discordGuildId();
    const applicationId = discordApplicationId();
    const [application, botUser] = await Promise.all([
      discordRequest('/oauth2/applications/@me'),
      discordRequest('/users/@me'),
    ]);
    if (String(application?.id || '') !== applicationId) {
      throw new Error('DISCORD_APPLICATION_ID_MISMATCH');
    }
    if (String(application?.verify_key || '').toLowerCase() !== discordPublicKey().toLowerCase()) {
      throw new Error('DISCORD_PUBLIC_KEY_MISMATCH');
    }
    if (String(application?.name || '') !== 'SwapPulse Bot') {
      throw new Error('DISCORD_APPLICATION_NAME_MISMATCH');
    }
    if (!Array.isArray(application?.redirect_uris) || !application.redirect_uris.includes(OAUTH_CALLBACK_URL)) {
      throw new Error('DISCORD_OAUTH_REDIRECT_MISSING');
    }
    if (String(application?.terms_of_service_url || '') !== TERMS_URL
      || String(application?.privacy_policy_url || '') !== PRIVACY_URL) {
      throw new Error('DISCORD_LEGAL_URLS_MISSING');
    }
    if (application?.bot_public !== false) {
      throw new Error('DISCORD_PUBLIC_BOT_MUST_BE_DISABLED');
    }

    const avatar = await logoDataUri();
    await discordRequest('/applications/@me', {
      method: 'PATCH',
      body: JSON.stringify({
        description: APP_DESCRIPTION,
        interactions_endpoint_url: INTERACTIONS_URL,
        tags: ['collecting', 'trading', 'support', 'community'],
        integration_types_config: {
          '0': {
            oauth2_install_params: {
              scopes: ['applications.commands', 'bot'],
              permissions: DISCORD_INSTALL_PERMISSIONS,
            },
          },
        },
        ...(avatar ? { icon: avatar } : {}),
      }),
    });

    const [guild, botMember, existingRoles] = await Promise.all([
      discordRequest(`/guilds/${encodeURIComponent(guildId)}`),
      discordRequest(`/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(botUser.id)}`),
      discordRequest(`/guilds/${encodeURIComponent(guildId)}/roles`),
    ]);
    const permissions = effectivePermissions(guildId, botMember, existingRoles);
    const requiredPermissions = BigInt(DISCORD_INSTALL_PERMISSIONS);
    if ((permissions & requiredPermissions) !== requiredPermissions) {
      throw new Error('DISCORD_INSTALL_PERMISSIONS_MISSING');
    }
    const roleIds: Record<string, string> = {};
    for (const definition of ROLE_DEFINITIONS) {
      const role = await ensureRole(existingRoles, definition);
      roleIds[definition.name] = String(role.id);
      if (!existingRoles.some((item: any) => item.id === role.id)) existingRoles.push(role);
    }

    const existingChannels = await discordRequest(`/guilds/${encodeURIComponent(guildId)}/channels`);
    const category = await ensureChannel(existingChannels, {
      name: 'SwapPulse Community',
      type: 4,
      position: 0,
    });
    if (!existingChannels.some((item: any) => item.id === category.id)) existingChannels.push(category);

    const verify = await ensureChannel(existingChannels, {
      name: 'verify-with-swappulse',
      type: 0,
      parent_id: category.id,
      topic: 'Use /verify to link your SwapPulse account or complete the CAPTCHA bot check.',
      permission_overwrites: [
        { id: guildId, type: 0, deny: '0', allow: String(1024n | 2048n | 65536n) },
      ],
    });
    const privatePermissions = privateOverwrites(guildId, roleIds, String(botUser.id));
    const channelSpecs = [
      {
        key: 'announcements', name: 'announcements',
        topic: 'Official SwapPulse updates and service notices.',
        tags: ['Release', 'Service notice', 'Community update'],
      },
      {
        key: 'support', name: 'support',
        topic: 'Ask for help with SwapPulse accounts, collections, trades and services.',
        tags: ['Account', 'Collection', 'Trading', 'Technical', 'Safety'],
      },
      {
        key: 'developers', name: 'developer-forum',
        topic: 'Technical discussion for the site, AT Protocol and SwapPulse chain.',
        tags: ['Bug', 'API', 'Chain', 'AT Protocol', 'Documentation'],
      },
      {
        key: 'features', name: 'feature-requests',
        topic: 'Suggest and discuss improvements to SwapPulse.',
        tags: ['Idea', 'User experience', 'Scanner', 'Helper', 'Trading'],
      },
    ];
    const channelIds: Record<string, string> = { verification: String(verify.id) };
    for (const spec of channelSpecs) {
      const channel = await ensureChannel(existingChannels, {
        name: spec.name,
        type: 15,
        parent_id: category.id,
        topic: spec.topic,
        permission_overwrites: privatePermissions,
        available_tags: spec.tags.map((name) => ({ name, moderated: false })),
        default_auto_archive_duration: 10080,
      });
      channelIds[spec.key] = String(channel.id);
      if (!existingChannels.some((item: any) => item.id === channel.id)) existingChannels.push(channel);
    }

    await discordRequest(
      `/applications/${encodeURIComponent(discordApplicationId())}/guilds/${encodeURIComponent(guildId)}/commands`,
      {
        method: 'PUT',
        body: JSON.stringify([
          {
            name: 'verify',
            description: 'Verify with SwapPulse or complete the Collector bot check',
            type: 1,
            integration_types: [0],
            contexts: [0],
          },
          {
            name: 'roles',
            description: 'Show your current SwapPulse-managed Discord roles',
            type: 1,
            integration_types: [0],
            contexts: [0],
          },
          {
            name: 'support',
            description: 'Find the official SwapPulse support forums',
            type: 1,
            integration_types: [0],
            contexts: [0],
          },
        ]),
      },
    );

    await discordRequest('/users/@me', {
      method: 'PATCH',
      body: JSON.stringify({ username: 'SwapPulse Bot', ...(avatar ? { avatar } : {}) }),
    }).catch((error) => console.error('discord-bootstrap: branding update skipped', String(error?.message || error).split(':')[0]));

    const existingConfigs = await svc.entities.DiscordGuildConfig
      .filter({ guild_id: guildId }, '-created_date', 1)
      .catch(() => []);
    const values = {
      guild_id: guildId,
      enabled: true,
      bot_user_id: String(botUser?.id || ''),
      role_ids: roleIds,
      channel_ids: channelIds,
      last_bootstrap_at: new Date().toISOString(),
      schema_version: 1,
    };
    const config = existingConfigs?.[0]
      ? await svc.entities.DiscordGuildConfig.update(existingConfigs[0].id, values)
      : await svc.entities.DiscordGuildConfig.create(values);

    return Response.json({
      ok: true,
      mode: 'applied',
      guild: { id: guildId, name: guild?.name || '' },
      roles: roleIds,
      channels: channelIds,
      config_id: config?.id || existingConfigs?.[0]?.id || '',
    });
  } catch (error) {
    const code = String(error?.message || 'DISCORD_BOOTSTRAP_FAILED').split(':')[0];
    console.error('discord-bootstrap:', code);
    return Response.json({ error: 'Discord setup could not be completed.', code }, { status: 502 });
  }
});
