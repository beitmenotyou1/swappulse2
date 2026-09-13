const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_API_ATTEMPTS = 3;
const MAX_RATE_LIMIT_WAIT_MS = 30_000;

// CREATE_INSTANT_INVITE is required by Discord's Add Guild Member endpoint.
// MANAGE_CHANNELS is used only by the confirmed bootstrap. MANAGE_ROLES is
// required for ongoing role reconciliation. No Administrator permission or
// privileged Gateway intent is required.
export const DISCORD_INSTALL_PERMISSIONS = String(1n | 16n | 268435456n);

export const ROLE_DEFINITIONS = [
  { key: 'collector', name: 'Collector', colour: 0x8b5cf6, permissions: '0' },
  { key: 'verified_account', name: 'Verified SwapPulse Account', colour: 0x22c55e, permissions: '0' },
  { key: 'verified_trader', name: 'Verified Trader', colour: 0x14b8a6, permissions: '0' },
  { key: 'trusted_trader', name: 'Trusted Trader', colour: 0xf59e0b, permissions: '0' },
  { key: 'contributor', name: 'Contributor', colour: 0x3b82f6, permissions: '0' },
  { key: 'event_organiser', name: 'Event Organiser', colour: 0xec4899, permissions: '0' },
  { key: 'moderator', name: 'Moderator', colour: 0x0ea5e9, permissions: String(8192n | 17179869184n | 8589934592n) },
  { key: 'administrator', name: 'Administrator', colour: 0xef4444, permissions: String(16n | 8192n | 134217728n | 268435456n | 8589934592n | 17179869184n) },
] as const;

export type RoleName = typeof ROLE_DEFINITIONS[number]['name'];
export type SyncSource = 'oauth' | 'captcha' | 'interaction' | 'scheduled' | 'admin';

function requiredEnv(name: string): string {
  const value = String(Deno.env.get(name) || '').trim();
  if (!value) throw new Error(`DISCORD_CONFIG_MISSING:${name}`);
  return value;
}

export function discordGuildId(): string {
  return requiredEnv('DISCORD_GUILD_ID');
}

export function discordApplicationId(): string {
  return requiredEnv('DISCORD_APPLICATION_ID');
}

export function discordRedirectUri(): string {
  return requiredEnv('DISCORD_REDIRECT_URI');
}

export function discordBotToken(): string {
  return requiredEnv('DISCORD_BOT_TOKEN');
}

export function discordPublicKey(): string {
  return requiredEnv('DISCORD_PUBLIC_KEY');
}

export function discordTurnstileSiteKey(): string {
  return requiredEnv('TURNSTILE_SITE_KEY');
}

export function configuredForDiscord(): boolean {
  return [
    'DISCORD_GUILD_ID',
    'DISCORD_APPLICATION_ID',
    'DISCORD_BOT_TOKEN',
  ].every((name) => String(Deno.env.get(name) || '').trim().length > 0);
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function rateLimitDelayMs(response: Response, body: any): number {
  const headerSeconds = Number(response.headers.get('retry-after') || NaN);
  const bodySeconds = Number(body?.retry_after ?? NaN);
  const seconds = Number.isFinite(headerSeconds) ? headerSeconds : bodySeconds;
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds * 1000) : 0;
}

export async function discordRequest(path: string, init: RequestInit = {}) {
  const deadline = Date.now() + 20_000;
  for (let attempt = 0; attempt < DISCORD_API_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('DISCORD_API_TIMEOUT');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(7_000, remaining));
    let response: Response;
    let body: any;
    try {
      response = await fetch(`${DISCORD_API}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          ...Object.fromEntries(new Headers(init.headers)),
          Authorization: `Bot ${discordBotToken()}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.status === 204) return null;
      try {
        body = await response.json();
      } catch (error) {
        if (controller.signal.aborted) throw error;
        body = {};
      }
    } catch (error) {
      if (attempt + 1 < DISCORD_API_ATTEMPTS && Date.now() < deadline) {
        await pause(250 * (attempt + 1));
        continue;
      }
      throw new Error(controller.signal.aborted ? 'DISCORD_API_TIMEOUT' : 'DISCORD_API_UNREACHABLE');
    } finally {
      clearTimeout(timeout);
    }
    if (response.ok) return body;
    if (response.status === 429) {
      const waitMs = rateLimitDelayMs(response, body);
      if (attempt + 1 < DISCORD_API_ATTEMPTS && waitMs > 0
        && waitMs <= MAX_RATE_LIMIT_WAIT_MS && waitMs + 50 < deadline - Date.now()) {
        await pause(waitMs + 50);
        continue;
      }
      throw new Error(`DISCORD_RATE_LIMITED:${waitMs}`);
    }
    if ([502, 503, 504].includes(response.status)
      && attempt + 1 < DISCORD_API_ATTEMPTS && Date.now() < deadline) {
      await pause(250 * (attempt + 1));
      continue;
    }
    const code = response.status === 403 ? 'DISCORD_PERMISSION_DENIED' : 'DISCORD_API_FAILED';
    throw new Error(`${code}:${response.status}:${String(body?.message || 'Discord request failed').slice(0, 160)}`);
  }
  throw new Error('DISCORD_API_TIMEOUT');
}

