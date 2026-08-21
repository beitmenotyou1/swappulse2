// re-bridge-content — migrates a user's existing federated records from the
// shared bridge account's PDS repo to their own did:plc repo. Triggered
// fire-and-forget after login from the frontend (AuthContext).
//
// For each local entity authored by the user whose at_uri is NOT under the
// user's own did:plc (i.e., still under the shared bridge account or a
// simulated DID):
//   1. Re-create the PDS record under the user's own repo.
//   2. Delete the old record from the bridge account's repo (if applicable).
//   3. Update the local entity's at_uri + cid to the new values.
//
// Handles:
//   - Standard bsky records: posts (with reply structure), reposts, likes
//   - Custom SwapPulse lexicon records: CollectionEntry, TradeListing, Binder,
//     Journal, CardReview, Vouch, Story, Reaction, Meetup, Challenge, etc.
//     (all org.swappulse.* collections via the generic buildRecord serializer)
//
// Idempotent: records already under the user's DID are skipped. If the
// function times out or errors mid-batch, the next login resumes for the
// remaining records. Limited to 100 records per entity type per run.
//
// Reads identity from the consolidated User record (userIdentity helper) —
// no longer queries the retired PdsCredential entity.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSession, getPdsSessionForUser, pdsRequest } from '../../shared/pdsSession.ts';
import { getUserIdentity } from '../../shared/userIdentity.ts';
import { COLLECTIONS, buildRecord } from '../../shared/firehoseMappers.ts';

