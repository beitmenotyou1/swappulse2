// bridgePublish — shared outbound bridge module: pushes local entity records to
// users' PDS repos as real org.swappulse.* (and site.standard.*) records via
// the atproto-bridge backend function, then updates the local entity's
// at_uri/cid/bridged fields so the record is linked to its federated copy.
//
// This closes the outbound half of the AT Protocol loop. The inbound half is
// handled by firehose-ingest, which sees the published record on the firehose
// and dedupes it via IngestCursor (matching by at_uri) — so bridged records
// round-trip back through feed generators without duplication.
//
// Non-fatal: if the PDS is unreachable or atproto-bridge errors, the local
// entity is left with bridged=false and a backfill workflow (re-bridge-all-
// content) retries later. The local record always persists regardless.
//
// Usage from backend functions:
//   import { publishRecord, publishJournal } from '../../shared/bridgePublish.ts';
//   await publishJournal(base44, journal.id);
// Or generically:
//   await publishRecord(base44, 'Journal', journal.id);

import { buildRecord, COLLECTIONS } from './firehoseMappers.ts';

// Reverse map: entity name → AT Protocol collection NSID. Built once from the
// canonical COLLECTIONS map in firehoseMappers so there is a single source of
// truth for collection↔entity mappings.
const ENTITY_TO_COLLECTION: Record<string, string> = {};
for (const [coll, ent] of Object.entries(COLLECTIONS)) {
  ENTITY_TO_COLLECTION[ent] = coll;
}

export function collectionForEntity(entityName: string): string | undefined {
  return ENTITY_TO_COLLECTION[entityName];
}

// ─── Generic publish / update / delete ───────────────────────────────────

// Publish a local entity record to the PDS as a new org.swappulse.* record.
// Maps the entity via buildRecord, calls atproto-bridge create, and updates
// at_uri/cid/bridged/did. Skips if already bridged (unless force=true). Returns
// { ok, at_uri?, cid?, error? }.
export async function publishRecord(
  base44: any,
  entityName: string,
  recordId: string,
  collection?: string,
  force = false,
): Promise<{ ok: boolean; at_uri?: string; cid?: string; error?: string; already?: boolean }> {
  const coll = collection || ENTITY_TO_COLLECTION[entityName];
  if (!coll) return { ok: false, error: `No collection mapping for ${entityName}` };

  const svc = base44.asServiceRole;
  let entity: any;
  try {
    const rows = await svc.entities[entityName].filter({ id: recordId }, '-created_date', 1);
    entity = rows?.[0];
  } catch (e) {
    return { ok: false, error: `entity read failed: ${e?.message || e}` };
  }
  if (!entity) return { ok: false, error: 'record not found' };

  if (entity.bridged && entity.at_uri && !force) {
    return { ok: true, already: true, at_uri: entity.at_uri };
  }

  try {
    const record = buildRecord(entity, coll);
    const res = await base44.functions.invoke('atproto-bridge', {
      action: 'create',
      collection: coll,
      record,
    });
    if (res?.uri) {
      await svc.entities[entityName].update(recordId, {
        at_uri: res.uri,
        cid: res.cid || '',
        bridged: true,
        did: res.did || entity.did,
      }).catch(() => {});
      return { ok: true, at_uri: res.uri, cid: res.cid };
    }
    console.error(`bridgePublish: atproto-bridge create failed for ${entityName}/${recordId}`, res?.error);
    return { ok: false, error: res?.error || 'createRecord returned no uri' };
  } catch (e) {
    console.error(`bridgePublish: publishRecord error for ${entityName}/${recordId}`, e?.message || e);
    return { ok: false, error: e?.message || 'Unknown error' };
  }
}

// Update an already-bridged record in place (putRecord at the same rkey). Maps
// the current entity state, calls atproto-bridge update, and refreshes cid.
// Returns { ok, at_uri?, cid?, error? }.
export async function updateBridgedRecord(
  base44: any,
  entityName: string,
  recordId: string,
  collection?: string,
): Promise<{ ok: boolean; at_uri?: string; cid?: string; error?: string }> {
  const coll = collection || ENTITY_TO_COLLECTION[entityName];
  if (!coll) return { ok: false, error: `No collection mapping for ${entityName}` };

  const svc = base44.asServiceRole;
  let entity: any;
  try {
    const rows = await svc.entities[entityName].filter({ id: recordId }, '-created_date', 1);
    entity = rows?.[0];
  } catch (e) {
    return { ok: false, error: `entity read failed: ${e?.message || e}` };
  }
  if (!entity || !entity.at_uri) return { ok: false, error: 'record not bridged' };

  try {
    const record = buildRecord(entity, coll);
    const res = await base44.functions.invoke('atproto-bridge', {
      action: 'update',
      uri: entity.at_uri,
      collection: coll,
      record,
    });
    if (res?.uri) {
      await svc.entities[entityName].update(recordId, {
        cid: res.cid || entity.cid || '',
      }).catch(() => {});
      return { ok: true, at_uri: res.uri, cid: res.cid };
    }
    console.error(`bridgePublish: atproto-bridge update failed for ${entityName}/${recordId}`, res?.error);
    return { ok: false, error: res?.error || 'putRecord returned no uri' };
  } catch (e) {
    console.error(`bridgePublish: updateBridgedRecord error for ${entityName}/${recordId}`, e?.message || e);
    return { ok: false, error: e?.message || 'Unknown error' };
  }
}

