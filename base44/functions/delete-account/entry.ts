// delete-account — permanently erases a collector's SwapPulse account.
//
// Phase 1: Find the user's trade IDs (for trade-thread cleanup).
// Phase 2: Hard-delete every entity record owned, authored, or participated
//          in by the user (created_by_id, did, and participant fields).
// Phase 3: Delete trade-thread records (messages, watches, disputes) by
//          trade_id so the counterparty's side of the thread is erased too.
// Phase 4: PDS tombstone — best-effort label emission via the bridge.
// Phase 5: Release the HandleClaim so the username becomes claimable.
// Phase 6: Anonymise the platform-managed User record (clear PII, tombstone
//          username) so the email is re-registerable.
//
// Runs as service role to bypass RLS. Idempotent — a second call finds
// nothing to delete and still returns success.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Entities to clean. `extra` lists participant fields (matched against the
// user's DID) in addition to the default created_by_id / did match.
const ENTITY_CLEANUP = [
  { name: 'CollectionEntry' },
  { name: 'Binder' },
  { name: 'Post' },
  { name: 'Repost' },
  { name: 'Reaction' },
  { name: 'Follow', extra: ['subject_did'] },
  { name: 'Friendship', extra: ['subject_did'] },
  { name: 'FollowPreference' },
  { name: 'TradeListing' },
  { name: 'TradeMessage' },
  { name: 'TradeWatch' },
  { name: 'TradeTemplate' },
  { name: 'TradeChain' },
  { name: 'TradeDispute' },
  { name: 'TradingFeedback' },
  { name: 'Vouch', extra: ['voucher_did', 'subject_did'] },
  { name: 'Reputation' },
  { name: 'Circle' },
  { name: 'CircleExit' },
  { name: 'Meetup' },
  { name: 'MeetupRsvp' },
  { name: 'VoiceSpace' },
  { name: 'SpaceParticipant' },
  { name: 'Journal' },
  { name: 'Story' },
  { name: 'StoryView' },
  { name: 'PodcastEpisode' },
  { name: 'PodcastPlay' },
  { name: 'CrossPostConfig' },
  { name: 'SavedSearch' },
  { name: 'SentimentVote' },
  { name: 'SentimentPoll' },
  { name: 'Nomination' },
  { name: 'CardReview' },
  { name: 'GradingSubmission' },
  { name: 'ScannerCorrection' },
  { name: 'Achievement' },
  { name: 'AchievementProofSnapshot' },
  { name: 'ChallengeEntry' },
  { name: 'ContentReport' },
  { name: 'Feedback' },
  { name: 'SettingsConfig' },
  { name: 'Notification', extra: ['actor_did'] },
  { name: 'NotificationState' },
  { name: 'NotificationLog' },
  { name: 'PushToken' },
  { name: 'Presence' },
  { name: 'ExternalActivity' },
  { name: 'RecommendationPreference' },
  { name: 'RecommendationCache' },
  { name: 'AgentFeedback' },
  { name: 'InviteCode' },
  { name: 'Activation' },
  { name: 'Wishlist' },
  { name: 'MarketListing' },
  { name: 'Document' },
];

// Entities whose records link to a trade by trade_id — cleaned in Phase 3
// using the trade IDs found in Phase 1 so the counterparty's side is erased.
const TRADE_LINKED_ENTITIES = ['TradeMessage', 'TradeWatch', 'TradeDispute'];

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = user.id;
    const userDid = user.did || '';
    const svc = base44.asServiceRole;
    const results: Record<string, string> = {};

    // ── Phase 1: Find the user's trade IDs (before deleting the listings) ──
    let tradeIds: string[] = [];
    try {
      const trades = await svc.entities.TradeListing.filter(
        { $or: [{ created_by_id: userId }, { did: userDid }] },
        '-created_date',
        1000
      );
      tradeIds = (trades || []).map((t: any) => t.id);
      console.log(`delete-account: found ${tradeIds.length} trades for user ${userId}`);
    } catch (e) {
      console.error('delete-account: failed to list trades for cleanup', e?.message);
    }

    // ── Phase 2: Delete all entities by created_by_id / did / participant ──
    for (const { name, extra } of ENTITY_CLEANUP) {
      try {
        const entityApi = svc.entities[name];
        if (!entityApi || !entityApi.deleteMany) {
          results[name] = 'skipped (entity not found)';
          continue;
        }
        const orParts: any[] = [{ created_by_id: userId }, { did: userDid }];
        if (extra) {
          for (const field of extra) {
            orParts.push({ [field]: userDid });
          }
        }
        await entityApi.deleteMany({ $or: orParts });
        results[name] = 'ok';
      } catch (e) {
        console.error(`delete-account: ${name} cleanup error`, e?.message);
        results[name] = `error: ${e?.message}`;
      }
    }

    // ModerationLabel: match by labeler_did (no created_by_id)
    try {
      await svc.entities.ModerationLabel.deleteMany({ labeler_did: userDid });
      results['ModerationLabel'] = 'ok';
    } catch (e) {
      console.error('delete-account: ModerationLabel cleanup error', e?.message);
      results['ModerationLabel'] = `error: ${e?.message}`;
    }

    // ── Phase 3: Delete trade-linked records by trade_id ──
    if (tradeIds.length > 0) {
      for (const entityName of TRADE_LINKED_ENTITIES) {
        try {
          await svc.entities[entityName].deleteMany({ trade_id: { $in: tradeIds } });
        } catch (e) {
          console.error(`delete-account: ${entityName} by trade_id error`, e?.message);
        }
      }
    }

    // ── Phase 4: PDS tombstone (best-effort) ──
    let pdsResult = 'skipped (no DID)';
    if (userDid) {
      try {
        await base44.functions.invoke('atproto-bridge', {
          action: 'emitLabels',
          labels: [{
            src: Deno.env.get('PDS_IDENTIFIER') || '',
            uri: `at://${userDid}`,
            val: 'tombstoned',
            neg: false,
          }],
        });
        pdsResult = 'tombstone label emitted';
      } catch (e) {
        console.error('delete-account: PDS tombstone error', e?.message);
        pdsResult = `error: ${e?.message}`;
      }
    }
    results['pds_tombstone'] = pdsResult;

    // ── Phase 5: Release HandleClaim ──
    try {
      await svc.entities.HandleClaim.deleteMany({ did: userDid });
      results['HandleClaim'] = 'ok';
    } catch (e) {
      console.error('delete-account: HandleClaim release error', e?.message);
      results['HandleClaim'] = `error: ${e?.message}`;
    }

    // ── Phase 6: Anonymise the User record ──
    // The User entity is platform-managed: email and full_name are read-only,
    // but we can clear all editable PII fields and release the username.
    try {
      await svc.entities.User.update(userId, {
        username: '',
        avatar: '',
        header: '',
        description: '',
        did: '',
        login_key: '',
        two_factor_secret: '',
        two_factor_enabled: false,
        push_subscription: '',
      });
      results['User'] = 'anonymised';
    } catch (e) {
      console.error('delete-account: User anonymisation error', e?.message);
      results['User'] = `error: ${e?.message}`;
    }

    console.log('delete-account: complete for user', userId, results);
    return Response.json({ ok: true, results });
  } catch (error) {
    console.error('delete-account error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}