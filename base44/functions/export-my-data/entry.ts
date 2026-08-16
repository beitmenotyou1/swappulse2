// export-my-data — GDPR/CCPA right to data portability. Gathers all entity
// records owned by the calling user and returns them as a downloadable JSON
// archive. Auth required (the user exports their own data only).
//
// Entities are filtered by created_by_id (user-owned) or did (notification/
// settings). Sensitive signature fields (sig) are stripped. The archive
// includes user identity metadata and a timestamp.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// [entityName, filterField] — filterField is 'created_by_id' or 'did'
const EXPORT_ENTITIES: [string, string][] = [
  ['CollectionEntry', 'created_by_id'],
  ['TradeListing', 'created_by_id'],
  ['TradeMessage', 'created_by_id'],
  ['Post', 'created_by_id'],
  ['Binder', 'created_by_id'],
  ['Journal', 'created_by_id'],
  ['Reaction', 'created_by_id'],
  ['Vouch', 'created_by_id'],
  ['Wishlist', 'created_by_id'],
  ['Circle', 'created_by_id'],
  ['Meetup', 'created_by_id'],
  ['MeetupRsvp', 'created_by_id'],
  ['ChallengeEntry', 'created_by_id'],
  ['Story', 'created_by_id'],
  ['CardReview', 'created_by_id'],
  ['TradeChain', 'created_by_id'],
  ['TradeDispute', 'created_by_id'],
  ['VoiceSpace', 'created_by_id'],
  ['PodcastEpisode', 'created_by_id'],
  ['Conversation', 'created_by_id'],
  ['DirectMessage', 'created_by_id'],
  ['Follow', 'created_by_id'],
  ['Like', 'created_by_id'],
  ['Repost', 'created_by_id'],
  ['PullNomination', 'created_by_id'],
  ['PullVote', 'created_by_id'],
  ['SentimentVote', 'created_by_id'],
  ['TradingFeedback', 'created_by_id'],
  ['Notification', 'did'],
  ['SettingsConfig', 'did'],
];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const archive: any = {
      exported_at: new Date().toISOString(),
      legal_basis: 'GDPR Article 20 / CCPA Right to Data Portability',
      user: {
        id: user.id,
        email: user.email,
        did: user.did || '',
        username: user.username || '',
        display_name: user.display_name || '',
      },
      entities: {} as Record<string, any[]>,
    };

    for (const [entityName, filterField] of EXPORT_ENTITIES) {
      try {
        const filter: any = filterField === 'did'
          ? { did: user.did }
          : { created_by_id: user.id };
        const records = await svc.entities[entityName].filter(filter, '-created_date', 5000).catch(() => []);
        // Strip signature/internal fields that aren't user data
        archive.entities[entityName] = (records || []).map((r: any) => {
          const { sig, ...rest } = r;
          return rest;
        });
      } catch (e: any) {
        console.error('export-my-data: entity failed', entityName, e?.message || e);
        archive.entities[entityName] = [];
      }
    }

    console.log('export-my-data: archive built for user', user.id, 'entities:', Object.keys(archive.entities).length);

    return new Response(JSON.stringify(archive, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="swappulse-data-export-${user.id.slice(-8)}.json"`,
      },
    });
  } catch (error: any) {
    console.error('export-my-data error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}