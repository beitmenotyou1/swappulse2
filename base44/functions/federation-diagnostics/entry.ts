// Administrator-only AT Protocol account audit.
//
// This checks each linked account's stored PDS credential, repository, public
// profile and handle resolution. Results never include app passwords, tokens,
// raw PDS response bodies or other secret material.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSessionForUser } from '../../shared/pdsSession.ts';
import { getUserIdentity } from '../../shared/userIdentity.ts';

const PLC_DIR = 'https://plc.directory';
const APPVIEW = 'https://public.api.bsky.app';
const REQUEST_TIMEOUT_MS = 12_000;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal, redirect: 'error' });
  } finally {
    clearTimeout(timer);
  }
}

async function jsonOrNull(response: Response) {
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

function errorCode(error: any): string {
  const message = String(error?.message || error || '');
  if (/createSession.*\((400|401|403)\)|authentication/i.test(message)) return 'authentication_failed';
  if (/identity mismatch/i.test(message)) return 'identity_mismatch';
  return 'pds_unreachable';
}

async function persistSnapshot(svc: any, snapshot: any) {
  const existing = await svc.entities.AtprotoAccountHealth
    .filter({ user_id: snapshot.userId }, '-checked_at', 1)
    .catch(() => []);
  const payload = {
    user_id: snapshot.userId,
    did: snapshot.did,
    handle: snapshot.handle,
    pds_url: snapshot.pdsUrl,
    status: snapshot.status,
    credential_valid: snapshot.credentialValid,
    profile_resolves: snapshot.profileResolves,
    handle_resolves: snapshot.handleResolves,
    repo_reachable: snapshot.repoReachable,
    latest_post_at: snapshot.latestPostAt || undefined,
    latest_post_uri: snapshot.latestPostUri || '',
    error_code: snapshot.errorCode || '',
    checked_at: snapshot.checkedAt,
  };
  if (existing?.[0]?.id) {
    await svc.entities.AtprotoAccountHealth.update(existing[0].id, payload);
  } else {
    await svc.entities.AtprotoAccountHealth.create(payload);
  }
}

async function inspectAccount(svc: any, user: any) {
  const checkedAt = new Date().toISOString();
  const base = {
    userId: user.id,
    email: user.email,
    username: user.username || user.display_name || user.full_name || '',
    did: String(user.did || ''),
    handle: String(user.bsky_handle || user.custom_handle || ''),
    pdsUrl: String(user.pds_url || ''),
    credentialValid: false,
    pdsAccount: false,
    repoReachable: false,
    inPlc: false,
    plcHandle: '',
    plcPds: '',
    handleResolves: false,
    profileResolves: false,
    latestPostAt: '',
    latestPostUri: '',
    errorCode: '',
    status: 'credentials_missing',
    checkedAt,
  };

  const identity = await getUserIdentity(svc, user);
  if (!identity) {
    await persistSnapshot(svc, base);
    return base;
  }
  base.pdsUrl = identity.pdsUrl;

  let session: any;
  try {
    const resolved = await getPdsSessionForUser(
      identity.pdsUrl,
      identity.did,
      identity.appPassword,
    );
    session = resolved.session;
    base.pdsUrl = resolved.pdsUrl;
    if (session.did !== identity.did) {
      base.status = 'identity_mismatch';
      base.errorCode = 'AT_IDENTITY_MISMATCH';
      await persistSnapshot(svc, base);
      return base;
    }
    base.credentialValid = true;
  } catch (error) {
    base.status = errorCode(error);
    base.errorCode = base.status === 'authentication_failed'
      ? 'AT_AUTHENTICATION_FAILED'
      : base.status === 'identity_mismatch'
        ? 'AT_IDENTITY_MISMATCH'
        : 'AT_PDS_UNREACHABLE';
    await persistSnapshot(svc, base);
    return base;
  }

  try {
    const describeUrl = new URL(`${base.pdsUrl}/xrpc/com.atproto.repo.describeRepo`);
    describeUrl.searchParams.set('repo', identity.did);
    const describeResponse = await fetchWithTimeout(describeUrl, {
      headers: { Authorization: `Bearer ${session.accessJwt}` },
    });
    const describe = await jsonOrNull(describeResponse);
    base.pdsAccount = !!describe?.did;
    base.repoReachable = !!describe?.did;

    const recordsUrl = new URL(`${base.pdsUrl}/xrpc/com.atproto.repo.listRecords`);
    recordsUrl.searchParams.set('repo', identity.did);
    recordsUrl.searchParams.set('collection', 'app.bsky.feed.post');
    recordsUrl.searchParams.set('limit', '1');
    recordsUrl.searchParams.set('reverse', 'true');
    const records = await jsonOrNull(await fetchWithTimeout(recordsUrl, {
      headers: { Authorization: `Bearer ${session.accessJwt}` },
    }));
    const latest = records?.records?.[0];
    base.latestPostAt = String(latest?.value?.createdAt || '');
    base.latestPostUri = String(latest?.uri || '');
  } catch {
    base.repoReachable = false;
  }

  try {
    const plc = await jsonOrNull(
      await fetchWithTimeout(`${PLC_DIR}/${encodeURIComponent(identity.did)}`),
    );
    if (plc) {
      base.inPlc = true;
      base.plcHandle = String(plc.alsoKnownAs?.[0] || '').replace(/^at:\/\//, '');
      base.plcPds = String(plc.service?.find?.((service: any) =>
        service?.type === 'AtprotoPersonalDataServer'
      )?.serviceEndpoint || plc.service?.endpoint || '');
    }
  } catch {}

  if (base.handle) {
    try {
      const resolveUrl = new URL(`${APPVIEW}/xrpc/com.atproto.identity.resolveHandle`);
      resolveUrl.searchParams.set('handle', base.handle);
      const resolved = await jsonOrNull(await fetchWithTimeout(resolveUrl));
      base.handleResolves = resolved?.did === identity.did;
    } catch {}
  }

  try {
    const profileUrl = new URL(`${APPVIEW}/xrpc/app.bsky.actor.getProfile`);
    profileUrl.searchParams.set('actor', identity.did);
    const profile = await jsonOrNull(await fetchWithTimeout(profileUrl));
    base.profileResolves = profile?.did === identity.did;
  } catch {}

  if (!base.repoReachable) {
    base.status = 'pds_unreachable';
    base.errorCode = 'AT_REPOSITORY_UNREACHABLE';
  } else if (!base.handleResolves) {
    base.status = 'handle_mismatch';
    base.errorCode = 'AT_HANDLE_MISMATCH';
  } else if (!base.profileResolves) {
    base.status = 'profile_unavailable';
    base.errorCode = 'AT_PROFILE_UNAVAILABLE';
  } else {
    base.status = 'healthy';
    base.errorCode = '';
  }

  await persistSnapshot(svc, base);
  return base;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const svc = base44.asServiceRole;
    const body = req.method === 'POST'
      ? await req.json().catch(() => ({}))
      : {};
    const url = new URL(req.url);
    const requestedUserId = String(body?.userId || url.searchParams.get('userId') || '');
    const singleUserId = caller.role === 'admin'
      ? requestedUserId
      : caller.id;

    const users = singleUserId
      ? await svc.entities.User.filter({ id: singleUserId }, '-created_date', 1)
      : await svc.entities.User.list('-created_date', 500);

    const linkedUsers = users.filter((user: any) =>
      user.did || user.bsky_handle || user.pds_app_password
    );
    const report: any[] = [];
    for (const user of linkedUsers) {
      report.push(await inspectAccount(svc, user));
    }

    const counts = report.reduce((acc: Record<string, number>, entry: any) => {
      acc[entry.status] = (acc[entry.status] || 0) + 1;
      return acc;
    }, {});

    return Response.json({
      checked_at: new Date().toISOString(),
      total: report.length,
      healthy: counts.healthy || 0,
      attention_required: report.length - (counts.healthy || 0),
      counts,
      report,
    });
  } catch (error) {
    console.error('federation-diagnostics:', error?.message || error);
    return Response.json({ error: 'Federation diagnostics failed' }, { status: 500 });
  }
}
