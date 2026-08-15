// re-bridge-all-content — admin-triggered bulk re-bridge. Loops over all users
// who have a PdsCredential on the current PDS and re-creates their local
// posts/reposts/likes/follows on the new PDS under their new did:plc, then
// deletes old records from the old PDS (via OLD_PDS_* secrets) where the old
// record lived under the old bridge account.
//
// Use after provision-all-identities to migrate content to the new PDS without
// waiting for each user to log in. Idempotent: records already under the user's
// new DID are skipped. Processes up to 25 users per run to stay within function
// time limits. Re-run until rebridged stops increasing.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSessionForUser, pdsRequest } from '../../shared/pdsSession.ts';

async function getOldPdsSession(): Promise<{ pdsUrl: string; did: string; accessJwt: string } | null> {
  const pdsUrl = Deno.env.get('OLD_PDS_URL');
  const identifier = Deno.env.get('OLD_PDS_IDENTIFIER');
  const password = Deno.env.get('OLD_PDS_APP_PASSWORD');
  if (!pdsUrl || !identifier || !password) return null;
  try {
    const res = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    if (!res.ok) {
      console.error('re-bridge-all: old PDS createSession failed', res.status);
      return null;
    }
    const data = await res.json();
    return { pdsUrl, did: data.did, accessJwt: data.accessJwt };
  } catch (e) {
    console.error('re-bridge-all: old PDS session failed', e?.message || e);
    return null;
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const pdsUrl = Deno.env.get('PDS_URL');
    if (!pdsUrl) return Response.json({ error: 'PDS_URL not configured' }, { status: 500 });

    const svc = base44.asServiceRole;

    // Users provisioned on the current PDS (max 25 per run)
    const creds = await svc.entities.PdsCredential
      .filter({ pds_url: pdsUrl }, '-created_date', 25).catch(() => []);
    if (!creds || creds.length === 0) {
      return Response.json({
        rebridged: 0, users: 0,
        message: 'No users provisioned on the current PDS yet. Run "Provision all identities" first.',
      });
    }

    const oldPds = await getOldPdsSession();
    if (!oldPds) {
      console.warn('re-bridge-all: OLD_PDS_* secrets not set — old records will be orphaned on the old PDS (not deleted). Set OLD_PDS_URL / OLD_PDS_IDENTIFIER / OLD_PDS_APP_PASSWORD to enable cleanup.');
    }

    async function deleteOldFromPds(oldUri: string) {
      if (!oldUri || !oldPds) return;
      const oldDid = oldUri.replace(/^at:\/\//, '').split('/')[0];
      if (oldDid !== oldPds.did) return; // only delete records owned by the old bridge account
      const segs = oldUri.replace(/^at:\/\//, '').split('/');
      const collection = segs[1];
      const rkey = segs[2];
      if (!collection || !rkey) return;
      await pdsRequest(oldPds.pdsUrl, oldPds.accessJwt, 'com.atproto.repo.deleteRecord', {
        repo: oldDid, collection, rkey,
      }).catch(() => {});
    }

    let rebridged = 0;
    const userStats: Array<{ userId: string; did: string; rebridged: number }> = [];

    for (const cred of creds) {
      const userId = cred.user_id;
      const userDid = cred.did;
      const userPrefix = `at://${userDid}/`;
      let perUser = 0;

      let session: any;
      try {
        const s = await getPdsSessionForUser(pdsUrl, userDid, cred.app_password);
        session = s.session;
      } catch (e) {
        console.error('re-bridge-all: session failed for', userId, e?.message || e);
        userStats.push({ userId, did: userDid, rebridged: 0 });
        continue;
      }

      // --- Posts (including replies) ---
      const posts = await svc.entities.Post.filter({ created_by_id: userId }, '-created_date', 100).catch(() => []);
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
          const res = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.createRecord', {
            repo: userDid, collection: 'app.bsky.feed.post', record,
          });
          if (res?.uri) {
            await deleteOldFromPds(post.at_uri);
            await svc.entities.Post.update(post.id, {
              at_uri: res.uri, cid: res.cid, bridged: true, did: userDid,
            }).catch(() => {});
            rebridged++; perUser++;
          }
        } catch (e) {
          console.error('re-bridge-all: post failed', post.id, e?.message || e);
        }
      }

      // --- Reposts ---
      const reposts = await svc.entities.Repost.filter({ created_by_id: userId }, '-created_date', 100).catch(() => []);
      for (const repost of reposts || []) {
        if (!repost.at_uri || repost.at_uri.startsWith(userPrefix)) continue;
        if (!repost.post_uri || !repost.post_cid) continue;
        const record = {
          subject: { uri: repost.post_uri, cid: repost.post_cid },
          createdAt: new Date().toISOString(),
        };
        try {
          const res = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.createRecord', {
            repo: userDid, collection: 'app.bsky.feed.repost', record,
          });
          if (res?.uri) {
            await deleteOldFromPds(repost.at_uri);
            await svc.entities.Repost.update(repost.id, {
              at_uri: res.uri, cid: res.cid, did: userDid,
            }).catch(() => {});
            rebridged++; perUser++;
          }
        } catch (e) {
          console.error('re-bridge-all: repost failed', repost.id, e?.message || e);
        }
      }

      // --- Likes (Reactions) ---
      const reactions = await svc.entities.Reaction.filter({ created_by_id: userId }, '-created_date', 100).catch(() => []);
      for (const reaction of reactions || []) {
        if (!reaction.at_uri || reaction.at_uri.startsWith(userPrefix)) continue;
        if (!reaction.subject) continue;
        let subjectCid = '';
        if (reaction.post_id) {
          const p = await svc.entities.Post.get(reaction.post_id).catch(() => null);
          if (p?.cid) subjectCid = p.cid;
        }
        if (!subjectCid) continue;
        const record = {
          subject: { uri: reaction.subject, cid: subjectCid },
          createdAt: new Date().toISOString(),
        };
        try {
          const res = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.createRecord', {
            repo: userDid, collection: 'app.bsky.feed.like', record,
          });
          if (res?.uri) {
            await deleteOldFromPds(reaction.at_uri);
            await svc.entities.Reaction.update(reaction.id, {
              at_uri: res.uri, cid: res.cid, bridged: true, did: userDid,
            }).catch(() => {});
            rebridged++; perUser++;
          }
        } catch (e) {
          console.error('re-bridge-all: like failed', reaction.id, e?.message || e);
        }
      }

      // --- Follows ---
      const follows = await svc.entities.Follow.filter({ created_by_id: userId }, '-created_date', 100).catch(() => []);
      for (const follow of follows || []) {
        if (!follow.at_uri || follow.at_uri.startsWith(userPrefix)) continue;
        if (!follow.subject_did) continue;
        const record = {
          subject: follow.subject_did,
          createdAt: new Date().toISOString(),
        };
        try {
          const res = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.createRecord', {
            repo: userDid, collection: 'app.bsky.graph.follow', record,
          });
          if (res?.uri) {
            await deleteOldFromPds(follow.at_uri);
            await svc.entities.Follow.update(follow.id, {
              at_uri: res.uri, cid: res.cid, bridged: true, did: userDid,
            }).catch(() => {});
            rebridged++; perUser++;
          }
        } catch (e) {
          console.error('re-bridge-all: follow failed', follow.id, e?.message || e);
        }
      }

      userStats.push({ userId, did: userDid, rebridged: perUser });
    }

    return Response.json({
      rebridged,
      users: creds.length,
      oldPdsConnected: !!oldPds,
      userStats: userStats.slice(0, 25),
    });
  } catch (error) {
    console.error('re-bridge-all-content error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}