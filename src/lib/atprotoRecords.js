// AT Protocol record builders + bridge helpers for SwapPulse social records.
//
// Converts Base44 entity rows into the canonical AT Protocol record shape
// defined by the lexicons in base44/lexicons/, then persists them on the PDS
// via the atproto-bridge backend function. On success the entity's at_uri +
// cid are updated with the real PDS values, marking the record as bridged.
//
// Usage (frontend, after creating/updating an entity):
//   import { bridgeCollectionEntry, bridgeTradeListing } from '@/lib/atprotoRecords';
//   const bridged = await bridgeCollectionEntry(entry);
//   if (bridged) await base44.entities.CollectionEntry.update(entry.id, bridged);

import { base44 } from '@/api/base44Client';
import { NSID, ensureUserDid, stampRecord } from '@/lib/atproto';

// --- CollectionEntry: entity row → AT Protocol record ---

export function buildCollectionEntryRecord(entry, authorDid = '', authorName = '', authorHandle = '', authorAvatar = '') {
  return {
    $type: NSID.COLLECTION_ENTRY,
    cardUri: entry.card_id || '',
    cardName: entry.card_name || '',
    setName: entry.set_name || '',
    setCode: entry.set_id || '',
    cardNumber: entry.local_id || '',
    rarity: entry.rarity || '',
    category: entry.category || '',
    imageUrl: entry.card_image || '',
    condition: entry.condition || 'near_mint',
    variant: entry.variant || 'normal',
    acquisitionDate: entry.acquisition_date || '',
    purchasePrice: entry.purchase_price ?? 0,
    marketValue: entry.market_value ?? 0,
    notes: entry.notes || '',
    showcased: entry.showcased ?? false,
    binderIndex: entry.binder_index ?? 0,
    authorDid: authorDid || '',
    authorName: authorName || '',
    authorHandle: authorHandle || '',
    authorAvatar: authorAvatar || '',
    createdAt: entry.created_date || new Date().toISOString(),
  };
}

// --- TradeListing: entity row → AT Protocol record ---

export function buildTradeListingRecord(listing, authorDid = '', authorName = '', authorHandle = '', authorAvatar = '') {
  return {
    $type: NSID.TRADE_LISTING,
    offerCardUris: listing.offer_card_ids || [],
    offerCardNames: listing.offer_card_names || [],
    offerCardImages: listing.offer_card_images || [],
    wantedCardUris: listing.wanted_card_ids || [],
    wantedCardNames: listing.wanted_card_names || [],
    status: listing.status || 'open',
    visibility: listing.visibility || 'public',
    circleRef: listing.circle_ref || '',
    shippingRegions: listing.shipping_regions || [],
    preferredCurrency: listing.preferred_currency || 'GBP',
    notes: listing.notes || '',
    expiresAt: listing.expires_at || '',
    authorDid: authorDid || '',
    authorName: authorName || '',
    authorHandle: authorHandle || '',
    authorAvatar: authorAvatar || '',
    createdAt: listing.created_date || new Date().toISOString(),
  };
}

// --- Bridge helpers ---
//
// Each helper stamps the record locally (did, at_uri, cid, sig) then asks the
// PDS to create the real record. On success it returns the fields to persist
// back onto the entity so the local row tracks the federated record. Failures
// are non-fatal: the local record still exists, just un-bridged.

async function bridgeRecord(entityName, record, nsid, entityId) {
  const { did, signingKey } = await ensureUserDid();
  const stamped = await stampRecord(record, nsid, did, signingKey);
  try {
    const res = await base44.functions.invoke('atproto-bridge', {
      collection: nsid,
      record: { ...record, createdAt: record.createdAt },
    });
    if (res?.uri && res?.cid) {
      // Real PDS values override the simulated ones
      stamped.at_uri = res.uri;
      stamped.cid = res.cid;
      stamped.bridged = true;
    }
  } catch (err) {
    console.error(`atprotoRecords: bridge ${nsid} failed for ${entityName} ${entityId}`, err);
  }
  return stamped;
}

export async function bridgeCollectionEntry(entry) {
  const { did } = await ensureUserDid();
  let authorName = '', authorHandle = '', authorAvatar = '';
  try {
    const me = await base44.auth.me();
    authorName = me?.full_name || '';
    authorHandle = me?.custom_handle || (me?.email?.split('@')[0] || '');
    authorAvatar = me?.avatar || '';
  } catch {}
  const record = buildCollectionEntryRecord(entry, did, authorName, authorHandle, authorAvatar);
  const stamped = await bridgeRecord('CollectionEntry', record, NSID.COLLECTION_ENTRY, entry.id);
  return {
    did: stamped.did,
    at_uri: stamped.at_uri,
    cid: stamped.cid,
    record_type: stamped.record_type,
    sig: stamped.sig,
    bridged: stamped.bridged ?? false,
  };
}

