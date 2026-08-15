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
// Idempotent: records already under the user's DID are skipped. If the
// function times out or errors mid-batch, the next login resumes for the
// remaining records. Limited to 100 records per entity type per run.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSession, getPdsSessionForUser, pdsRequest } from '../../shared/pdsSession.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const pdsUrl = Deno.env.get('PDS_URL');
    if (!pdsUrl) return Response.json({ error: 'PDS_URL not configured' }, { status: 500 });

    // Re-bridge only works for users who have linked a Bluesky account
    // (a did:plc + stored PdsCredential). Users without a linked account
    // have no per-user PDS repo to migrate content into.
    if (!user.did?.startsWith('did:plc:')) {
      return Response.json({ ok: true, skipped: 'no_did' });
    }

    const creds = await base44.asServiceRole.entities.PdsCredential
      .filter({ user_id: user.id }).catch(() => []);
    if (!creds || creds.length === 0 || !creds[0].app_password) {
      return Response.json({ ok: true, skipped: 'no_credential' });
    }

    const cred = creds[0];
    const userDid = user.did;
    const userPrefix = `at://${userDid}/`;

    // Get both sessions: user's own (for creating) + shared bridge (for deleting old records)
    const { session: userSession } = await getPdsSessionForUser(pdsUrl, userDid, cred.app_password);
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
    const posts = await base44.asServiceRole.entities.Post
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
          await base44.asServiceRole.entities.Post.update(post.id, {
            at_uri: res.uri, cid: res.cid, bridged: true, did: userDid,
          }).catch(() => {});
          rebridged++;
        }
      } catch (e) {
        console.error('re-bridge: post failed', post.id, e?.message || e);
      }
    }

    // --- Re-bridge Reposts ---
    const reposts = await base44.asServiceRole.entities.Repost
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
          await base44.asServiceRole.entities.Repost.update(repost.id, {
            at_uri: res.uri, cid: res.cid, did: userDid,
          }).catch(() => {});
          rebridged++;
        }
      } catch (e) {
        console.error('re-bridge: repost failed', repost.id, e?.message || e);
      }
    }

    // --- Re-bridge Reactions (likes) ---
    const reactions = await base44.asServiceRole.entities.Reaction
      .filter({ created_by_id: user.id }, '-created_date', 100).catch(() => []);
    for (const reaction of reactions || []) {
      if (!reaction.at_uri || reaction.at_uri.startsWith(userPrefix)) continue;
      if (!reaction.subject) continue;
      // Need the subject post's cid — look it up
      let subjectCid = '';
      if (reaction.post_id) {
        const post = await base44.asServiceRole.entities.Post.get(reaction.post_id).catch(() => null);
        if (post?.cid) subjectCid = post.cid;
      }
      if (!subjectCid) continue; // can't create a like without the subject cid
      const record = {
        subject: { uri: reaction.subject, cid: subjectCid },
        createdAt: new Date().toISOString(),
      };
      try {
        const res = await pdsRequest(pdsUrl, userSession.accessJwt, 'com.atproto.repo.createRecord', {
          repo: userDid, collection: 'app.bsky.feed.like', record,
        });
        if (res?.uri) {
          await deleteOldFromBridge(reaction.at_uri);
          await base44.asServiceRole.entities.Reaction.update(reaction.id, {
            at_uri: res.uri, cid: res.cid, bridged: true, did: userDid,
          }).catch(() => {});
          rebridged++;
        }
      } catch (e) {
        console.error('re-bridge: reaction failed', reaction.id, e?.message || e);
      }
    }

    return Response.json({ ok: true, rebridged, userDid });
  } catch (error) {
    console.error('re-bridge-content error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}