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

export function buildCollectionEntryRecord(entry) {
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
    createdAt: entry.created_date || new Date().toISOString(),
  };
}

// --- TradeListing: entity row → AT Protocol record ---

export function buildTradeListingRecord(listing) {
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
  const record = buildCollectionEntryRecord(entry);
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
  const record = buildTradeListingRecord(listing);
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