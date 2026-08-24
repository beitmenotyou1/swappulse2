// entityDedup.ts — shared at_uri dedup + upsert helpers used by every sync
// path (backfill-author-posts, firehose-ingest) so no path can create duplicate
// records for the same at_uri. The find-then-create-or-update is centralized
// here: if the at_uri already exists, the record is updated in place; otherwise
// a new record is created. Also provides a one-time deduplicate helper that
// cleans up existing duplicate Post records for a DID (keeps the most recently
// updated per at_uri).

// Find an existing entity record by at_uri. Returns the first match or null.
export async function findExistingEntity(svc: any, entityName: string, atUri: string): Promise<any | null> {
  if (!atUri) return null;
  const existing = await svc.entities[entityName].filter({ at_uri: atUri }, '-updated_date', 1).catch(() => []);
  return (existing && existing.length > 0) ? existing[0] : null;
}

// Upsert an entity record by at_uri: update if it already exists, create if
// not. Returns { created, id } so callers can distinguish new vs updated and
// reference the record id for downstream notifications.
//
// For Post entities: when updating, preserve existing embed_images and
// embed_external if the new mapped data has empty values for these fields.
// This prevents embeds from being stripped during re-ingestion when the PDS
// record temporarily has no embed (e.g., during AppView indexing lag, or when
// a transient fetch returns partial data). The embed is only overwritten when
// the new data explicitly carries a different (non-empty) value.
export async function upsertEntity(
  svc: any,
  entityName: string,
  mapped: any,
  atUri: string,
): Promise<{ created: boolean; id: string | null }> {
  const existing = await findExistingEntity(svc, entityName, atUri);
  if (existing) {
    const updateData = { ...mapped };
    if (entityName === 'Post') {
      // Preserve existing embeds if the new data has empty/missing embeds.
      // This is the critical fix: without it, any re-ingestion cycle that
      // fetches a post whose embed hasn't been indexed yet would overwrite
      // the stored embed_images with an empty array, causing the post to
      // render as plain text.
      if ((!updateData.embed_images || updateData.embed_images.length === 0) && existing.embed_images && existing.embed_images.length > 0) {
        updateData.embed_images = existing.embed_images;
      }
      if (!updateData.embed_external && existing.embed_external) {
        updateData.embed_external = existing.embed_external;
      }
    }
    await svc.entities[entityName].update(existing.id, updateData).catch(() => {});
    return { created: false, id: existing.id };
  }
  const created = await svc.entities[entityName].create(mapped).catch(() => null);
  return { created: true, id: created?.id || null };
}

// Deduplicate all Post records for a DID: group by at_uri, keep the most
// recently updated record per at_uri, delete the rest. Idempotent and bounded
// (only touches records for the given DID). Returns { kept, deleted }.
export async function deduplicatePostsForDid(
  svc: any,
  did: string,
): Promise<{ kept: number; deleted: number }> {
  let kept = 0;
  let deleted = 0;
  // Load all posts for this DID in one call (personal histories are well under
  // the platform's 5000-record list ceiling). Sort by -updated_date so the
  // first record in each at_uri group is the most recently updated (the keeper).
  const all = await svc.entities.Post.filter({ did }, '-updated_date', 5000).catch(() => []);
  if (!all || all.length === 0) return { kept, deleted };

  const byAtUri = new Map<string, any[]>();
  for (const p of all) {
    if (!p.at_uri) { kept++; continue; }
    if (!byAtUri.has(p.at_uri)) byAtUri.set(p.at_uri, []);
    byAtUri.get(p.at_uri)!.push(p);
  }

  const toDelete: string[] = [];
  for (const [, group] of byAtUri) {
    if (group.length <= 1) { kept++; continue; }
    // group[0] is the most recently updated (query sort) — keep it.
    kept++;
    for (let i = 1; i < group.length; i++) toDelete.push(group[i].id);
  }

  // Delete duplicates in batches via deleteMany with explicit ids (specific
  // filter — never a broad query that could touch other users' records).
  for (let i = 0; i < toDelete.length; i += 100) {
    const chunk = toDelete.slice(i, i + 100);
    await svc.entities.Post.deleteMany({ id: { $in: chunk } }).catch(() => {});
    deleted += chunk.length;
  }
  return { kept, deleted };
}