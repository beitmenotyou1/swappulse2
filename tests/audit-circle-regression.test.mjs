// Regression checks against the saved TypeScript source, with an in-memory
// entity client. These do not replace deployed SDK/RLS or browser integration tests.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
function sourceModule(path, dependencies = {}) {
  const source = readFileSync(new URL(path, root), 'utf8').replace(/^import .*;\s*$/gm, '');
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  assert.equal(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length || 0, 0, path);
  const exports = {};
  let served;
  const injections = { Response, console: { error() {}, warn() {} }, Deno: { serve(fn) { served = fn; } }, ...dependencies };
  new Function('exports', ...Object.keys(injections), result.outputText)(exports, ...Object.values(injections));
  return served || exports.default || exports;
}
const access = sourceModule('base44/shared/circleAccess.ts');
const visibility = sourceModule('base44/shared/federatedVisibility.ts', access);
const owner = { id: 'owner', did: 'did:plc:owner', full_name: 'Owner' };
const alice = { id: 'alice', did: 'did:plc:alice', full_name: 'Alice' };
const bob = { id: 'bob', did: 'did:plc:bob', full_name: 'Bob' };
const authority = { id: 'authority', circle_id: 'c1', owner_user_id: owner.id, owner_did: owner.did, visibility: 'public', canonical_ref: 'at://did:plc:owner/org.swappulse.circle/one' };
const event = (id, user, state, time = '2026-09-15T10:00:00.000Z') => ({ id, circle_id: 'c1', user_id: user.id, did: user.did, state, created_date: time });
function fixture(overrides = {}) {
  const rows = {
    User: [owner, alice, bob],
    Circle: [{ id: 'c1', did: owner.did, visibility: 'public', name: 'Circle', member_dids: [bob.did], member_count: 1 }],
    CircleAuthority: [{ ...authority }],
    CircleMembershipEvent: [],
    AccountStatus: [],
    ...structuredClone(overrides),
  };
  const calls = [];
  let serial = 0;
  const matches = (row, query) => Object.entries(query).every(([key, value]) => {
    if (key === '$or') return value.some(q => matches(row, q));
    if (value && typeof value === 'object') {
      if ('$in' in value) return value.$in.includes(row[key]);
      if ('$gte' in value) return row[key] >= value.$gte;
    }
    return row[key] === value;
  });
  const entities = new Proxy({}, { get(_, name) {
    rows[name] ||= [];
    return {
      async filter(query, sort = '-created_date', limit = 200, skip = 0) {
        calls.push({ name, action: 'filter', query });
        const descending = sort.startsWith('-'), field = sort.replace(/^-/, '');
        return rows[name].filter(r => matches(r, query)).sort((a, b) =>
          String(a[field] || '').localeCompare(String(b[field] || '')) * (descending ? -1 : 1)
        ).slice(skip, skip + limit);
      },
      async get(id) { calls.push({ name, action: 'get' }); const row = rows[name].find(r => r.id === id); if (!row) throw Error('Not found'); return row; },
      async create(data) {
        const row = { ...data, id: 'new-' + (++serial), created_date: new Date(Date.now() + serial * 1000).toISOString() };
        rows[name].push(row); return row;
      },
      async update(id, data) {
        const row = rows[name].find(r => r.id === id); if (!row) throw Error('Not found');
        Object.assign(row, data); return row;
      },
      async list() { throw Error('A global entity scan is forbidden in this test'); },
    };
  } });
  return { rows, calls, entities };
}
function handler(name, user, db, extras = {}) {
  return sourceModule('base44/functions/' + name + '/entry.ts', {
    ...access, ...visibility,
    createClientFromRequest: () => ({
      auth: { me: async () => user }, asServiceRole: db, entities: db.entities,
      functions: { invoke: async (functionName, body) => {
        const response = await handler(functionName, user, db, extras)({ json: async () => body });
        return { data: await response.json() };
      } },
    }),
    validateEntry: async () => ({ valid: true, contributionScore: 1, verificationHash: 'hash', rejectionReasons: {} }),
    ...extras,
  });
}
const call = (name, user, db, body) => handler(name, user, db)({ json: async () => body });

