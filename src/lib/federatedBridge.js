// Frontend bridge helpers for Phase 1 federated record types (Vouch, Wishlist,
// Circle). Stamps each record with AT Protocol metadata locally, then asks the
// atproto-bridge backend function to create the real record on the PDS. On
// success, the entity's at_uri + cid are updated with the real PDS values,
// marking the record as bridged.
//
// Pattern follows src/lib/atprotoRecords.js (CollectionEntry/TradeListing bridges).

import { base44 } from '@/api/base44Client';
import { NSID, ensureUserDid, stampRecord } from '@/lib/atproto';

// --- Vouch: entity row → AT Protocol record ---

export function buildVouchRecord(vouch, voucherDid = '', voucherName = '', voucherHandle = '') {
  return {
    $type: NSID.VOUCH,
    vouchedDid: vouch.vouched_did || '',
    vouchedName: vouch.vouched_name || '',
    vouchedHandle: vouch.vouched_handle || '',
    voucherDid: voucherDid || '',
    voucherName: voucherName || '',
    voucherHandle: voucherHandle || '',
    relationship: vouch.relationship || 'community_member',
    context: vouch.context || '',
    tradeRefs: vouch.trade_refs || [],
    revocable: vouch.revocable ?? true,
    revokedAt: vouch.revoked_at || '',
    createdAt: new Date().toISOString(),
  };
}

// --- Wishlist: entity row → AT Protocol record ---

export function buildWishlistRecord(wishlist, ownerDid = '', ownerName = '', ownerHandle = '') {
  return {
    $type: NSID.WISHLIST,
    cardUri: wishlist.card_id || '',
    cardName: wishlist.card_name || '',
    setName: wishlist.set_name || '',
    setCode: wishlist.set_id || '',
    rarity: wishlist.rarity || '',
    imageUrl: wishlist.card_image || '',
    maxPrice: wishlist.max_price ?? null,
    ownerDid: ownerDid || '',
    ownerName: ownerName || '',
    ownerHandle: ownerHandle || '',
    createdAt: new Date().toISOString(),
  };
}

// --- Circle: entity row → AT Protocol record ---

export function buildCircleRecord(circle, curatorDid = '', curatorName = '', curatorHandle = '') {
  return {
    $type: NSID.CIRCLE,
    name: circle.name || '',
    description: circle.description || '',
    memberDids: circle.member_dids || [],
    memberCount: circle.member_count || 1,
    visibility: circle.visibility || 'public',
    theme: circle.theme || 'general',
    region: circle.region || '',
    curatorDid: curatorDid || '',
    curatorName: curatorName || '',
    curatorHandle: curatorHandle || '',
    createdAt: new Date().toISOString(),
  };
}

// --- Bridge helpers ---

async function bridgeRecord(record, nsid) {
  const { did, signingKey } = await ensureUserDid();
  const stamped = await stampRecord(record, nsid, did, signingKey);
  try {
    const res = await base44.functions.invoke('atproto-bridge', {
      collection: nsid,
      record: { ...record, createdAt: record.createdAt },
    });
    if (res?.data?.uri && res?.data?.cid) {
      stamped.at_uri = res.data.uri;
      stamped.cid = res.data.cid;
      stamped.bridged = true;
    }
  } catch (err) {
    console.error(`federatedBridge: bridge ${nsid} failed`, err);
  }
  return stamped;
}

export async function bridgeVouch(vouch) {
  const { did } = await ensureUserDid();
  let voucherName = '', voucherHandle = '';
  try {
    const me = await base44.auth.me();
    voucherName = me?.full_name || '';
    voucherHandle = me?.custom_handle || (me?.email?.split('@')[0] || '');
  } catch {}
  const record = buildVouchRecord(vouch, did, voucherName, voucherHandle);
  const stamped = await bridgeRecord(record, NSID.VOUCH);
  return {
    did: stamped.did,
    at_uri: stamped.at_uri,
    cid: stamped.cid,
    record_type: stamped.record_type,
    sig: stamped.sig,
    bridged: stamped.bridged ?? false,
  };
}

export async function bridgeWishlist(wishlist) {
  const { did } = await ensureUserDid();
  let ownerName = '', ownerHandle = '';
  try {
    const me = await base44.auth.me();
    ownerName = me?.full_name || '';
    ownerHandle = me?.custom_handle || (me?.email?.split('@')[0] || '');
  } catch {}
  const record = buildWishlistRecord(wishlist, did, ownerName, ownerHandle);
  const stamped = await bridgeRecord(record, NSID.WISHLIST);
  return {
    did: stamped.did,
    at_uri: stamped.at_uri,
    cid: stamped.cid,
    record_type: stamped.record_type,
    sig: stamped.sig,
    bridged: stamped.bridged ?? false,
  };
}

export async function bridgeCircle(circle) {
  const { did } = await ensureUserDid();
  let curatorName = '', curatorHandle = '';
  try {
    const me = await base44.auth.me();
    curatorName = me?.full_name || '';
    curatorHandle = me?.custom_handle || (me?.email?.split('@')[0] || '');
  } catch {}
  const record = buildCircleRecord(circle, did, curatorName, curatorHandle);
  const stamped = await bridgeRecord(record, NSID.CIRCLE);
  return {
    did: stamped.did,
    at_uri: stamped.at_uri,
    cid: stamped.cid,
    record_type: stamped.record_type,
    sig: stamped.sig,
    bridged: stamped.bridged ?? false,
  };
}

// Delete a bridged record from the PDS. Call before deleting the local entity.
export async function unbridgeFederatedRecord(entity) {
  if (!entity?.at_uri || !entity?.bridged) return false;
  try {
    await base44.functions.invoke('atproto-bridge', { action: 'delete', uri: entity.at_uri });
    return true;
  } catch (err) {
    console.error('federatedBridge: unbridge failed', err);
    return false;
  }
}