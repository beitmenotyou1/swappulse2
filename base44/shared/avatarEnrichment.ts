// avatarEnrichment — enriches local Post items with current author avatars
// and display names from the User table, so feeds always show up-to-date
// profile pictures even for posts created before avatar denormalisation
// or when the user updated their avatar after the post was created.
//
// Mutates items in place. Only enriches non-external items with a did.

export async function enrichAuthorAvatars(
  svc: any,
  items: any[]
): Promise<void> {
  const localDids = Array.from(new Set(
    items.filter((i: any) => !i.external && i.did).map((i: any) => i.did)
  ));
  if (!localDids.length) return;

  const users = await svc.entities.User
    .filter({ did: { $in: localDids } }, '-created_date', Math.min(localDids.length, 100))
    .catch(() => []);

  const avatarByDid = new Map<string, string>();
  const nameByDid = new Map<string, string>();
  for (const u of users || []) {
    if (u.did) {
      if (u.avatar) avatarByDid.set(u.did, u.avatar);
      nameByDid.set(u.did, u.display_name || u.full_name || '');
    }
  }

  for (const item of items) {
    if (item.external || !item.did) continue;
    const av = avatarByDid.get(item.did);
    if (av) item.author_avatar = av;
    const nm = nameByDid.get(item.did);
    if (nm && !item.author_name) item.author_name = nm;
  }
}