export async function bridgeTradeListing(listing) {
  const { did } = await ensureUserDid();
  let authorName = '', authorHandle = '', authorAvatar = '';
  try {
    const me = await base44.auth.me();
    authorName = me?.full_name || '';
    authorHandle = me?.custom_handle || (me?.email?.split('@')[0] || '');
    authorAvatar = me?.avatar || '';
  } catch {}
  const record = buildTradeListingRecord(listing, did, authorName, authorHandle, authorAvatar);
  const stamped = await bridgeRecord('TradeListing', record, NSID.TRADE_LISTING, listing.id);
  return {
    did: stamped.did,
    at_uri: stamped.at_uri,
    cid: stamped.cid,
    record_type: stamped.record_type,
    sig: stamped.sig,
    bridged: stamped.bridged ?? false,
  };
}

// Update a bridged trade listing on the PDS. Call after updating the local
// entity so the federated copy reflects the new state (e.g. status change).
// The at_uri stays the same (putRecord replaces in place); only the cid changes.
export async function updateBridgedTradeListing(listing) {
  if (!listing?.at_uri || !listing?.bridged) return null;
  const { did } = await ensureUserDid().catch(() => ({ did: '' }));
  const record = buildTradeListingRecord(listing, did, listing.author_name || '', listing.author_handle || '', listing.author_avatar || '');
  try {
    const res = await base44.functions.invoke('atproto-bridge', {
      action: 'update',
      collection: NSID.TRADE_LISTING,
      record,
      uri: listing.at_uri,
    });
    if (res?.uri && res?.cid) {
      return { cid: res.cid, content_hash: res.content_hash || '', bridged: true };
    }
    return null;
  } catch (err) {
    console.error('atprotoRecords: update trade listing failed', err);
    return null;
  }
}

// Update a bridged collection entry on the PDS. Call after updating the local
// entity (showcase toggle, condition change, binder reorder) so the federated
// copy reflects the new state. The at_uri stays the same (putRecord replaces in
// place); only the cid changes. Author fields are re-read from the current user
// so the federated record keeps its author metadata. No-op if not bridged.
export async function updateBridgedCollectionEntry(entry) {
  if (!entry?.at_uri || !entry?.bridged) return null;
  const { did } = await ensureUserDid().catch(() => ({ did: '' }));
  let authorName = '', authorHandle = '', authorAvatar = '';
  try {
    const me = await base44.auth.me();
    authorName = me?.full_name || '';
    authorHandle = me?.custom_handle || (me?.email?.split('@')[0] || '');
    authorAvatar = me?.avatar || '';
  } catch {}
  const record = buildCollectionEntryRecord(entry, did, authorName, authorHandle, authorAvatar);
  try {
    const res = await base44.functions.invoke('atproto-bridge', {
      action: 'update',
      collection: NSID.COLLECTION_ENTRY,
      record,
      uri: entry.at_uri,
    });
    if (res?.uri && res?.cid) {
      return { cid: res.cid, content_hash: res.content_hash || '', bridged: true };
    }
    return null;
  } catch (err) {
    console.error('atprotoRecords: update collection entry failed', err);
    return null;
  }
}

// Delete a bridged record from the PDS. Call before deleting the local entity
// so the federated copy is removed too. No-op if the record was never bridged.
export async function unbridgeRecord(entity) {
  if (!entity?.at_uri || !entity?.bridged) return false;
  try {
    await base44.functions.invoke('atproto-bridge', { action: 'delete', uri: entity.at_uri });
    return true;
  } catch (err) {
    console.error('atprotoRecords: unbridge failed', err);
    return false;
  }
}

// Generic update/delete wrappers that route through the bridge-record backend
// function, which builds the lexicon-valid record server-side (via the shared
// BUILDER_CONFIG) and persists content_hash. Use these for entities without a
// dedicated client builder (Vouch, Circle, Meetup, Reaction, etc.) so every
// edit call site can push to the PDS in one call. No-op if the record isn't
// bridged yet. Fire-and-forget from edit sites — failures log and leave the
// record for the next outbound-reconcile pass.
export async function updateBridgedRecord(entity, entityName, collection) {
  if (!entity?.at_uri || !entity?.bridged) return null;
  try {
    const res = await base44.functions.invoke('bridge-record', {
      action: 'update', entityName, recordId: entity.id, collection,
    });
    if (res?.ok) return { cid: res.cid || '', content_hash: res.content_hash || '', bridged: true };
    return null;
  } catch (err) {
    console.error('atprotoRecords: updateBridgedRecord failed', err);
    return null;
  }
}

export async function deleteBridgedRecord(entity, entityName, collection) {
  if (!entity?.at_uri || !entity?.bridged) return false;
  try {
    const res = await base44.functions.invoke('bridge-record', {
      action: 'delete', entityName, recordId: entity.id, collection,
    });
    return !!res?.ok;
  } catch (err) {
    console.error('atprotoRecords: deleteBridgedRecord failed', err);
    return false;
  }
}