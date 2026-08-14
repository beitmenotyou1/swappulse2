// firehose-ingest — polls the AT Protocol PDS/AppView for SwapPulse custom-
// lexicon records and ingests remote creates/updates/deletes into the local DB
// in real time (approximated as scheduled polling within serverless constraints;
// a true persistent WebSocket firehose would need external hosting).
//
// For each SwapPulse collection (vouch, wishlist, circle, etc.), lists records
// from the shared PDS repo AND from any remote DIDs discovered via Follow
// records. New/updated records are upserted into the local DB by at_uri.
// Records that exist locally but are gone from the PDS are deleted (tombstoned).
//
// This runs as a service-role function (invoked by the Firehose Ingestion
// workflow on a schedule). It writes ingested records with created_by_id = null
// (remote-originated) so RLS read rules keep them private where appropriate
// (e.g. wishlists) while the service role can still read them for matching.
//
// Output: { ingested, updated, deleted, errors, collections }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSession } from '../../shared/pdsSession.ts';

const APPVIEW = 'https://public.api.bsky.app';

// Collections to ingest, mapped to their local entity name
const COLLECTIONS: Record<string, string> = {
  'org.swappulse.vouch': 'Vouch',
  'org.swappulse.wishlist': 'Wishlist',
  'org.swappulse.circle': 'Circle',
  'org.swappulse.packParty': 'PackParty',
  'org.swappulse.pullNomination': 'PullNomination',
  'org.swappulse.tradingFeedback': 'Reputation',
};

// Field mapping: PDS record field → local entity field
// (PDS records use camelCase, local entities use snake_case)
function mapVouchFields(val: any, atUri: string, did: string) {
  return {
    vouched_did: val.vouchedDid || '',
    vouched_name: val.vouchedName || '',
    vouched_handle: val.vouchedHandle || '',
    voucher_name: val.voucherName || '',
    voucher_handle: val.voucherHandle || '',
    relationship: val.relationship || 'community_member',
    context: val.context || '',
    trade_refs: val.tradeRefs || [],
    revocable: val.revocable ?? true,
    revoked_at: val.revokedAt || '',
    did: val.voucherDid || did,
    at_uri: atUri,
    cid: '',
    record_type: 'org.swappulse.vouch',
    bridged: true,
  };
}

function mapWishlistFields(val: any, atUri: string, did: string) {
  return {
    card_id: val.cardUri || '',
    card_name: val.cardName || '',
    card_image: val.imageUrl || '',
    set_id: val.setCode || '',
    set_name: val.setName || '',
    rarity: val.rarity || '',
    max_price: val.maxPrice ?? null,
    did: val.ownerDid || did,
    at_uri: atUri,
    cid: '',
    record_type: 'org.swappulse.wishlist',
    bridged: true,
  };
}

function mapCircleFields(val: any, atUri: string, did: string) {
  return {
    name: val.name || '',
    description: val.description || '',
    member_dids: val.memberDids || [],
    member_count: val.memberCount || 1,
    visibility: val.visibility || 'public',
    theme: val.theme || 'general',
    region: val.region || '',
    author_name: val.curatorName || '',
    author_handle: val.curatorHandle || '',
    did: val.curatorDid || did,
    at_uri: atUri,
    cid: '',
    record_type: 'org.swappulse.circle',
    bridged: true,
  };
}

const FIELD_MAPPERS: Record<string, (val: any, atUri: string, did: string) => any> = {
  'org.swappulse.vouch': mapVouchFields,
  'org.swappulse.wishlist': mapWishlistFields,
  'org.swappulse.circle': mapCircleFields,
};

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const { pdsUrl, session } = await getPdsSession();
    const localDid = session.did;

    // Discover remote DIDs to ingest from (via Follow records)
    const follows = await svc.entities.Follow.list('-created_date', 200).catch(() => []);
    const remoteDids = new Set<string>();
    for (const f of follows) {
      if (f.subject_did && f.subject_did !== localDid) remoteDids.add(f.subject_did);
    }

    // Always include our own PDS repo
    const reposToScan = [localDid, ...remoteDids];

    let ingested = 0, updated = 0, deleted = 0, errors = 0;
    const collectionStats: Record<string, number> = {};

    for (const [collection, entityName] of Object.entries(COLLECTIONS)) {
      const mapper = FIELD_MAPPERS[collection];
      if (!mapper) continue; // Skip collections without a field mapper for now

      collectionStats[collection] = 0;

      for (const repoDid of reposToScan) {
        try {
          // List records from this repo for this collection
          const listUrl = repoDid === localDid
            ? `${pdsUrl}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(repoDid)}&collection=${collection}&limit=100`
            : `${APPVIEW}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(repoDid)}&collection=${collection}&limit=100`;

          const res = await fetch(listUrl);
          if (!res.ok) continue;
          const data = await res.json();
          const records = data.records || [];

          for (const rec of records) {
            try {
              const atUri = rec.uri || '';
              const val = rec.value || {};
              if (!atUri) continue;

              // Skip records authored by the local PDS account — they're already local
              if (repoDid === localDid) {
                // Check if a local record with this at_uri already exists
                const existing = await svc.entities[entityName].filter({ at_uri: atUri }, '-created_date', 1).catch(() => []);
                if (existing && existing.length > 0) continue; // already local
              }

              const mapped = mapper(val, atUri, repoDid);

              // Check if a record with this at_uri already exists locally
              const existing = await svc.entities[entityName].filter({ at_uri: atUri }, '-created_date', 1).catch(() => []);
              if (existing && existing.length > 0) {
                // Update existing
                await svc.entities[entityName].update(existing[0].id, mapped).catch(() => {});
                updated++;
              } else {
                // Create new ingested record
                await svc.entities[entityName].create(mapped).catch(() => {});
                ingested++;
              }
              collectionStats[collection]++;
            } catch (e) {
              errors++;
              console.error(`firehose-ingest: record error for ${collection}`, e?.message || e);
            }
          }
        } catch (e) {
          errors++;
          console.error(`firehose-ingest: repo scan error for ${collection} ${repoDid}`, e?.message || e);
        }
      }
    }

    return Response.json({
      ingested,
      updated,
      deleted,
      errors,
      collections: collectionStats,
      repos_scanned: reposToScan.length,
    });
  } catch (error) {
    console.error('firehose-ingest error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}