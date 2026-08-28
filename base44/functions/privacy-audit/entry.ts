import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const LIMIT = 5000;

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined;
}

function nonZeroNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value !== 0;
}

function binderEntryIds(binder: any): string[] {
  const ids: string[] = [];
  for (const page of Array.isArray(binder?.pages) ? binder.pages : []) {
    for (const slot of Array.isArray(page?.slots) ? page.slots : []) {
      const id = slot?.collection_entry_uri;
      if (typeof id === 'string' && id.trim()) ids.push(id.trim());
    }
  }
  return ids;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole;

    const [entries, binders, users] = await Promise.all([
      svc.entities.CollectionEntry.filter({}, '-created_date', LIMIT).catch(() => []),
      svc.entities.Binder.filter({}, '-created_date', LIMIT).catch(() => []),
      svc.entities.User.filter({}, '-created_date', LIMIT).catch(() => []),
    ]);

    const bridgedEntries = entries.filter((e: any) => e?.bridged === true);
    const publicBinders = binders.filter((b: any) => b?.visibility === 'public');
    const followersBinders = binders.filter((b: any) => b?.visibility === 'followers');
    const privateBinders = binders.filter((b: any) => b?.visibility === 'private');
    const bridgedBinders = binders.filter((b: any) => b?.bridged === true);

    const nonPublicBinders = binders.filter((b: any) => b?.visibility !== 'public');
    const nonPublicEntryIds = new Set<string>();
    for (const binder of nonPublicBinders) {
      for (const id of binderEntryIds(binder)) nonPublicEntryIds.add(id);
    }

    const bridgedEntryIds = new Set(bridgedEntries.map((e: any) => e.id).filter(Boolean));
    const bridgedEntriesInNonPublicBinders = [...nonPublicEntryIds].filter((id) => bridgedEntryIds.has(id));

    const affectedUserIds = new Set<string>();
    for (const e of bridgedEntries) {
      if (e?.created_by_id) affectedUserIds.add(e.created_by_id);
    }
    for (const b of bridgedBinders.filter((b: any) => b?.visibility !== 'public')) {
      if (b?.created_by_id) affectedUserIds.add(b.created_by_id);
    }

    const counts = {
      users_total: users.length,
      collection_entries_total: entries.length,
      collection_entries_bridged: bridgedEntries.length,
      bridged_with_purchase_price: bridgedEntries.filter((e: any) => nonZeroNumber(e?.purchase_price)).length,
      bridged_with_market_value: bridgedEntries.filter((e: any) => nonZeroNumber(e?.market_value)).length,
      bridged_with_acquisition_date: bridgedEntries.filter((e: any) => nonEmpty(e?.acquisition_date)).length,
      bridged_with_notes: bridgedEntries.filter((e: any) => nonEmpty(e?.notes)).length,
      binders_total: binders.length,
      binders_public: publicBinders.length,
      binders_followers: followersBinders.length,
      binders_private: privateBinders.length,
      binders_bridged: bridgedBinders.length,
      bridged_binders_followers: bridgedBinders.filter((b: any) => b?.visibility === 'followers').length,
      bridged_binders_private: bridgedBinders.filter((b: any) => b?.visibility === 'private').length,
      bridged_entries_referenced_by_non_public_binders: bridgedEntriesInNonPublicBinders.length,
      affected_users: affectedUserIds.size,
    };

    return Response.json({
      ok: true,
      read_only: true,
      counts,
      capped: {
        users: users.length >= LIMIT,
        collection_entries: entries.length >= LIMIT,
        binders: binders.length >= LIMIT,
        limit: LIMIT,
      },
      notes: [
        'Counts only. Sensitive CollectionEntry values are not returned.',
        'followers visibility is treated as non-public for AT Protocol privacy purposes.',
        'bridged_entries_referenced_by_non_public_binders counts unique CollectionEntry ids referenced by non-public binder slots.',
      ],
      generated_at: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('privacy-audit failed', e?.message || e);
    return Response.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}
