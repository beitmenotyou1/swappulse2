// network-feed — reads recent trade listings and collection entries directly
// from the AT Protocol PDS via com.atproto.repo.listRecords.
//
// All SwapPulse records live under the shared bridge PDS account (PDS_URL,
// PDS_IDENTIFIER, PDS_APP_PASSWORD), so listRecords is called with that DID
// as the repo. Records are returned newest-first (TID-sorted).
//
// Each PDS record is enriched with author info (name/handle/avatar) — first
// from fields embedded in the record itself (new records), then from the
// local entity store matched by at_uri (older records).
//
// Input:
//   { type?: 'trades' | 'collections' | 'all', did?: string, limit?: number }
// Output:
//   { items: EnrichedRecord[], total: number, source: 'pds' }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getEnforcedDids } from '../../shared/enforcement.ts';

let cachedSession: { accessJwt: string; did: string; expiresAt: number } | null = null;

async function getSession() {
  const pdsUrl = Deno.env.get('PDS_URL');
  const identifier = Deno.env.get('PDS_IDENTIFIER');
  const password = Deno.env.get('PDS_APP_PASSWORD');
  if (!pdsUrl || !identifier || !password) {
    throw new Error('PDS not configured. Set PDS_URL, PDS_IDENTIFIER, PDS_APP_PASSWORD secrets.');
  }
  if (cachedSession && Date.now() < cachedSession.expiresAt) {
    return { pdsUrl, session: cachedSession };
  }
  const res = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PDS createSession failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  cachedSession = {
    accessJwt: data.accessJwt,
    did: data.did,
    expiresAt: Date.now() + 25 * 60 * 1000,
  };
  return { pdsUrl, session: cachedSession };
}

async function listRecords(
  pdsUrl: string,
  accessJwt: string,
  repoDid: string,
  collection: string,
  limit: number,
): Promise<{ records: any[]; cursor?: string }> {
  const params = new URLSearchParams({
    repo: repoDid,
    collection,
    limit: String(limit),
  });
  let res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.listRecords?${params}`, {
    headers: { Authorization: `Bearer ${accessJwt}` },
  });
  if (res.status === 401) {
    cachedSession = null;
    const fresh = await getSession();
    res = await fetch(`${fresh.pdsUrl}/xrpc/com.atproto.repo.listRecords?${params}`, {
      headers: { Authorization: `Bearer ${fresh.session.accessJwt}` },
    });
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`listRecords failed (${res.status}): ${body}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const type = body.type || 'all';
    const filterDid: string | null = body.did || null;
    const limit = Math.min(Math.max(Number(body.limit) || 30, 1), 100);

    const { pdsUrl, session } = await getSession();
    const svc = base44.asServiceRole;

    const collections =
      type === 'trades' ? ['org.swappulse.tradeListing']
      : type === 'collections' ? ['org.swappulse.collectionEntry']
      : ['org.swappulse.tradeListing', 'org.swappulse.collectionEntry'];

    // Fetch recent records from the PDS in parallel
    const fetches = collections.map((col) =>
      listRecords(pdsUrl, session.accessJwt, session.did, col, limit)
        .then((res) => (res.records || []).map((r) => ({ ...r, _collection: col })))
        .catch((err) => {
          console.error(`network-feed: listRecords ${col} failed`, err.message);
          return [];
        }),
    );
    const results = await Promise.all(fetches);
    const allRecords = results.flat();

    // Build enrichment map from local entities (for author info on older
    // records that don't have authorDid/authorName embedded).
    const uriSet = new Set(allRecords.map((r) => r.uri));
    const entityMap = new Map<string, any>();
    if (uriSet.size) {
      const [trades, entries] = await Promise.all([
        svc.entities.TradeListing.list('-created_date', 500).catch(() => []),
        svc.entities.CollectionEntry.list('-created_date', 500).catch(() => []),
      ]);
      for (const t of trades) if (t.at_uri && uriSet.has(t.at_uri)) entityMap.set(t.at_uri, t);
      for (const c of entries) if (c.at_uri && uriSet.has(c.at_uri)) entityMap.set(c.at_uri, c);
    }

    // Build enriched feed items
    let items = allRecords.map((r) => {
      const record = r.value || {};
      const local = entityMap.get(r.uri);
      return {
        uri: r.uri,
        cid: r.cid,
        collection: r._collection,
        // Author info: prefer record-embedded fields, fall back to local entity
        authorDid: record.authorDid || local?.did || '',
        authorName: record.authorName || local?.author_name || '',
        authorHandle: record.authorHandle || local?.author_handle || '',
        authorAvatar: record.authorAvatar || local?.author_avatar || '',
        localId: local?.id || null,
        // Trade-specific fields
        status: record.status || '',
        offerCardNames: record.offerCardNames || [],
        offerCardImages: record.offerCardImages || [],
        wantedCardNames: record.wantedCardNames || [],
        shippingRegions: record.shippingRegions || [],
        preferredCurrency: record.preferredCurrency || '',
        notes: record.notes || '',
        expiresAt: record.expiresAt || '',
        // Collection-specific fields
        cardName: record.cardName || '',
        cardUri: record.cardUri || '',
        setName: record.setName || '',
        setCode: record.setCode || '',
        cardNumber: record.cardNumber || '',
        rarity: record.rarity || '',
        imageUrl: record.imageUrl || '',
        condition: record.condition || '',
        variant: record.variant || '',
        showcased: record.showcased || false,
        // Common
        createdAt: record.createdAt || '',
      };
    });

    // Filter out content from shadow-banned or suspended users
    const enforcedDids = await getEnforcedDids(svc);
    if (enforcedDids.size > 0) {
      items = items.filter((item) => !enforcedDids.has(item.authorDid));
    }

    // Filter by DID if requested (profile page)
    if (filterDid) {
      items = items.filter((item) => item.authorDid === filterDid);
    }

    // Hide expired trade listings
    const now = new Date().toISOString();
    items = items.filter((item) => {
      if (item.collection === 'org.swappulse.tradeListing' && item.expiresAt && item.expiresAt < now) return false;
      return true;
    });

    // Sort by creation time (newest first)
    items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const slice = items.slice(0, limit);

    return Response.json({
      items: slice,
      total: items.length,
      source: 'pds',
    });
  } catch (error) {
    console.error('network-feed error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});