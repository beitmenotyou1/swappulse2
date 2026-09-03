/*
 * Impact.com-backed TCGplayer affiliate link generation.
 *
 * Server-only configuration:
 * - IMPACT_ACCOUNT_SID       required
 * - IMPACT_AUTH_TOKEN        required
 * - IMPACT_TCGPLAYER_PROGRAM_ID optional override; otherwise joined programs are searched
 * - IMPACT_SOFT_CALLS_PER_HOUR optional, defaults to 800 (provider "Other" default is 1000/hour)
 *
 * The browser never receives the Impact auth token or Account SID. Generated
 * tracking links are cached persistently so normal card views do not repeatedly
 * create Impact links.
 */

const IMPACT_ORIGIN = 'https://api.impact.com';
const ALLOWED_DEST_HOSTS = new Set(['tcgplayer.com', 'www.tcgplayer.com']);
const PROGRAM_TTL_MS = 6 * 60 * 60 * 1000;
const TRACKING_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_PROVIDER_HOURLY_LIMIT = 1000;
const DEFAULT_SOFT_HOURLY_LIMIT = 800;

export const TCGPLAYER_AFFILIATE_DISCLOSURE = 'Affiliate link: SwapPulse may earn a commission from qualifying TCGplayer purchases at no extra cost to you.';

