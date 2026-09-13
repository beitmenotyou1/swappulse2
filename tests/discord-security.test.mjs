import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROLE_DEFINITIONS, syncDiscordLink, revokeUserDiscordLinks } from '../base44/shared/discordBot.ts';

const env = new Map([
  ['DISCORD_GUILD_ID', 'guild'],
  ['DISCORD_BOT_TOKEN', 'test-token'],
  ['DISCORD_APPLICATION_ID', 'app'],
]);
globalThis.Deno = {
  env: { get: (key) => env.get(key) },
  serve: (handler) => { globalThis.discordHandler = handler; },
};

function fixture({ user = null, status = 'verified', method = 'swappulse_account',
  originalRoles = [], missingMember = false, denyRemoval = false, drift = false,
  failAudit = false, enabled = true } = {}) {
  const roleIds = Object.fromEntries(ROLE_DEFINITIONS.map((role, index) => [role.name, `r${index + 1}`]));
  const config = { guild_id: 'guild', enabled, bot_user_id: 'bot', role_ids: roleIds };
  const roles = ROLE_DEFINITIONS.map((role, index) => ({
    id: `r${index + 1}`, name: role.name,
    color: drift && index === 0 ? 1 : role.colour,
    permissions: role.permissions, managed: false, mentionable: false,
    hoist: ['Moderator', 'Administrator'].includes(role.name), position: index + 1,
  }));
  roles.push({ id: 'bot-role', position: 100, permissions: '268435456' });
  const memberRoles = new Set(originalRoles.map((name) => roleIds[name]));
  const link = { id: 'link', user_id: method === 'captcha' ? '' : 'user',
    discord_user_id: 'member', guild_id: 'guild',
    verification_method: method, status, applied_roles: [...originalRoles] };
  const actions = [];
  const audits = [];
  const svc = { entities: {
    DiscordGuildConfig: { filter: async () => [config] },
    User: { filter: async () => user ? [user] : [] },
    AccountStatus: { filter: async () => [] },
    DiscordAccountLink: {
      filter: async () => [link],
      update: async (id, update) => { actions.push(['link-update', update]); Object.assign(link, update); },
      delete: async () => { actions.push(['link-delete']); },
    },
    DiscordRoleSyncAudit: { create: async (row) => {
      if (failAudit) throw new Error('AUDIT_UNAVAILABLE');
      audits.push(row);
    } },
    Reputation: { filter: () => { throw new Error('Untrusted reputation queried'); } },
    TradeListing: { filter: () => { throw new Error('Untrusted trade queried'); } },
    Achievement: { filter: () => { throw new Error('Untrusted achievement queried'); } },
    Meetup: { filter: () => { throw new Error('Untrusted meetup queried'); } },
  } };
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    if (path === '/api/v10/guilds/guild/roles') return Response.json(roles);
    if (path === '/api/v10/guilds/guild/members/bot') return Response.json({ roles: ['bot-role'] });
    if (path === '/api/v10/guilds/guild/members/member') {
      return missingMember ? Response.json({ message: 'Unknown Member' }, { status: 404 })
        : Response.json({ roles: [...memberRoles] });
    }
    if (path.startsWith('/api/v10/guilds/guild/members/member/roles/')) {
      const id = path.split('/').pop();
      if (init.method === 'DELETE' && denyRemoval) {
        return Response.json({ message: 'Missing Permissions' }, { status: 403 });
      }
      actions.push([init.method, id]);
      if (init.method === 'DELETE') memberRoles.delete(id);
      if (init.method === 'PUT') memberRoles.add(id);
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  return { config, link, svc, actions, audits, memberRoles, roleIds };
}

test('orphaned account removes every managed role and revokes the link', async () => {
  const f = fixture({ originalRoles: ['Collector', 'Verified SwapPulse Account', 'Administrator'] });
  await syncDiscordLink(f.svc, f.link, 'scheduled');
  assert.equal(f.link.status, 'revoked');
  assert.deepEqual(f.link.applied_roles, []);
  assert.equal(f.memberRoles.size, 0);
  assert.ok(f.audits.some((row) => row.outcome === 'revoked' && row.metrics.orphaned_account));
});

test('untrusted evidence and admin role cannot grant external trust/staff badges', async () => {
  const f = fixture({ user: { id: 'user', did: 'did:plc:alice', role: 'admin' } });
  const result = await syncDiscordLink(f.svc, f.link, 'oauth');
  assert.deepEqual(result.desired_roles, ['Collector', 'Verified SwapPulse Account']);
  assert.deepEqual(f.link.applied_roles, result.desired_roles);
  assert.equal(f.memberRoles.size, 2);
});

test('pending revocation blocks account deletion when Discord denies removal', async () => {
  const f = fixture({ originalRoles: ['Administrator'], denyRemoval: true });
  await assert.rejects(revokeUserDiscordLinks(f.svc, 'user', 'admin'), /DISCORD_PERMISSION_DENIED/);
  assert.equal(f.link.status, 'revocation_pending');
  assert.ok(!f.actions.some((entry) => entry[0] === 'link-delete'));
  assert.deepEqual(f.link.applied_roles, ['Administrator']);
});

test('member absence confirms role removal and allows link deletion', async () => {
  const f = fixture({ status: 'revocation_pending', missingMember: true });
  assert.equal(await revokeUserDiscordLinks(f.svc, 'user', 'admin'), 1);
  assert.ok(f.actions.some((entry) => entry[0] === 'link-delete'));
  assert.equal(f.link.status, 'revoked');
});

test('role pin drift fails closed before any external role grant', async () => {
  const f = fixture({ user: { id: 'user', role: 'user' }, drift: true });
  await assert.rejects(syncDiscordLink(f.svc, f.link, 'oauth'), /DISCORD_ROLE_PINS_INVALID/);
  assert.ok(!f.actions.some((entry) => entry[0] === 'PUT'));
});

test('an unavailable audit ledger blocks external role changes', async () => {
  const f = fixture({ user: { id: 'user', role: 'user' }, failAudit: true });
  await assert.rejects(syncDiscordLink(f.svc, f.link, 'oauth'), /AUDIT_UNAVAILABLE/);
  assert.ok(!f.actions.some((entry) => entry[0] === 'PUT'));
});

async function loadBackendFunction(relativePath) {
  let source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  source = source.replace("import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';",
    'const createClientFromRequest = () => globalThis.mockBase44;');
  source = source.replace("from '../../shared/discordBot.ts'",
    `from ${JSON.stringify(new URL('../base44/shared/discordBot.ts', import.meta.url).href)}`);
  source = source.replace("import { sendBrandedEmail } from '../../shared/smtpSender.ts';",
    'const sendBrandedEmail = async () => {};');
  const tempDir = await mkdtemp(join(tmpdir(), 'swappulse-backend-'));
  try {
    const entry = join(tempDir, 'entry.ts');
    await writeFile(entry, source);
    return (await import(pathToFileURL(entry).href)).default;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test('self-deletion stops before User deletion when Discord refuses revocation', async () => {
  const f = fixture({ originalRoles: ['Administrator'], denyRemoval: true });
  let userDeleted = false;
  f.svc.entities.User.delete = async () => { userDeleted = true; };
  globalThis.mockBase44 = {
    auth: { me: async () => ({ id: 'user', did: 'did:plc:alice' }) },
    asServiceRole: f.svc,
  };
  const handler = await loadBackendFunction('../base44/functions/delete-account/entry.ts');
  const result = await handler(new Request('https://swappulse.org/functions/delete-account', { method: 'POST' }));
  assert.equal(result.status, 503);
  assert.equal(f.link.status, 'revocation_pending');
  assert.equal(userDeleted, false);
});

test('force-delete stops before User deletion when Discord refuses revocation', async () => {
  const f = fixture({ originalRoles: ['Administrator'], denyRemoval: true });
  let userDeleted = false;
  f.svc.entities.User.get = async () => ({ id: 'user', did: 'did:plc:alice', email: 'alice@example.test' });
  f.svc.entities.User.delete = async () => { userDeleted = true; };
  globalThis.mockBase44 = {
    auth: { me: async () => ({ id: 'admin', role: 'admin' }) },
    asServiceRole: f.svc,
  };
  const handler = await loadBackendFunction('../base44/functions/enforcement/entry.ts');
  const result = await handler(new Request('https://swappulse.org/functions/enforcement', {
    method: 'POST', body: JSON.stringify({ op: 'force_delete', user_id: 'user' }),
  }));
  assert.equal(result.status, 503);
  assert.equal(f.link.status, 'revocation_pending');
  assert.equal(userDeleted, false);
});

test('valid Discord Ed25519 PING succeeds, tampering and oversize fail', async () => {
  const keys = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const publicBytes = await crypto.subtle.exportKey('raw', keys.publicKey);
  env.set('DISCORD_PUBLIC_KEY', Buffer.from(publicBytes).toString('hex'));
  // Load the real interaction source while replacing only Base44's Deno-only
  // SDK import. The signed PING path does not invoke that SDK.
  let source = await readFile(new URL('../base44/functions/discord-interactions/entry.ts', import.meta.url), 'utf8');
  source = source.replace("import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';",
    "const createClientFromRequest = () => { throw new Error('Unexpected authenticated call'); };");
  source = source.replace("import { createClientFromRequest } from '../../../stubs/base44.mjs';",
    "const createClientFromRequest = () => { throw new Error('Unexpected authenticated call'); };");
  source = source.replace("'../../shared/discordBot.ts'",
    JSON.stringify(new URL('../base44/shared/discordBot.ts', import.meta.url).href));
  source = source.replace("'../../shared/discordLocale.ts'",
    JSON.stringify(new URL('../base44/shared/discordLocale.ts', import.meta.url).href));
  const tempDir = await mkdtemp(join(tmpdir(), 'swappulse-discord-'));
  const testEntry = join(tempDir, 'interaction.ts');
  try {
    await writeFile(testEntry, source);
    await import(pathToFileURL(testEntry).href);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  const raw = JSON.stringify({ type: 1, application_id: 'app' });
  const stamp = String(Math.floor(Date.now() / 1000));
  const signed = Buffer.from(await crypto.subtle.sign('Ed25519', keys.privateKey,
    new TextEncoder().encode(stamp + raw))).toString('hex');
  const makeReq = (body, signature = signed) => new Request('https://swappulse.org/functions/discord-interactions', {
    method: 'POST', body, headers: {
      'x-signature-timestamp': stamp, 'x-signature-ed25519': signature,
    },
  });
  const good = await globalThis.discordHandler(makeReq(raw));
  assert.equal(good.status, 200);
  assert.deepEqual(await good.json(), { type: 1 });
  assert.equal((await globalThis.discordHandler(makeReq(raw + ' '))).status, 401);
  assert.equal((await globalThis.discordHandler(makeReq('x'.repeat(65_537)))).status, 413);
});