export async function getGuildConfig(svc: any, requireEnabled = true) {
  const guildId = discordGuildId();
  const rows = await svc.entities.DiscordGuildConfig
    .filter({ guild_id: guildId }, '-created_date', 1)
    .catch(() => []);
  const config = rows?.[0] || null;
  if (!config) throw new Error('DISCORD_NOT_BOOTSTRAPPED');
  if (requireEnabled && !config.enabled) throw new Error('DISCORD_SYNC_DISABLED');
  return config;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function textToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToText(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function hmac(value: string): Promise<string> {
  const secret = requiredEnv('DISCORD_LINK_STATE_SECRET');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createSignedState(payload: Record<string, unknown>): Promise<string> {
  const encoded = textToBase64Url(JSON.stringify(payload));
  return `${encoded}.${await hmac(encoded)}`;
}

export async function readSignedState(state: string): Promise<any> {
  const [encoded, signature, extra] = String(state || '').split('.');
  if (!encoded || !signature || extra) throw new Error('DISCORD_STATE_INVALID');
  const expected = await hmac(encoded);
  if (signature.length !== expected.length) throw new Error('DISCORD_STATE_INVALID');
  let mismatch = 0;
  for (let i = 0; i < signature.length; i += 1) mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  if (mismatch !== 0) throw new Error('DISCORD_STATE_INVALID');
  const payload = JSON.parse(base64UrlToText(encoded));
  if (!payload?.exp || Number(payload.exp) < Date.now()) throw new Error('DISCORD_STATE_EXPIRED');
  return payload;
}

export async function upsertDiscordLink(svc: any, values: any) {
  const matches = await svc.entities.DiscordAccountLink
    .filter({ discord_user_id: values.discord_user_id, guild_id: values.guild_id }, '-created_date', 5)
    .catch(() => []);
  const existing = matches?.[0];
  if (matches.length > 1 || (existing?.user_id
    && String(existing.user_id) !== String(values.user_id || '')
    && existing.status !== 'revoked')) {
    throw new Error('DISCORD_LINK_COLLISION');
  }
  if (existing) {
    await svc.entities.DiscordAccountLink.update(existing.id, values);
    return { ...existing, ...values };
  }
  return svc.entities.DiscordAccountLink.create(values);
}

// A role ID is a security-sensitive deployment pin, not a role chosen by the browser
// or a mutable configuration record. Check the guild role and bot hierarchy live.
export async function assertDiscordRolePins(config: any) {
  if (String(config.guild_id) !== discordGuildId() || !config.bot_user_id) {
    throw new Error('DISCORD_GUILD_MISMATCH');
  }
  const roles = await discordRequest(`/guilds/${encodeURIComponent(config.guild_id)}/roles`);
  const botMember = await discordRequest(
    `/guilds/${encodeURIComponent(config.guild_id)}/members/${encodeURIComponent(config.bot_user_id)}`,
  );
  if (!Array.isArray(roles) || !Array.isArray(botMember?.roles)) {
    throw new Error('DISCORD_ROLE_PINS_INVALID');
  }
  const botTop = Math.max(0, ...roles
    .filter((role: any) => botMember.roles.map(String).includes(String(role.id)))
    .map((role: any) => Number(role.position) || 0));
  const pinned = new Set<string>();
  for (const definition of ROLE_DEFINITIONS) {
    const id = String(config.role_ids?.[definition.name] || '');
    const role = roles.find((candidate: any) => String(candidate.id) === id);
    if (!id || pinned.has(id) || !role || role.name !== definition.name
      || role.managed || String(role.permissions || '0') !== definition.permissions
      || Number(role.color || 0) !== definition.colour
      || Boolean(role.hoist) !== ['Moderator', 'Administrator'].includes(definition.name)
      || Boolean(role.mentionable) || Number(role.position) >= botTop) {
      throw new Error(`DISCORD_ROLE_PINS_INVALID:${definition.name}`);
    }
    pinned.add(id);
  }
}

export async function evaluateAccountRoles(svc: any, user: any, link: any, _config: any) {
  const metrics: Record<string, unknown> = {
    verification_method: link.verification_method,
    account_role: user?.role || null,
  };
  if (link.status !== 'verified') return { desired: [] as RoleName[], metrics };
  if (link.verification_method === 'captcha' && !link.user_id) {
    return { desired: ['Collector'] as RoleName[], metrics };
  }
  // Missing or orphaned accounts must never fall back to CAPTCHA eligibility.
  if (!user || link.verification_method !== 'swappulse_account') {
    metrics.orphaned_account = true;
    return { desired: [] as RoleName[], metrics };
  }
  const statuses = await svc.entities.AccountStatus
    .filter({ user_id: user.id }, '-created_date', 1);
  const accountStatus = statuses?.[0]?.status || 'active';
  metrics.account_status = accountStatus;
  if (accountStatus !== 'active') return { desired: [] as RoleName[], metrics };

  const desired: RoleName[] = ['Collector', 'Verified SwapPulse Account'];
  // DIS-004/005/006: client-mutable trades, reputation, achievements and
  // meetups are not evidence for external Discord trust badges.
  // Staff roles remain disabled until Base44 staff-role demotions trigger
  // synchronous external revocation rather than a delayed repair sweep.
  return { desired, metrics };
}

async function audit(svc: any, values: any) {
  // An external privilege change without a durable record is unsafe.
  await svc.entities.DiscordRoleSyncAudit.create({
    ...values,
    message: String(values?.message || '').slice(0, 300),
    synced_at: new Date().toISOString(),
  });
}

export async function revokeUserDiscordLinks(svc: any, userId: string, source: SyncSource) {
  const links = await svc.entities.DiscordAccountLink
    .filter({ user_id: userId }, '-created_date', 1000);
  if (links.length >= 1000) throw new Error('DISCORD_LINK_BACKLOG');
  for (const link of links) {
    // Persist the pending state before contacting Discord. If anything fails,
    // the account remains intact and the scheduled sweep can retry removal.
    await svc.entities.DiscordAccountLink.update(link.id, {
      status: 'revocation_pending', desired_roles: [],
    });
    await syncDiscordLink(svc, { ...link, status: 'revocation_pending' }, source);
    await svc.entities.DiscordAccountLink.delete(link.id);
  }
  return links.length;
}

export async function syncUserDiscordLinks(svc: any, userId: string, source: SyncSource) {
  const links = await svc.entities.DiscordAccountLink
    .filter({ user_id: userId }, '-created_date', 1000);
  if (links.length >= 1000) throw new Error('DISCORD_LINK_BACKLOG');
  for (const link of links) await syncDiscordLink(svc, link, source);
  return links.length;
}

export async function syncDiscordLink(svc: any, link: any, source: SyncSource) {
  const config = await getGuildConfig(svc, link.status === 'verified');
  if (String(link.guild_id) !== String(config.guild_id)) throw new Error('DISCORD_GUILD_MISMATCH');
  let user: any = null;
  if (link.user_id && link.status === 'verified') {
    const users = await svc.entities.User.filter({ id: link.user_id }, '-created_date', 1);
    user = users?.[0] || null;
  }

  try {
    const { desired, metrics } = await evaluateAccountRoles(svc, user, link, config);
    await assertDiscordRolePins(config);
    const roleIds = config.role_ids || {};
    const managedIds = ROLE_DEFINITIONS.map((role) => String(roleIds[role.name]));
    const desiredIds = desired.map((name) => String(roleIds[name]));
    const memberPath = `/guilds/${encodeURIComponent(config.guild_id)}/members/${encodeURIComponent(link.discord_user_id)}`;
    let member: any;
    try {
      member = await discordRequest(memberPath);
    } catch (error) {
      if (!String(error?.message || '').startsWith('DISCORD_API_FAILED:404:')) throw error;
      // Discord confirms the person is not in the guild. No guild role can
      // remain, so revocation can complete even if they left the server.
      member = null;
    }
    if (!member && desired.length) throw new Error('DISCORD_MEMBER_NOT_FOUND');
    const currentIds = Array.isArray(member?.roles) ? member.roles.map(String) : [];
    const removeIds = managedIds.filter((id) => currentIds.includes(id) && !desiredIds.includes(id));
    const addIds = desiredIds.filter((id) => !currentIds.includes(id));

    if (removeIds.length || addIds.length) {
      await audit(svc, {
        user_id: link.user_id || '', discord_user_id: link.discord_user_id,
        guild_id: config.guild_id, source, outcome: 'preview', desired_roles: desired,
        added_roles: addIds, removed_roles: removeIds, metrics,
        message: 'Role mutation planned; see following outcome for confirmation',
      });
    }
    // Remove privileges first so an error never leaves newly granted roles on
    // one account while obsolete roles remain on another.
    for (const [method, ids] of [['DELETE', removeIds], ['PUT', addIds]] as const) {
      for (const roleId of ids) {
        await discordRequest(`${memberPath}/roles/${encodeURIComponent(roleId)}`, {
          method,
          headers: { 'X-Audit-Log-Reason': `SwapPulse ${source} role sync ${link.id}` },
        });
      }
    }
    const after = member ? await discordRequest(memberPath) : null;
    const liveIds = Array.isArray(after?.roles) ? after.roles.map(String) : [];
    const applied = ROLE_DEFINITIONS.filter((role) => liveIds.includes(String(roleIds[role.name])))
      .map((role) => role.name);
    if (applied.length !== desired.length || desired.some((name) => !applied.includes(name))) {
      throw new Error('DISCORD_ROLE_READBACK_MISMATCH');
    }
    const orphan = link.status === 'verified' && link.verification_method === 'swappulse_account' && !user;
    const revoked = link.status !== 'verified' || orphan || !member;
    await svc.entities.DiscordAccountLink.update(link.id, {
      status: revoked ? 'revoked' : 'verified',
      desired_roles: desired,
      applied_roles: applied,
      last_role_sync_at: new Date().toISOString(),
      last_sync_error: orphan ? 'DISCORD_ORPHANED_ACCOUNT' : '',
    });
    await audit(svc, {
      user_id: link.user_id || '', discord_user_id: link.discord_user_id,
      guild_id: config.guild_id, source,
      outcome: revoked ? 'revoked' : 'synced', desired_roles: desired,
      added_roles: addIds, removed_roles: removeIds, metrics,
      message: orphan ? 'Orphaned SwapPulse account revoked' : '',
    });
    return { ok: true, desired_roles: desired, added: addIds.length, removed: removeIds.length, metrics };
  } catch (error) {
    const message = String(error?.message || 'Discord role sync failed').slice(0, 300);
    // A partially applied operation must retain its pending state and report
    // the live roles when read-back is still possible.
    const roleIds = config.role_ids || {};
    const path = `/guilds/${encodeURIComponent(config.guild_id)}/members/${encodeURIComponent(link.discord_user_id)}`;
    const live = await discordRequest(path).catch(() => null);
    const applied = Array.isArray(live?.roles)
      ? ROLE_DEFINITIONS.filter((role) => live.roles.map(String).includes(String(roleIds[role.name])))
        .map((role) => role.name)
      : null;
    await svc.entities.DiscordAccountLink.update(link.id, {
      ...(applied ? { applied_roles: applied } : {}),
      last_role_sync_at: new Date().toISOString(),
      last_sync_error: message,
    }).catch(() => {});
    await audit(svc, {
      user_id: link.user_id || '', discord_user_id: link.discord_user_id,
      guild_id: link.guild_id, source, outcome: 'failed',
      error_code: message.split(':')[0], message,
      ...(applied ? { metrics: { live_managed_roles: applied } } : {}),
    });
    throw error;
  }
}

