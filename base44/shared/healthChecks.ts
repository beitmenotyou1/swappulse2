import { fetchTcgdex } from './tcgdexClient.ts';

export async function checkTcgdex() {
  try {
    await fetchTcgdex('/sets', 'en');
    return { status: 'up' };
  } catch (e) {
    return { status: 'down', error: e?.message || String(e) };
  }
}

export async function checkDatabase(base44) {
  try {
    const start = Date.now();
    await base44.asServiceRole.entities.User.list('-created_date', 1);
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (e) {
    return { status: 'down', error: e?.message || String(e) };
  }
}

export function checkSmtp() {
  const host = Deno.env.get('SMTP_HOST');
  const user = Deno.env.get('SMTP_USERNAME');
  const pass = Deno.env.get('SMTP_TOKEN');
  if (!host || !user || !pass) {
    return { status: 'down', error: 'SMTP credentials not configured' };
  }
  return { status: 'up' };
}

export function checkVapid() {
  const pub = Deno.env.get('VAPID_PUBLIC_KEY');
  const priv = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!pub || !priv) {
    return { status: 'down', error: 'VAPID keys not configured' };
  }
  return { status: 'up' };
}

export function checkBase44() {
  return { status: 'up', latencyMs: 0 };
}

export async function checkPodcastRss(origin: string) {
  try {
    if (!origin) throw new Error('App origin not configured');
    const url = `${origin.replace(/\/$/, '')}/api/functions/podcast-rss-feed?did=did:plc:healthcheck000000000000`;
    const start = Date.now();
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    // 200 = feed generated, 404 = no episodes for the probe DID (expected).
    // Both mean the function endpoint is alive; only 5xx/network errors are "down".
    if (res.status === 200 || res.status === 404) return { status: 'up', latencyMs: Date.now() - start };
    throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    return { status: 'down', error: e?.message || String(e) };
  }
}

export async function checkAtProtoRelay() {
  // The firehose ingestion pipeline's core dependency is our own PDS — it
  // lists records from the PDS repo for bidirectional sync. The AppView
  // (public.api.bsky.app) is a secondary dependency used only for profile
  // enrichment, reply sync, and broad search; the firehose-ingest function
  // handles AppView slowness gracefully (try/catch per feature, continues
  // ingesting from the PDS). Checking the AppView as a hard dependency
  // reported false outages when the core pipeline was still functioning.
  // Probe the PDS health endpoint — if it's up, the firehose pipeline can
  // do its core job.
  try {
    const pdsUrl = Deno.env.get('PDS_URL');
    if (!pdsUrl) throw new Error('PDS_URL not configured');
    const start = Date.now();
    const res = await fetch(`${pdsUrl}/xrpc/_health`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (e) {
    return { status: 'down', error: e?.message || String(e) };
  }
}