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
  let lastNetworkError: unknown = null;
  for (let attempt = 0; attempt < DISCORD_API_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${DISCORD_API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bot ${discordBotToken()}`,
          'Content-Type': 'application/json',
          ...(init.headers || {}),
        },
      });
    } catch (error) {
      lastNetworkError = error;
      if (attempt + 1 < DISCORD_API_ATTEMPTS) {
        await pause(250 * (attempt + 1));
        continue;
      }
      throw new Error('DISCORD_API_UNREACHABLE');
    }

    if (response.status === 204) return null;
    const body = await response.json().catch(() => ({}));
    if (response.ok) return body;

    if (response.status === 429) {
      const waitMs = rateLimitDelayMs(response, body);
      if (
        attempt + 1 < DISCORD_API_ATTEMPTS
        && waitMs > 0
        && waitMs <= MAX_RATE_LIMIT_WAIT_MS
      ) {
        await pause(waitMs + 50);
        continue;
      }
      throw new Error(`DISCORD_RATE_LIMITED:${waitMs}`);
    }

    if (
      [502, 503, 504].includes(response.status)
      && attempt + 1 < DISCORD_API_ATTEMPTS
    ) {
      await pause(250 * (attempt + 1));
      continue;
    }

    const code = response.status === 403
      ? 'DISCORD_ROLE_HIERARCHY'
      : 'DISCORD_API_FAILED';
    throw new Error(
      `${code}:${response.status}:${String(body?.message || 'Discord request failed').slice(0, 160)}`,
    );
  }
  throw new Error(lastNetworkError ? 'DISCORD_API_UNREACHABLE' : 'DISCORD_API_FAILED');
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
  if (existing) {
    await svc.entities.DiscordAccountLink.update(existing.id, values);
    return { ...existing, ...values };
  }
  return svc.entities.DiscordAccountLink.create(values);
}

function uniqueById(rows: any[]): any[] {
  return Array.from(new Map(rows.filter(Boolean).map((row) => [row.id, row])).values());
}

async function evaluateAccountRoles(svc: any, user: any, link: any, config: any) {
  const metrics: Record<string, unknown> = {
    verification_method: link.verification_method,
    account_role: user?.role || null,
  };
  if (link.status !== 'verified') return { desired: [] as RoleName[], metrics };
  if (link.verification_method === 'captcha' || !user) {
    return { desired: ['Collector'] as RoleName[], metrics };
  }

  const statuses = await svc.entities.AccountStatus
    .filter({ user_id: user.id }, '-created_date', 1)
    .catch(() => []);
  const accountStatus = statuses?.[0]?.status || 'active';
  metrics.account_status = accountStatus;
  if (accountStatus !== 'active') return { desired: [] as RoleName[], metrics };

  const did = String(user.did || '').trim();
  const [ratings, byOwner, byDid, achievements, meetups] = await Promise.all([
    did ? svc.entities.Reputation.filter({ did }, '-created_date', 500).catch(() => []) : [],
    svc.entities.TradeListing.filter({ created_by_id: user.id }, '-created_date', 500).catch(() => []),
    did ? svc.entities.TradeListing.filter({ did }, '-created_date', 500).catch(() => []) : [],
    did ? svc.entities.Achievement.filter({ did, status: 'granted' }, '-created_date', 100).catch(() => []) : [],
    did ? svc.entities.Meetup.filter({ creator_did: did }, '-created_date', 100).catch(() => []) : [],
  ]);
  const trades = uniqueById([...byOwner, ...byDid]);
  const completed = trades.filter((trade: any) => trade.status === 'completed');
  const average = ratings.length
    ? ratings.reduce((sum: number, rating: any) => sum + Number(rating.rating || 0), 0) / ratings.length
    : 0;
  const tradeIds = trades.map((trade: any) => trade.id).filter(Boolean);
  const disputes = tradeIds.length
    ? await svc.entities.TradeDispute
      .filter({ trade_id: { $in: tradeIds }, status: { $in: ['pending', 'reviewed'] } }, '-created_date', 100)
      .catch(() => [])
    : [];
  const achievementTypes = new Set(achievements.map((item: any) => item.achievement_type));
  const desired: RoleName[] = ['Collector', 'Verified SwapPulse Account'];

  const verifiedTrader = completed.length >= Number(config.verified_trader_min_completed || 3)
    && ratings.length >= Number(config.verified_trader_min_reviews || 3)
    && average >= Number(config.verified_trader_min_average || 4.5)
    && disputes.length === 0;
  if (verifiedTrader) desired.push('Verified Trader');

  const trustedTrader = disputes.length === 0 && (
    achievementTypes.has('trusted_trader')
    || (
      completed.length >= Number(config.trusted_trader_min_completed || 10)
      && average >= Number(config.trusted_trader_min_average || 4.75)
    )
  );
  if (trustedTrader) desired.push('Trusted Trader');

  const contributorTypes = ['scanner_sage', 'binder_curator', 'community_voice', 'card_reviewer'];
  if (contributorTypes.some((type) => achievementTypes.has(type)) || achievements.length >= 3) {
    desired.push('Contributor');
  }
  if (
    meetups.some((meetup: any) => meetup.status === 'completed')
    || achievementTypes.has('community_voice')
  ) {
    desired.push('Event Organiser');
  }
  if (user.role === 'moderator') desired.push('Moderator');
  if (user.role === 'admin') desired.push('Administrator');

  Object.assign(metrics, {
    completed_trades: completed.length,
    reputation_reviews: ratings.length,
    reputation_average: Number(average.toFixed(2)),
    active_disputes: disputes.length,
    granted_achievements: achievements.length,
    completed_meetups: meetups.filter((meetup: any) => meetup.status === 'completed').length,
  });
  return { desired, metrics };
}

async function audit(svc: any, values: any) {
  await svc.entities.DiscordRoleSyncAudit.create({
    ...values,
    message: String(values?.message || '').slice(0, 300),
    synced_at: new Date().toISOString(),
  }).catch((error: any) => {
    console.error('discordBot: audit write failed', error?.message || error);
  });
}

export async function syncDiscordLink(
  svc: any,
  link: any,
  source: SyncSource,
) {
  const config = await getGuildConfig(svc, true);
  if (String(link.guild_id) !== String(config.guild_id)) throw new Error('DISCORD_GUILD_MISMATCH');
  let user: any = null;
  if (link.user_id) {
    const users = await svc.entities.User.filter({ id: link.user_id }, '-created_date', 1).catch(() => []);
    user = users?.[0] || null;
  }

  try {
    const { desired, metrics } = await evaluateAccountRoles(svc, user, link, config);
    const roleIds = config.role_ids || {};
    const managedIds = Object.values(roleIds).map(String).filter(Boolean);
    const desiredIds = desired.map((name) => String(roleIds[name] || '')).filter(Boolean);
    const missingDefinitions = desired.filter((name) => !roleIds[name]);
    if (missingDefinitions.length > 0) {
      throw new Error(`DISCORD_ROLE_CONFIG_MISSING:${missingDefinitions.join(',')}`);
    }

    const member = await discordRequest(
      `/guilds/${encodeURIComponent(config.guild_id)}/members/${encodeURIComponent(link.discord_user_id)}`,
    );
    const currentIds = Array.isArray(member?.roles) ? member.roles.map(String) : [];
    const addIds = desiredIds.filter((id) => !currentIds.includes(id));
    const removeIds = managedIds.filter((id) => currentIds.includes(id) && !desiredIds.includes(id));

    for (const roleId of addIds) {
      await discordRequest(
        `/guilds/${encodeURIComponent(config.guild_id)}/members/${encodeURIComponent(link.discord_user_id)}/roles/${encodeURIComponent(roleId)}`,
        { method: 'PUT' },
      );
    }
    for (const roleId of removeIds) {
      await discordRequest(
        `/guilds/${encodeURIComponent(config.guild_id)}/members/${encodeURIComponent(link.discord_user_id)}/roles/${encodeURIComponent(roleId)}`,
        { method: 'DELETE' },
      );
    }

    const appliedAt = new Date().toISOString();
    await svc.entities.DiscordAccountLink.update(link.id, {
      desired_roles: desired,
      applied_roles: desired,
      last_role_sync_at: appliedAt,
      last_sync_error: '',
    });
    await audit(svc, {
      user_id: link.user_id || '',
      discord_user_id: link.discord_user_id,
      guild_id: config.guild_id,
      source,
      outcome: link.status === 'verified' ? 'synced' : 'revoked',
      desired_roles: desired,
      added_roles: addIds,
      removed_roles: removeIds,
      metrics,
    });
    return { ok: true, desired_roles: desired, added: addIds.length, removed: removeIds.length, metrics };
  } catch (error) {
    const message = String(error?.message || 'Discord role sync failed').slice(0, 300);
    await svc.entities.DiscordAccountLink.update(link.id, {
      last_role_sync_at: new Date().toISOString(),
      last_sync_error: message,
    }).catch(() => {});
    await audit(svc, {
      user_id: link.user_id || '',
      discord_user_id: link.discord_user_id,
      guild_id: link.guild_id,
      source,
      outcome: 'failed',
      error_code: message.split(':')[0],
      message,
    });
    throw error;
  }
}