test('public metadata and forged member arrays grant no membership', async () => {
  assert.equal((await access.getCircleAccess(fixture(), 'c1', bob)).isMember, false);
});
test('curator identity requires both account ID and DID', async () => {
  assert.equal((await access.getCircleAccess(fixture(), 'c1', { id: 'attacker', did: owner.did })).isMember, false);
  assert.equal((await access.getCircleAccess(fixture(), 'c1', owner)).isCurator, true);
});
test('missing and duplicate authorities deny access', async () => {
  for (const records of [[], [authority, { ...authority, id: 'duplicate' }]]) {
    assert.equal((await access.getCircleAccess(fixture({ CircleAuthority: records }), 'c1', owner)).isMember, false);
  }
});
test('canonical AT aliases resolve only through pinned authority', async () => {
  assert.equal((await access.getCircleAccess(fixture(), authority.canonical_ref, owner)).isMember, true);
  assert.equal((await access.getCircleAccess(fixture(), authority.canonical_ref + 'fake', owner)).isMember, false);
});
test('deleted Circles do not leave usable scope authority', async () => {
  assert.equal((await access.getCircleAccess(fixture({ Circle: [] }), 'c1', owner)).isMember, false);
});
test('a join grants access; a leave revokes it; a later rejoin restores it', async () => {
  const db = fixture({ CircleMembershipEvent: [event('one', alice, 'active')] });
  assert.equal((await access.getCircleAccess(db, 'c1', alice)).isMember, true);
  db.rows.CircleMembershipEvent.push(event('two', alice, 'left', '2026-09-15T10:01:00.000Z'));
  assert.equal((await access.getCircleAccess(db, 'c1', alice)).isMember, false);
  db.rows.CircleMembershipEvent.push(event('three', alice, 'active', '2026-09-15T10:02:00.000Z'));
  assert.equal((await access.getCircleAccess(db, 'c1', alice)).isMember, true);
});
test('equal-time transitions fail closed', async () => {
  const db = fixture({ CircleMembershipEvent: [event('one', alice, 'active'), event('two', alice, 'left')] });
  assert.equal((await access.getCircleAccess(db, 'c1', alice)).isMember, false);
});
test('changed identities and deleted accounts are not active members', async () => {
  const db = fixture({ User: [owner], CircleMembershipEvent: [event('one', alice, 'active')] });
  assert.equal((await access.getCircleAccess(db, 'c1', { ...alice, did: 'did:plc:changed' })).isMember, false);
  assert.deepEqual((await access.getCircleMembers(db, authority)).map(u => u.id), ['owner']);
});
test('independent member events cannot overwrite each other', async () => {
  const db = fixture({ CircleMembershipEvent: [event('one', alice, 'active'), event('two', bob, 'active')] });
  assert.equal((await access.getCircleMembers(db, authority)).length, 3);
});
test('Circle state reads paginate rather than silently truncating at 200', async () => {
  const rows = Array.from({ length: 201 }, (_, i) => event(String(i), alice, 'left'));
  const db = fixture({ CircleMembershipEvent: rows });
  assert.equal((await access.readCircleRows(db.entities.CircleMembershipEvent, { circle_id: 'c1' })).length, 201);
});
test('Circle creation rejects guests and invalid metadata', async () => {
  assert.equal((await call('create-circle', null, fixture(), { name: 'Circle' })).status, 401);
  assert.equal((await call('create-circle', owner, fixture(), { name: 'x'.repeat(61) })).status, 400);
});
test('Circle creation ignores caller-supplied identities and memberships', async () => {
  const db = fixture();
  const response = await call('create-circle', alice, db, {
    name: 'New Circle', visibility: 'private', did: owner.did,
    owner_user_id: owner.id, member_dids: [owner.did], at_uri: authority.canonical_ref,
  });
  assert.equal(response.status, 200);
  const created = db.rows.CircleAuthority.at(-1);
  assert.equal(created.owner_user_id, alice.id);
  assert.equal(created.owner_did, alice.did);
  assert.equal(created.canonical_ref, undefined);
  assert.deepEqual(db.rows.Circle.at(-1).member_dids, []);
  assert.equal((await response.json()).publication, 'local_only');
});
test('suspended accounts cannot create or join Circles', async () => {
  const db = fixture({ AccountStatus: [{ user_id: alice.id, status: 'suspended' }] });
  assert.equal((await call('create-circle', alice, db, { name: 'Circle' })).status, 403);
  assert.equal((await call('circle-membership', alice, db, { circle_id: 'c1', action: 'join' })).status, 403);
});
test('ordinary creation quota returns a deterministic response', async () => {
  const db = fixture({ CircleAuthority: Array.from({ length: 5 }, (_, i) => ({ ...authority, id: String(i), owner_user_id: alice.id, created_date: new Date().toISOString() })) });
  assert.equal((await call('create-circle', alice, db, { name: 'Circle' })).status, 429);
});
test('private and member-visible Circles cannot be joined by outsiders', async () => {
  for (const visibility of ['private', 'members_visible']) {
    const db = fixture({ CircleAuthority: [{ ...authority, visibility }] });
    assert.equal((await call('circle-membership', alice, db, { circle_id: 'c1', action: 'join' })).status, 404);
    assert.equal(db.rows.CircleMembershipEvent.length, 0);
  }
});
test('public joins use only the authenticated actor and are idempotent', async () => {
  const db = fixture();
  const first = await call('circle-membership', alice, db, { circle_id: 'c1', action: 'join', did: owner.did, user_id: owner.id });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).joined, true);
  assert.equal(db.rows.CircleMembershipEvent[0].user_id, alice.id);
  const second = await call('circle-membership', alice, db, { circle_id: 'c1', action: 'join' });
  assert.equal((await second.json()).joined, false);
  assert.equal(db.rows.CircleMembershipEvent.length, 1);
});
test('leave records a revocation without removing other members', async () => {
  const db = fixture({ CircleMembershipEvent: [event('one', alice, 'active'), event('two', bob, 'active')] });
  assert.equal((await call('circle-membership', alice, db, { circle_id: 'c1', action: 'leave' })).status, 200);
  assert.equal((await access.getCircleAccess(db, 'c1', alice)).isMember, false);
  assert.equal((await access.getCircleAccess(db, 'c1', bob)).isMember, true);
  assert.equal((await call('circle-membership', owner, db, { circle_id: 'c1', action: 'leave' })).status, 409);
});
test('private metadata is not returned to outsiders', async () => {
  const db = fixture({ CircleAuthority: [{ ...authority, visibility: 'private' }] });
  const response = await call('getCircle', alice, db, { circleId: 'c1' });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Circle not found' });
  assert.equal(db.calls.some(c => c.name === 'TradeListing'), false);
});
test('unverified imported Circles expose neither local memberships nor trades', async () => {
  const response = await call('getCircle', bob, fixture({ CircleAuthority: [] }), { circleId: 'c1' });
  const data = await response.json();
  assert.equal(data.membershipAvailable, false);
  assert.equal(data.isMember, false);
  assert.deepEqual(data.circle.member_profiles, []);
  assert.deepEqual(data.scopedTrades, []);
});
test('my circles is driven by account authority instead of a global newest window', async () => {
  const db = fixture({ Circle: [{ id: 'c1', name: 'Old Circle', member_count: 1 }, ...Array.from({ length: 220 }, (_, i) => ({ id: 'other-' + i, did: alice.did }))] });
  const response = await call('getMyCircles', owner, db, {});
  assert.deepEqual((await response.json()).circles.map(c => c.id), ['c1']);
});
test('duplicate local DID mappings fail closed on DID-only visibility paths', async () => {
  const db = fixture({ User: [owner, { ...owner, id: 'impostor' }] });
  assert.equal(await visibility.canViewCircleContent(db, 'c1', owner.did), false);
});
test('nonmember listing injection is excluded even for an authorised viewer', async () => {
  const db = fixture();
  assert.equal(await visibility.canViewCircleScopedListing(db, { circle_ref: 'c1', visibility: 'circle_scoped', did: alice.did, created_by_id: alice.id }, owner.did), false);
  assert.equal(await visibility.canViewCircleScopedListing(db, { circle_ref: 'c1', visibility: 'circle_scoped', did: owner.did, created_by_id: owner.id }, owner.did), true);
});
test('Starter Packs use normal join policy and count duplicate references once', async () => {
  const db = fixture({
    Circle: [{ id: 'c1', name: 'Public' }, { id: 'private', name: 'Private' }],
    CircleAuthority: [authority, { ...authority, id: 'private-auth', circle_id: 'private', visibility: 'private' }],
    StarterPack: [{ id: 'pack', circle_ids: ['private', 'c1', 'c1'], member_dids: [] }],
  });
  const response = await call('follow-starter-pack', alice, db, { packId: 'pack' });
  assert.equal((await response.json()).joined, 1);
  assert.deepEqual(db.rows.CircleMembershipEvent.map(e => e.circle_id), ['c1']);
});
test('challenge submissions deny nonmembers before reading private evidence', async () => {
  const db = fixture({ Challenge: [{ id: 'challenge', scope: 'circle', circle_ref: 'c1', goal: { metric: 'cards_logged' } }] });
  const response = await call('submitChallengeEntry', alice, db, { challengeId: 'challenge', contributionUris: ['card'] });
  assert.equal(response.status, 403);
  assert.equal(db.calls.some(c => c.name === 'CollectionEntry'), false);
});
const challenge = { id: 'challenge', scope: 'circle', circle_ref: 'c1', mode: 'competitive', goal: { target: 10 }, category: 'set-completer' };
const approved = { id: 'entry', challenge_id: 'challenge', participant_did: alice.did, created_by_id: alice.id, participant_name: 'Alice', status: 'approved', contribution_count: 3, category: 'set-completer', submitted_at: '2026-09-15T10:00:00Z' };
const preference = (optIn, ownerId = alice.id, time = '2026-09-15T10:00:00Z') => ({ did: alice.did, created_by_id: ownerId, updated_date: time, config: { challenges: { leaderboardOptIn: optIn } } });
test('circle leaderboards deny nonmembers before reading entries', async () => {
  const db = fixture({ Challenge: [challenge], ChallengeEntry: [approved] });
  assert.equal((await call('getLeaderboard', bob, db, { challengeId: 'challenge' })).status, 403);
  assert.equal(db.calls.some(c => c.name === 'ChallengeEntry'), false);
});
test('circle rankings include only approved account-bound current members', async () => {
  const db = fixture({
    Challenge: [challenge], CircleMembershipEvent: [event('joined', alice, 'active')],
    ChallengeEntry: [approved, { ...approved, id: 'pending', status: 'pending', contribution_count: 100 }, { ...approved, id: 'spoof', created_by_id: bob.id, contribution_count: 100 }, { ...approved, id: 'spam', moderator_labels: ['spam_suspected'], contribution_count: 100 }],
    SettingsConfig: [preference(true)],
  });
  const result = await (await call('getLeaderboard', owner, db, { challengeId: 'challenge' })).json();
  assert.equal(result.feed.length, 1);
  assert.equal(result.feed[0].score, 3);
});
test('forged leaderboard opt-in settings cannot disclose another collector', async () => {
  const db = fixture({ Challenge: [challenge], CircleMembershipEvent: [event('joined', alice, 'active')], ChallengeEntry: [approved], SettingsConfig: [preference(true, bob.id)] });
  assert.deepEqual((await (await call('getLeaderboard', owner, db, { challengeId: 'challenge' })).json()).feed, []);
});
test('the newest owner-bound opt-out wins over older opt-in settings', async () => {
  const db = fixture({ Challenge: [challenge], CircleMembershipEvent: [event('joined', alice, 'active')], ChallengeEntry: [approved], SettingsConfig: [preference(true), preference(false, alice.id, '2026-09-15T11:00:00Z')] });
  assert.deepEqual((await (await call('getLeaderboard', owner, db, { challengeId: 'challenge' })).json()).feed, []);
});
test('public activity never queries private challenge-entry notes', async () => {
  const db = fixture({ ChallengeEntry: [{ created_by_id: alice.id, did: alice.did, notes: 'private evidence' }] });
  const response = await call('get-activity', bob, db, { did: alice.did });
  assert.equal(response.status, 200);
  assert.equal(db.calls.some(c => c.name === 'ChallengeEntry'), false);
  assert.equal(JSON.stringify(await response.json()).includes('private evidence'), false);
});
test('private challenge entries remain available in the owner activity view', async () => {
  const db = fixture({ ChallengeEntry: [{ id: 'private', created_by_id: alice.id, notes: 'my entry' }] });
  const response = await call('get-activity', alice, db, { did: alice.did });
  assert.equal((await response.json()).items.some(i => i.type === 'challenge_entry'), true);
});
test('direct authority/event/legacy-exit writes are locked', () => {
  for (const name of ['CircleAuthority', 'CircleMembershipEvent', 'CircleExit']) {
    const schema = JSON.parse(readFileSync(new URL('base44/entities/' + name + '.jsonc', root), 'utf8'));
    for (const operation of ['read', 'create', 'update', 'delete']) assert.equal(schema.rls[operation], false, name + '.' + operation);
  }
  const circle = JSON.parse(readFileSync(new URL('base44/entities/Circle.jsonc', root), 'utf8'));
  for (const operation of ['create', 'update', 'delete']) assert.equal(circle.rls[operation], false);
});
