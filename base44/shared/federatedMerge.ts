// federatedMerge — shared dedup/merge layer for blending local entity records
// with remote records ingested from the AT Protocol firehose/PDS.
//
// The pattern: build a Map keyed by at_uri. Remote records go in first (they're
// the federated source of truth for their own at_uri). Local records that share
// an at_uri are skipped (already represented by the remote copy). Local-only
// records (no at_uri, or at_uri not in remote set) are added with a synthetic
// key so they're preserved.
//
// This is idempotent against firehose redelivery: the same remote record
// ingested twice just overwrites the same at_uri key, producing no duplicate.
//
// Usage:
//   const merged = mergeByAtUri(localRecords, remoteRecords, {
//     localMapper: (r) => ({ ...r, federated: !!r.bridged }),
//     remoteMapper: (r) => ({ ...r, federated: true }),
//     sortField: 'created_at',
//   });

export interface MergeOptions {
  localMapper?: (rec: any) => any;
  remoteMapper?: (rec: any) => any;
  sortField?: string;
  sortDesc?: boolean;
}

export function mergeByAtUri(
  localRecords: any[],
  remoteRecords: any[],
  opts: MergeOptions = {},
): any[] {
  const { localMapper, remoteMapper, sortField = 'created_at', sortDesc = true } = opts;
  const merged = new Map<string, any>();

  // Remote records first — they own their at_uri slot
  for (const r of remoteRecords) {
    const key = r.at_uri || r.uri;
    if (key) merged.set(key, remoteMapper ? remoteMapper(r) : r);
  }

  // Local records — skip if their at_uri is already represented by a remote copy
  for (const r of localRecords) {
    const key = r.at_uri || `local:${r.id}`;
    if (!merged.has(key)) {
      merged.set(key, localMapper ? localMapper(r) : r);
    }
  }

  const results = [...merged.values()];
  if (sortField) {
    results.sort((a, b) => {
      const av = a[sortField] || '';
      const bv = b[sortField] || '';
      return sortDesc ? bv.localeCompare(av) : av.localeCompare(bv);
    });
  }
  return results;
}

// Merge a single entity type's local + remote records, returning a deduplicated
// list with a `federated` boolean flag on each record. Convenience wrapper.
export function mergeFederatedRecords(
  localRecords: any[],
  remoteRecords: any[],
  opts: MergeOptions = {},
): any[] {
  return mergeByAtUri(localRecords, remoteRecords, {
    ...opts,
    localMapper: opts.localMapper || ((r) => ({ ...r, federated: !!r.bridged })),
    remoteMapper: opts.remoteMapper || ((r) => ({ ...r, federated: true })),
  });
}