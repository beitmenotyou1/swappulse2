// Local Circle access is never inferred from editable/federated Circle fields.
// Authority is bound to an immutable local Circle ID and account identity.
// Membership events are append-only: joins/leaves by different people cannot
// overwrite one another's state. Equal-time events fail closed.
export async function readCircleRows(entity: any, query: any) {
  const rows: any[] = [];
  for (let skip = 0; skip < 10000; skip += 200) {
    const page = await entity.filter(query, '-created_date', 200, skip);
    if (!Array.isArray(page)) throw new Error('Circle state unavailable');
    rows.push(...page);
    if (page.length < 200) return rows;
  }
  throw new Error('Circle state exceeds the supported read window');
}

export async function resolveCircleAuthority(svc: any, reference: string) {
  if (typeof reference !== 'string' || !reference || reference.length > 512) return null;
  const query = reference.startsWith('at://')
    ? { canonical_ref: reference } : { circle_id: reference };
  const rows = await svc.entities.CircleAuthority.filter(query, '-created_date', 2);
  if (rows.length !== 1) return null;
  const authority = rows[0];
  if (!authority.circle_id || !authority.owner_user_id || !authority.owner_did ||
      !['private', 'members_visible', 'public'].includes(authority.visibility)) return null;
  return authority;
}

export function latestCircleEvents(rows: any[]) {
  const latest = new Map();
  for (const row of rows) {
    if (!row.user_id || !row.did || !row.created_date) continue;
    const key = row.user_id;
    const previous = latest.get(key);
    if (!previous || row.created_date > previous.created_date) latest.set(key, row);
    else if (row.created_date === previous.created_date && row.id !== previous.id) {
      latest.set(key, { ...row, state: 'left' });
    }
  }
  return latest;
}

export async function getCircleAccess(svc: any, reference: string, user: any) {
  const authority = await resolveCircleAuthority(svc, reference);
  const denied = { authority, isCurator: false, isMember: false, hasExited: false };
  if (!authority || !user?.id || !user?.did) return denied;
  const isCurator = authority.owner_user_id === user.id && authority.owner_did === user.did;
  if (isCurator) return { authority, isCurator: true, isMember: true, hasExited: false };
  const rows = await svc.entities.CircleMembershipEvent.filter(
    { circle_id: authority.circle_id, user_id: user.id }, '-created_date', 2,
  );
  const current = latestCircleEvents(rows).get(user.id);
  const isMember = !!current && current.did === user.did && current.state === 'active';
  return { authority, isCurator: false, isMember, hasExited: !!current && !isMember };
}

export async function getCircleMembers(svc: any, authority: any) {
  const events = await readCircleRows(svc.entities.CircleMembershipEvent, { circle_id: authority.circle_id });
  const current = latestCircleEvents(events);
  const expected = new Map([[authority.owner_user_id, authority.owner_did]]);
  for (const row of current.values()) {
    if (row.state === 'active' && row.user_id !== authority.owner_user_id) expected.set(row.user_id, row.did);
  }
  const ids = [...expected.keys()];
  const members: any[] = [];
  for (let start = 0; start < ids.length; start += 100) {
    const users = await svc.entities.User.filter({ id: { $in: ids.slice(start, start + 100) } }, '-created_date', 100);
    for (const user of users) {
      // Deleted accounts and changed identities do not retain membership.
      if (user.did && expected.get(user.id) === user.did) members.push(user);
    }
  }
  const counts = new Map();
  for (const user of members) counts.set(user.did, (counts.get(user.did) || 0) + 1);
  return members.filter((user) => counts.get(user.did) === 1);
}

export function projectCircle(circle: any, authority: any, members: any[], showMembers: boolean) {
  return {
    id: circle.id, name: circle.name, description: circle.description || '',
    theme: circle.theme, region: circle.region || '',
    visibility: authority?.visibility || 'public',
    did: authority?.owner_did || circle.did || '',
    at_uri: authority?.canonical_ref || '',
    circle_ref: authority ? authority.circle_id : '',
    member_count: authority ? members.length : 0,
    member_dids: showMembers ? members.map((user) => user.did) : [],
    member_profiles: showMembers ? members.map((user) => ({
      did: user.did, name: user.display_name || user.full_name || user.username || 'Collector',
      handle: user.username || user.bsky_handle || '', avatar: user.avatar || '',
    })) : [],
  };
}