function envInt(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(Deno.env.get(name) || ''), 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function safeDestination(value: unknown) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || !ALLOWED_DEST_HOSTS.has(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function config() {
  const accountSid = String(Deno.env.get('IMPACT_ACCOUNT_SID') || '').trim();
  const authToken = String(Deno.env.get('IMPACT_AUTH_TOKEN') || '').trim();
  const programId = String(Deno.env.get('IMPACT_TCGPLAYER_PROGRAM_ID') || '').trim();
  return {
    accountSid,
    authToken,
    programId,
    configured: Boolean(accountSid && authToken),
    softCallsPerHour: envInt('IMPACT_SOFT_CALLS_PER_HOUR', DEFAULT_SOFT_HOURLY_LIMIT, 1, DEFAULT_PROVIDER_HOURLY_LIMIT),
    providerDefaultHourlyLimit: DEFAULT_PROVIDER_HOURLY_LIMIT,
  };
}

export function getImpactAffiliatePolicy() {
  const c = config();
  return {
    configured: c.configured,
    programOverrideConfigured: Boolean(c.programId),
    softCallsPerHour: c.softCallsPerHour,
    providerDefaultHourlyLimit: c.providerDefaultHourlyLimit,
  };
}

function authHeader(accountSid: string, authToken: string) {
  return `Basic ${btoa(`${accountSid}:${authToken}`)}`;
}

function hourKey(now = new Date()) {
  return `hour:${now.toISOString().slice(0, 13)}`;
}

async function loadUsage(svc: any, key: string) {
  const rows = await svc.entities.ImpactAffiliateUsage.filter({ bucket_key: key }, '-updated_date', 1).catch(() => []);
  return rows?.[0] || null;
}

async function reserveUsage(svc: any) {
  const c = config();
  const key = hourKey();
  const row = await loadUsage(svc, key);
  const blockedUntil = row?.blocked_until ? Date.parse(row.blocked_until) : 0;
  if (blockedUntil > Date.now()) throw new Error('IMPACT_RATE_LIMITED');
  if ((row?.calls_used || 0) + 1 > c.softCallsPerHour) throw new Error('IMPACT_SOFT_HOURLY_LIMIT');

  const patch = {
    calls_used: (row?.calls_used || 0) + 1,
    soft_call_limit: c.softCallsPerHour,
    last_request_at: new Date().toISOString(),
  };
  if (row?.id) await svc.entities.ImpactAffiliateUsage.update(row.id, patch);
  else await svc.entities.ImpactAffiliateUsage.create({ bucket_key: key, bucket_type: 'hour', ...patch });
  return key;
}

function intHeader(headers: Headers, name: string) {
  const value = Number.parseInt(String(headers.get(name) || ''), 10);
  return Number.isFinite(value) ? value : undefined;
}

async function recordResponse(svc: any, key: string, res: Response) {
  const row = await loadUsage(svc, key);
  if (!row?.id) return;
  const providerLimit = intHeader(res.headers, 'X-RateLimit-Limit-hour') ?? intHeader(res.headers, 'X-RateLimit-Limit');
  const providerRemaining = intHeader(res.headers, 'X-RateLimit-Remaining-hour') ?? intHeader(res.headers, 'X-RateLimit-Remaining');
  const resetSeconds = intHeader(res.headers, 'RateLimit-Reset') ?? intHeader(res.headers, 'X-RateLimit-Reset');
  const retryAfter = intHeader(res.headers, 'Retry-After');
  const patch: any = {
    last_status: res.status,
    ...(providerLimit != null ? { provider_limit: providerLimit } : {}),
    ...(providerRemaining != null ? { provider_remaining: providerRemaining } : {}),
    ...(resetSeconds != null ? { reset_seconds: resetSeconds } : {}),
  };
  if (res.status === 429) {
    const seconds = Math.max(1, retryAfter || resetSeconds || 60);
    patch.blocked_until = new Date(Date.now() + seconds * 1000).toISOString();
  }
  await svc.entities.ImpactAffiliateUsage.update(row.id, patch).catch(() => {});
}

async function impactJson(svc: any, path: string, init: RequestInit = {}) {
  const c = config();
  if (!c.configured) throw new Error('IMPACT_NOT_CONFIGURED');
  const usageKey = await reserveUsage(svc);
  let res: Response;
  try {
    res = await fetch(`${IMPACT_ORIGIN}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: authHeader(c.accountSid, c.authToken),
        ...(init.headers || {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error('IMPACT_NETWORK_ERROR');
  }
  await recordResponse(svc, usageKey, res);
  if (res.status === 401) throw new Error('IMPACT_AUTH_ERROR');
  if (res.status === 403) throw new Error('IMPACT_FORBIDDEN');
  if (res.status === 429) throw new Error('IMPACT_RATE_LIMITED');
  if (!res.ok) throw new Error(`IMPACT_HTTP_${res.status}`);
  const json = await res.json().catch(() => null);
  if (!json) throw new Error('IMPACT_INVALID_RESPONSE');
  return json;
}

async function loadCache(svc: any, key: string) {
  const rows = await svc.entities.ImpactAffiliateCache.filter({ cache_key: key }, '-updated_date', 1).catch(() => []);
  return rows?.[0] || null;
}

async function saveCache(svc: any, key: string, resourceType: 'program' | 'tracking_link', values: any, ttlMs: number) {
  const now = new Date();
  const record = {
    cache_key: key,
    resource_type: resourceType,
    ...values,
    fetched_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttlMs).toISOString(),
    schema_version: 1,
  };
  const current = await loadCache(svc, key);
  if (current?.id) await svc.entities.ImpactAffiliateCache.update(current.id, record);
  else await svc.entities.ImpactAffiliateCache.create(record);
  return record;
}

function asPrograms(json: any) {
  const candidates = [json?.Campaigns, json?.Programs, json?.campaigns, json?.programs, json?.Records, json?.records, json?.Results, json?.results];
  for (const value of candidates) if (Array.isArray(value)) return value;
  return Array.isArray(json) ? json : [];
}

function nameOf(program: any) {
  return String(program?.CampaignName || program?.ProgramName || program?.AdvertiserName || program?.Name || '').trim();
}

function idOf(program: any) {
  return String(program?.CampaignId || program?.ProgramId || program?.Id || '').trim();
}

function isActive(program: any) {
  const state = String(program?.ContractStatus || program?.Status || '').trim().toLowerCase();
  return !state || state === 'active';
}

function allowsDeepLink(program: any) {
  const value = program?.AllowsDeeplinking ?? program?.AllowsDeepLinking;
  if (value == null || value === '') return true;
  return String(value).toLowerCase() === 'true';
}

function allowedDeepLinkDomain(program: any) {
  const raw = program?.DeeplinkDomains ?? program?.DeepLinkDomains;
  const values = Array.isArray(raw) ? raw : Array.isArray(raw?.DeeplinkDomain) ? raw.DeeplinkDomain : raw?.DeeplinkDomain ? [raw.DeeplinkDomain] : [];
  if (!values.length) return true;
  return values.some((v: any) => {
    const domain = String(v || '').toLowerCase().replace(/^\*\./, '');
    return domain === 'tcgplayer.com' || domain === 'www.tcgplayer.com' || 'www.tcgplayer.com'.endsWith(`.${domain}`);
  });
}

async function resolveTcgplayerProgram(svc: any) {
  const cached = await loadCache(svc, 'program:tcgplayer');
  if (cached?.program_id && Date.parse(cached.expires_at || '') > Date.now()) return cached;

  const c = config();
  let program: any = null;
  if (c.programId) {
    program = await impactJson(svc, `/Mediapartners/${encodeURIComponent(c.accountSid)}/Campaigns/${encodeURIComponent(c.programId)}`);
  } else {
    const list = await impactJson(svc, `/Mediapartners/${encodeURIComponent(c.accountSid)}/Campaigns`);
    const rows = asPrograms(list);
    const matches = rows.filter((x: any) => /tcg\s*player/i.test(nameOf(x)) || /tcgplayer\.com/i.test(String(x?.AdvertiserUrl || x?.CampaignUrl || '')));
    if (matches.length !== 1) throw new Error(matches.length ? 'IMPACT_TCGPLAYER_PROGRAM_AMBIGUOUS' : 'IMPACT_TCGPLAYER_PROGRAM_NOT_FOUND');
    program = matches[0];
  }

  const id = idOf(program);
  if (!id) throw new Error('IMPACT_TCGPLAYER_PROGRAM_INVALID');
  if (!isActive(program)) throw new Error('IMPACT_TCGPLAYER_CONTRACT_INACTIVE');
  if (!allowsDeepLink(program) || !allowedDeepLinkDomain(program)) throw new Error('IMPACT_TCGPLAYER_DEEPLINK_NOT_ALLOWED');

  return saveCache(svc, 'program:tcgplayer', 'program', {
    program_id: id,
    program_name: nameOf(program) || 'TCGplayer',
    payload: {
      contractStatus: program?.ContractStatus || program?.Status || null,
      allowsDeeplinking: program?.AllowsDeeplinking ?? program?.AllowsDeepLinking ?? null,
      deeplinkDomains: program?.DeeplinkDomains ?? program?.DeepLinkDomains ?? null,
    },
  }, PROGRAM_TTL_MS);
}

export async function decorateTcgplayerAffiliateUrl(svc: any, destination: unknown) {
  const safe = safeDestination(destination);
  if (!safe) return { url: null, affiliate: false, reason: 'invalid_destination' };

  const c = config();
  if (!c.configured) return { url: safe, affiliate: false, reason: 'impact_not_configured' };

  const cacheKey = `tracking:${safe}`;
  const cached = await loadCache(svc, cacheKey);
  if (cached?.tracking_url && Date.parse(cached.expires_at || '') > Date.now()) {
    return { url: cached.tracking_url, affiliate: true, fromCache: true, programId: cached.program_id };
  }

  try {
    const program = await resolveTcgplayerProgram(svc);
    const qs = new URLSearchParams({ DeepLink: safe, Type: 'Regular', subId1: 'swappulse-card' });
    const json = await impactJson(
      svc,
      `/Mediapartners/${encodeURIComponent(c.accountSid)}/Programs/${encodeURIComponent(program.program_id)}/TrackingLinks?${qs.toString()}`,
      { method: 'POST' },
    );
    const trackingUrl = String(json?.TrackingURL || json?.TrackingUrl || json?.trackingURL || json?.trackingUrl || '').trim();
    let parsed: URL;
    try { parsed = new URL(trackingUrl); } catch { throw new Error('IMPACT_TRACKING_URL_INVALID'); }
    if (parsed.protocol !== 'https:') throw new Error('IMPACT_TRACKING_URL_INVALID');

    await saveCache(svc, cacheKey, 'tracking_link', {
      destination_url: safe,
      tracking_url: parsed.toString(),
      program_id: program.program_id,
      program_name: program.program_name,
      payload: { source: 'Impact Tracking Links API', subId1: 'swappulse-card' },
    }, TRACKING_TTL_MS);

    return { url: parsed.toString(), affiliate: true, fromCache: false, programId: program.program_id };
  } catch (error) {
    console.warn('Impact TCGplayer affiliate link fallback:', error instanceof Error ? error.message : String(error));
    return { url: safe, affiliate: false, reason: error instanceof Error ? error.message : 'impact_error' };
  }
}

export async function getImpactAffiliateUsageStatus(svc: any) {
  const c = config();
  const row = await loadUsage(svc, hourKey());
  return {
    policy: getImpactAffiliatePolicy(),
    hour: {
      callsUsed: row?.calls_used || 0,
      softCallLimit: c.softCallsPerHour,
      providerDefaultLimit: DEFAULT_PROVIDER_HOURLY_LIMIT,
      providerReportedLimit: row?.provider_limit ?? null,
      providerRemaining: row?.provider_remaining ?? null,
      resetSeconds: row?.reset_seconds ?? null,
      blockedUntil: row?.blocked_until || null,
      lastStatus: row?.last_status ?? null,
    },
  };
}
