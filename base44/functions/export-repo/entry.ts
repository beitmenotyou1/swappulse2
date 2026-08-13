// export-repo — exports the current user's SwapPulse data as an AT Protocol
// compatible repository archive (JSON-encoded CAR-like structure).
//
// Collects all bridged entity records owned by the user, constructs an
// archive with proper at_uri/cid metadata, and returns it as a downloadable
// file. In production, this would produce a binary CAR file with MST entries
// using the @atproto/repo library; this implementation produces a JSON archive
// that captures the same data and can be transformed to a real CAR.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const EXPORT_ENTITIES = [
  { entity: 'Post', collection: 'app.bsky.feed.post' },
  { entity: 'Repost', collection: 'app.bsky.feed.repost' },
  { entity: 'Follow', collection: 'app.bsky.graph.follow' },
  { entity: 'CollectionEntry', collection: 'org.swappulse.collectionEntry' },
  { entity: 'TradeListing', collection: 'org.swappulse.tradeListing' },
  { entity: 'TradeTemplate', collection: 'org.swappulse.tradeTemplate' },
  { entity: 'Achievement', collection: 'org.swappulse.achievement' },
  { entity: 'ChallengeEntry', collection: 'org.swappulse.challengeEntry' },
  { entity: 'Journal', collection: 'org.swappulse.journal' },
  { entity: 'Binder', collection: 'org.swappulse.binder' },
  { entity: 'Vouch', collection: 'org.swappulse.vouch' },
  { entity: 'Reaction', collection: 'org.swappulse.reaction' },
  { entity: 'Circle', collection: 'org.swappulse.circle' },
  { entity: 'Meetup', collection: 'org.swappulse.meetup' },
  { entity: 'ScannerCorrection', collection: 'org.swappulse.scannerCorrection' },
];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;

    const did = (user as any).did || `did:plc:swappulse${user.id.slice(-16)}`;

    const records: Record<string, any[]> = {};
    let totalRecords = 0;

    for (const { entity, collection } of EXPORT_ENTITIES) {
      try {
        const items = await svc.entities[entity].filter(
          { created_by_id: user.id },
          '-created_date',
          1000,
        );
        records[collection] = items.map((r: any) => ({
          uri: r.at_uri || `at://${did}/${collection}/${r.id}`,
          cid: r.cid || null,
          record: { ...r, $type: r.record_type || collection },
        }));
        totalRecords += records[collection].length;
      } catch (e) {
        // Entity may not exist or RLS may block — skip
        records[collection] = [];
      }
    }

    const carArchive = {
      version: 1,
      variant: 'swappulse-repo-export-v1',
      roots: [did],
      exportedAt: new Date().toISOString(),
      did,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      },
      totalRecords,
      records,
    };

    const json = JSON.stringify(carArchive, null, 2);
    const filename = `swappulse-repo-${did.replace(/[^a-zA-Z0-9]/g, '_').slice(-20)}.json`;

    return new Response(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[export-repo] error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}