// Custom SwapPulse collections to re-bridge (org.swappulse.*). Excludes
// conversation/directMessage (per-conversation, not re-bridgeable) and
// meetupRsvp/challengeEntry/pullNomination (reference other records via
// strongRef and are owned by the participant, not the bridge account).
const CUSTOM_COLLECTIONS_TO_REBRIDGE = [
  'org.swappulse.collectionEntry',
  'org.swappulse.tradeListing',
  'org.swappulse.binder',
  'org.swappulse.journal',
  'org.swappulse.cardReview',
  'org.swappulse.vouch',
  'org.swappulse.wishlist',
  'org.swappulse.circle',
  'org.swappulse.packParty',
  'org.swappulse.meetup',
  'org.swappulse.challenge',
  'org.swappulse.story',
  'org.swappulse.reaction',
  'org.swappulse.voiceSpace',
  'org.swappulse.podcastEpisode',
  'org.swappulse.tradeChain',
  'org.swappulse.tradeDispute',
  'org.swappulse.tradingFeedback',
  'org.swappulse.pullNomination',
];

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const pdsUrl = Deno.env.get('PDS_URL');
    if (!pdsUrl) return Response.json({ error: 'PDS_URL not configured' }, { status: 500 });

    // Re-bridge only works for users who have linked a Bluesky account
    // (a did:plc + consolidated pds_app_password on their User record).
    if (!user.did?.startsWith('did:plc:')) {
      return Response.json({ ok: true, skipped: 'no_did' });
    }

    const svc = base44.asServiceRole;
    const identity = await getUserIdentity(svc, user);
    if (!identity) {
      return Response.json({ ok: true, skipped: 'no_credential' });
    }

    const userDid = identity.did;
    const userPrefix = `at://${userDid}/`;

    // Get both sessions: user's own (for creating) + shared bridge (for deleting old records)
    const { session: userSession } = await getPdsSessionForUser(identity.pdsUrl, identity.did, identity.appPassword);
    let bridgeDid = '';
    let bridgeAccessJwt = '';
    try {
      const bridge = await getPdsSession();
      bridgeDid = bridge.session.did;
      bridgeAccessJwt = bridge.session.accessJwt;
    } catch (e) {
      console.error('re-bridge: could not get bridge session for old-record cleanup', e?.message || e);
    }

    let rebridged = 0;

    // Helper: delete an old record from the bridge account if it lives there
    async function deleteOldFromBridge(oldUri: string) {
      if (!oldUri || !bridgeAccessJwt) return;
      const oldDid = oldUri.replace(/^at:\/\//, '').split('/')[0];
      if (oldDid !== bridgeDid) return; // only delete records owned by the bridge account
      const segs = oldUri.replace(/^at:\/\//, '').split('/');
      const collection = segs[1];
      const rkey = segs[2];
      if (!collection || !rkey) return;
      await pdsRequest(pdsUrl, bridgeAccessJwt, 'com.atproto.repo.deleteRecord', {
        repo: bridgeDid, collection, rkey,
      }).catch(() => {});
    }

    // --- Re-bridge Posts (including replies) ---
    const posts = await svc.entities.Post
      .filter({ created_by_id: user.id }, '-created_date', 100).catch(() => []);
    for (const post of posts || []) {
      if (!post.at_uri || post.at_uri.startsWith(userPrefix)) continue;
      const record: any = {
        text: post.content || '',
        createdAt: new Date().toISOString(),
      };
      if (post.parent_uri && post.parent_cid && post.root_uri && post.root_cid) {
        record.reply = {
          root: { uri: post.root_uri, cid: post.root_cid },
          parent: { uri: post.parent_uri, cid: post.parent_cid },
        };
      }
      try {
        const res = await pdsRequest(pdsUrl, userSession.accessJwt, 'com.atproto.repo.createRecord', {
          repo: userDid, collection: 'app.bsky.feed.post', record,
        });
        if (res?.uri) {
          await deleteOldFromBridge(post.at_uri);
          await svc.entities.Post.update(post.id, {
            at_uri: res.uri, cid: res.cid, bridged: true, did: userDid,
          }).catch(() => {});
          rebridged++;
        }
      } catch (e) {
        console.error('re-bridge: post failed', post.id, e?.message || e);
      }
    }

    // --- Re-bridge Reposts ---
    const reposts = await svc.entities.Repost
      .filter({ created_by_id: user.id }, '-created_date', 100).catch(() => []);
    for (const repost of reposts || []) {
      if (!repost.at_uri || repost.at_uri.startsWith(userPrefix)) continue;
      if (!repost.post_uri || !repost.post_cid) continue;
      const record = {
        subject: { uri: repost.post_uri, cid: repost.post_cid },
        createdAt: new Date().toISOString(),
      };
      try {
        const res = await pdsRequest(pdsUrl, userSession.accessJwt, 'com.atproto.repo.createRecord', {
          repo: userDid, collection: 'app.bsky.feed.repost', record,
        });
        if (res?.uri) {
          await deleteOldFromBridge(repost.at_uri);
          await svc.entities.Repost.update(repost.id, {
            at_uri: res.uri, cid: res.cid, did: userDid,
          }).catch(() => {});
          rebridged++;
        }
      } catch (e) {
        console.error('re-bridge: repost failed', repost.id, e?.message || e);
      }
    }

    // --- Re-bridge Likes ---
    const likes = await svc.entities.Like
      .filter({ created_by_id: user.id }, '-created_date', 100).catch(() => []);
    for (const like of likes || []) {
      if (!like.at_uri || like.at_uri.startsWith(userPrefix)) continue;
      if (!like.post_uri || !like.post_cid) continue;
      const record = {
        subject: { uri: like.post_uri, cid: like.post_cid },
        createdAt: new Date().toISOString(),
      };
      try {
        const res = await pdsRequest(pdsUrl, userSession.accessJwt, 'com.atproto.repo.createRecord', {
          repo: userDid, collection: 'app.bsky.feed.like', record,
        });
        if (res?.uri) {
          await deleteOldFromBridge(like.at_uri);
          await svc.entities.Like.update(like.id, {
            at_uri: res.uri, cid: res.cid, bridged: true, did: userDid,
          }).catch(() => {});
          rebridged++;
        }
      } catch (e) {
        console.error('re-bridge: like failed', like.id, e?.message || e);
      }
    }

    // --- Re-bridge custom SwapPulse lexicon records ---
    // Moves CollectionEntry, TradeListing, Binder, Journal, CardReview, etc.
    // from the bridge account to the user's own did:plc repo so ALL SwapPulse
    // content lives under the user's identity, not just posts/reactions.
    for (const collection of CUSTOM_COLLECTIONS_TO_REBRIDGE) {
      const entityName = COLLECTIONS[collection];
      if (!entityName) continue;
      try {
        const local = await svc.entities[entityName]
          .filter({ created_by_id: user.id }, '-created_date', 100).catch(() => []);
        for (const rec of local || []) {
          if (!rec.at_uri || rec.at_uri.startsWith(userPrefix)) continue;
          const record = buildRecord(rec, collection);
          if (!record) continue;
          try {
            const res = await pdsRequest(pdsUrl, userSession.accessJwt, 'com.atproto.repo.createRecord', {
              repo: userDid, collection, record,
            });
            if (res?.uri) {
              await deleteOldFromBridge(rec.at_uri);
              await svc.entities[entityName].update(rec.id, {
                at_uri: res.uri, cid: res.cid, bridged: true, did: userDid,
              }).catch(() => {});
              rebridged++;
            }
          } catch (e) {
            console.error(`re-bridge: ${collection} failed`, rec.id, e?.message || e);
          }
        }
      } catch (e) {
        console.error(`re-bridge: collection ${collection} error`, e?.message || e);
      }
    }

    return Response.json({ ok: true, rebridged, userDid });
  } catch (error) {
    console.error('re-bridge-content error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}