// Delete a bridged record from the PDS. Leaves the local entity untouched —
// the caller decides whether to delete the local row too. Returns { ok }.
export async function deleteBridgedRecord(
  base44: any,
  entityName: string,
  recordId: string,
  collection?: string,
): Promise<{ ok: boolean; error?: string }> {
  const coll = collection || ENTITY_TO_COLLECTION[entityName];
  if (!coll) return { ok: false, error: `No collection mapping for ${entityName}` };

  const svc = base44.asServiceRole;
  let entity: any;
  try {
    const rows = await svc.entities[entityName].filter({ id: recordId }, '-created_date', 1);
    entity = rows?.[0];
  } catch (e) {
    return { ok: false, error: `entity read failed: ${e?.message || e}` };
  }
  if (!entity || !entity.at_uri) return { ok: true };

  try {
    await base44.functions.invoke('atproto-bridge', {
      action: 'delete',
      uri: entity.at_uri,
    });
    return { ok: true };
  } catch (e) {
    console.error(`bridgePublish: deleteBridgedRecord error for ${entityName}/${recordId}`, e?.message || e);
    return { ok: false, error: e?.message || 'Unknown error' };
  }
}

// ─── Per-record-type record builders (entity → lexicon-valid record) ──────
// Thin wrappers over buildRecord so callers don't need to know the collection
// NSID. Used by outbound-reconcile and by the per-type publish helpers below.
// NOTE: MarketListing has no org.swappulse.* lexicon (it is a local-only
// Stripe-checkout entity), so no toMarketListingRecord wrapper exists here.

export const toJournalRecord = (e: any) => buildRecord(e, 'org.swappulse.journal');
export const toBinderRecord = (e: any) => buildRecord(e, 'org.swappulse.binder');
export const toCardReviewRecord = (e: any) => buildRecord(e, 'org.swappulse.cardReview');
export const toReactionRecord = (e: any) => buildRecord(e, 'org.swappulse.reaction');
export const toVouchRecord = (e: any) => buildRecord(e, 'org.swappulse.vouch');
export const toCircleRecord = (e: any) => buildRecord(e, 'org.swappulse.circle');
export const toTradeListingRecord = (e: any) => buildRecord(e, 'org.swappulse.tradeListing');
export const toTradeChainRecord = (e: any) => buildRecord(e, 'org.swappulse.tradeChain');
export const toTradeDisputeRecord = (e: any) => buildRecord(e, 'org.swappulse.tradeDispute');
export const toStandardSubscriptionRecord = (e: any) => buildRecord(e, 'site.standard.graph.subscription');

// ─── Per-record-type publish helpers ─────────────────────────────────────
// Convenience wrappers so callers use a descriptive name per type instead of
// passing the entity name + collection string each time.

export const publishJournal = (b: any, id: string, force = false) =>
  publishRecord(b, 'Journal', id, 'org.swappulse.journal', force);
export const publishBinder = (b: any, id: string, force = false) =>
  publishRecord(b, 'Binder', id, 'org.swappulse.binder', force);
export const publishCardReview = (b: any, id: string, force = false) =>
  publishRecord(b, 'CardReview', id, 'org.swappulse.cardReview', force);
export const publishReaction = (b: any, id: string, force = false) =>
  publishRecord(b, 'Reaction', id, 'org.swappulse.reaction', force);
export const publishVouch = (b: any, id: string, force = false) =>
  publishRecord(b, 'Vouch', id, 'org.swappulse.vouch', force);
export const publishCircle = (b: any, id: string, force = false) =>
  publishRecord(b, 'Circle', id, 'org.swappulse.circle', force);
export const publishTradeListing = (b: any, id: string, force = false) =>
  publishRecord(b, 'TradeListing', id, 'org.swappulse.tradeListing', force);
export const publishTradeChain = (b: any, id: string, force = false) =>
  publishRecord(b, 'TradeChain', id, 'org.swappulse.tradeChain', force);
export const publishTradeDispute = (b: any, id: string, force = false) =>
  publishRecord(b, 'TradeDispute', id, 'org.swappulse.tradeDispute', force);
export const publishStandardSubscription = (b: any, id: string, force = false) =>
  publishRecord(b, 'StandardSubscription', id, 'site.standard.graph.subscription', force);

export const updateJournal = (b: any, id: string) =>
  updateBridgedRecord(b, 'Journal', id, 'org.swappulse.journal');
export const updateBinder = (b: any, id: string) =>
  updateBridgedRecord(b, 'Binder', id, 'org.swappulse.binder');
export const updateCardReview = (b: any, id: string) =>
  updateBridgedRecord(b, 'CardReview', id, 'org.swappulse.cardReview');
export const updateTradeListing = (b: any, id: string) =>
  updateBridgedRecord(b, 'TradeListing', id, 'org.swappulse.tradeListing');
export const updateTradeChain = (b: any, id: string) =>
  updateBridgedRecord(b, 'TradeChain', id, 'org.swappulse.tradeChain');