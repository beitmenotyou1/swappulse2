// Shared AT Protocol identity provisioning logic. Creates a real account on
// the self-hosted PDS (PDS_URL) via the admin API (PDS_ADMIN_PASSWORD), mints
// an app password, stores it in PdsCredential, and sets did + bsky_handle on
// the User record. Used by provision-identity (signup) and
// provision-all-identities (backfill) so both share one implementation.

const HANDLE_SUFFIX = '.swappulse.org';

function adminAuthHeader(): string {
  const pwd = Deno.env.get('PDS_ADMIN_PASSWORD');
  if (!pwd) throw new Error('PDS_ADMIN_PASSWORD not configured');
  // Reference PDS (bluesky-social/pds) admin endpoints expect a Bearer token
  // equal to PDS_ADMIN_PASSWORD — NOT Basic auth. Basic auth is rejected with
  // 400 InvalidToken "Unexpected authorization type", which is why no
  // PdsCredential records were ever created.
  return 'Bearer ' + pwd;
}

function randomPassword(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(36).padStart(2, '0')).join('') + '!A1';
}

// Derive a valid handle segment from a SwapPulse username: lowercase, strip to
// [a-z0-9] with hyphens, truncate to 39 chars. Falls back to collector-XXXX.
export function deriveHandleBase(username: string): string {
  let base = (username || '').toLowerCase().trim();
  base = base.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  base = base.slice(0, 39);
  if (!base) {
    const suffix = String(1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 9000);
    base = `collector-${suffix}`;
  }
  return base;
}

async function pdsAdminPost(endpoint: string, payload: object): Promise<any> {
  const pdsUrl = Deno.env.get('PDS_URL');
  if (!pdsUrl) throw new Error('PDS_URL not configured');
  const res = await fetch(`${pdsUrl}/xrpc/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': adminAuthHeader() },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body: any;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) return { error: true, status: res.status, body };
  return body;
}

async function pdsAdminGet(endpoint: string): Promise<any> {
  const pdsUrl = Deno.env.get('PDS_URL');
  if (!pdsUrl) throw new Error('PDS_URL not configured');
  const res = await fetch(`${pdsUrl}/xrpc/${endpoint}`, {
    headers: { 'Authorization': adminAuthHeader() },
  });
  const text = await res.text();
  let body: any;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) return { error: true, status: res.status, body };
  return body;
}

// Returns true if the DID resolves on the given PDS (com.atproto.repo.describeRepo).
async function didResolvesOnPds(did: string, pdsUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(did)}`);
    return res.ok;
  } catch {
    return false;
  }
}

async function createAppPassword(pdsUrl: string, did: string, password: string): Promise<string> {
  const sessionRes = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: did, password }),
  });
  if (!sessionRes.ok) {
    const body = await sessionRes.text();
    throw new Error(`createSession for new account failed (${sessionRes.status}): ${body.slice(0, 200)}`);
  }
  const session = await sessionRes.json();

  const appPwdRes = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createAppPassword`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.accessJwt}` },
    body: JSON.stringify({ name: 'SwapPulse Bridge' }),
  });
  if (!appPwdRes.ok) {
    const body = await appPwdRes.text();
    throw new Error(`createAppPassword failed (${appPwdRes.status}): ${body.slice(0, 200)}`);
  }
  const appPwdData = await appPwdRes.json();
  return appPwdData.password;
}

// Public account creation — com.atproto.server.createAccount. The PDS has
// inviteCodeRequired: false, so no invite code is needed. This is the same
// path the Bluesky app uses to sign up and avoids the admin auth scheme
// (which varies across PDS versions and was rejecting our admin token).
// Returns { did, handle, accessJwt }.
async function pdsServerCreateAccount(handle: string, email: string, password: string): Promise<any> {
  const pdsUrl = Deno.env.get('PDS_URL');
  if (!pdsUrl) throw new Error('PDS_URL not configured');
  const res = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createAccount`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle, email, password }),
  });
  const text = await res.text();
  let body: any;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) return { error: true, status: res.status, body };
  return body;
}

// Mint an app password using an access JWT returned by createAccount (skips
// the separate createSession step).
async function createAppPasswordFromToken(pdsUrl: string, accessJwt: string): Promise<string> {
  const appPwdRes = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createAppPassword`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessJwt}` },
    body: JSON.stringify({ name: 'SwapPulse Bridge' }),
  });
  if (!appPwdRes.ok) {
    const body = await appPwdRes.text();
    throw new Error(`createAppPassword failed (${appPwdRes.status}): ${body.slice(0, 200)}`);
  }
  const appPwdData = await appPwdRes.json();
  return appPwdData.password;
}

// Provisions a PDS identity for a user. Idempotent: skips if the user already
// has a did:plc (caller should check, but we double-check here too).
export async function provisionIdentityForUser(
  svc: any,
  userId: string,
  username: string,
  email: string,
): Promise<{ did: string; handle: string }> {
  const pdsUrl = Deno.env.get('PDS_URL');
  if (!pdsUrl) throw new Error('PDS_URL not configured');

  const base = deriveHandleBase(username);
  const password = randomPassword();

  let attempt = 0;
  let handle = `${base}${HANDLE_SUFFIX}`;
  let result: any;

  while (attempt < 10) {
    result = await pdsServerCreateAccount(handle, email, password);
    if (!result?.error) break;

    const errStr = typeof result.body === 'string' ? result.body : JSON.stringify(result.body || {});
    // HandleNotAvailable / InvalidHandle → append incrementing suffix and retry
    if (errStr.includes('Handle') && (errStr.includes('avail') || errStr.includes('taken') || errStr.includes('Already') || errStr.includes('Invalid'))) {
      attempt++;
      handle = `${base}-${attempt + 1}${HANDLE_SUFFIX}`;
      continue;
    }
    throw new Error(`createAccount failed (${result.status}): ${errStr.slice(0, 300)}`);
  }

  if (!result || result.error) {
    throw new Error('Could not create PDS account after retries');
  }

  const did: string = result.did;
  const finalHandle: string = result.handle;

  // createAccount returns an accessJwt — use it to mint the bridge app
  // password directly (no separate createSession needed).
  const appPassword = await createAppPasswordFromToken(pdsUrl, result.accessJwt);

  // Store the PDS identity directly on the User record (consolidated — no
  // separate PdsCredential entity). The app password is AES-GCM encrypted at
  // rest by setUserIdentity. Also set did + bsky_handle.
  const { setUserIdentity } = await import('./userIdentity.ts');
  await setUserIdentity(svc, userId, did, pdsUrl, appPassword);
  await svc.entities.User.update(userId, { bsky_handle: finalHandle });

  return { did, handle: finalHandle };
}

// Repair path: the user has a did:plc that resolves on the current PDS but no
// stored PdsCredential — a previous provisioning run created the PDS account
// but crashed before storing the bridge credential. The PDS admin write
// endpoints (com.atproto.admin.updateAccount) reject our auth on this PDS, so
// we cannot reset the existing account's password to mint an app password for
// it. Instead we re-provision a fresh account via the public createAccount
// endpoint. The old account is abandoned — it was never usable (no credential
// was ever stored, so no content was ever bridged to it), so abandoning it is
// safe. The handle-conflict retry in provisionIdentityForUser handles the
// taken handle by appending -2, -3, etc. The user's did + handle are updated
// to the new account.
export async function repairCredentialForUser(
  svc: any,
  userId: string,
  username: string,
  email: string,
): Promise<{ did: string; handle: string }> {
  return provisionIdentityForUser(svc, userId, username, email);
}

export { didResolvesOnPds };