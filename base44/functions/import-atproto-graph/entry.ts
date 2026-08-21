// import-atproto-graph — creates local Follow entities from AT Protocol follows.
//
// Three modes (can be combined):
//   1. Array input (registration): { follows: [{ did, handle, displayName, avatar }] }
//      Creates Follow entities for each followed DID. Called after registration.
//   2. PDS-direct (migration): { fromPds: true }
//      Paginates com.atproto.repo.listRecords on app.bsky.graph.follow from the
//      user's own PDS repo via per-user session. Creates Follow entities with
//      bridged=true and at_uri for each outgoing follow.
//   3. Followers (migration): { includeFollowers: true }
//      Paginates app.bsky.graph.getFollowers from the public AppView. Creates
//      Follow entities (service role, bridged=true) for each incoming follower.
//
// Output: { imported, followers_imported, skipped, total }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { dispatchNotification } from '../../shared/notificationDispatcher.ts';
import { getUserIdentity } from '../../shared/userIdentity.ts';
import { getPdsSessionForUser } from '../../shared/pdsSession.ts';

const APPVIEW = 'https://public.api.bsky.app';
const FOLLOW_COLLECTION = 'app.bsky.graph.follow';
const PAGE_LIMIT = 100;
const MAX_PAGES = 10; // cap at 1000 follows/followers per call

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const myDid = user.did || '';
    const svc = base44.asServiceRole;

    // Track existing outgoing follows to avoid duplicates.
    const existing = await base44.entities.Follow.filter({ did: myDid }, '-created_date', 500).catch(() => []);
    const existingDids = new Set(existing.map((f: any) => f.subject_did));
    const newlyImportedDids = new Set<string>();

    let imported = 0;
    let followersImported = 0;
    let skipped = 0;
    let total = 0;

    const fromPds = !!(body as any).fromPds;
    const includeFollowers = !!(body as any).includeFollowers;
    const followsArray = Array.isArray((body as any).follows) ? (body as any).follows : [];

    // Mode 1: Array input (registration flow).
    if (!fromPds && !includeFollowers && followsArray.length > 0) {
      total = followsArray.length;
      for (const f of followsArray) {
        if (!f.did || existingDids.has(f.did)) {
          skipped++;
          continue;
        }
        try {
          await base44.entities.Follow.create({
            subject_did: f.did,
            subject_name: f.displayName || f.handle || '',
            subject_handle: f.handle || '',
            subject_avatar: f.avatar || '',
            did: myDid,
            record_type: 'app.bsky.graph.follow',
          });
          existingDids.add(f.did);
          newlyImportedDids.add(f.did);
          imported++;
        } catch (e) {
          console.error('import-atproto-graph: failed to create follow for', f.did, e?.message || e);
        }
      }
    }

    // Mode 2: PDS-direct (migration flow) — outgoing follows.
    if (fromPds) {
      if (!myDid || !myDid.startsWith('did:plc:')) {
        return Response.json({ error: 'No AT Protocol DID — link Bluesky first' }, { status: 400 });
      }
      const identity = await getUserIdentity(svc, user);
      if (!identity) {
        return Response.json({ error: 'No PDS identity found' }, { status: 400 });
      }

      let session: any;
      try {
        session = (await getPdsSessionForUser(identity.pdsUrl, identity.did, identity.appPassword)).session;
      } catch (e: any) {
        return Response.json({ error: `PDS session failed: ${e?.message || e}` }, { status: 502 });
      }

      let cursor: string | null = null;
      let pageCount = 0;
      do {
        const url = new URL(`${identity.pdsUrl}/xrpc/com.atproto.repo.listRecords`);
        url.searchParams.set('repo', identity.did);
        url.searchParams.set('collection', FOLLOW_COLLECTION);
        url.searchParams.set('limit', String(PAGE_LIMIT));
        if (cursor) url.searchParams.set('cursor', cursor);

        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${session.accessJwt}` },
        });
        if (!res.ok) {
          console.error('import-atproto-graph: listRecords failed', res.status);
          break;
        }
        const data = await res.json();
        const records = data.records || [];
        cursor = data.cursor || null;
        pageCount++;
        total += records.length;

        for (const rec of records) {
          try {
            const atUri = rec.uri || '';
            const val = rec.value || {};
            const subjectDid = val.subject || '';
            if (!subjectDid || existingDids.has(subjectDid)) {
              skipped++;
              continue;
            }
            await svc.entities.Follow.create({
              subject_did: subjectDid,
              did: myDid,
              at_uri: atUri,
              cid: rec.cid || '',
              record_type: 'app.bsky.graph.follow',
              bridged: true,
            });
            existingDids.add(subjectDid);
            newlyImportedDids.add(subjectDid);
            imported++;
          } catch (e) {
            console.error('import-atproto-graph: follow create failed', e?.message || e);
            skipped++;
          }
        }
      } while (cursor && pageCount < MAX_PAGES);
    }

    // Mode 3: Followers (migration flow) — incoming followers from AppView.
    if (includeFollowers) {
      if (!myDid) {
        return Response.json({ error: 'No DID' }, { status: 400 });
      }

      // Get existing followers (where subject_did = myDid) to avoid duplicates.
      const existingFollowers = await svc.entities.Follow.filter({ subject_did: myDid }, '-created_date', 500).catch(() => []);
      const existingFollowerDids = new Set(existingFollowers.map((f: any) => f.did));

      let cursor: string | null = null;
      let pageCount = 0;
      do {
        const url = new URL(`${APPVIEW}/xrpc/app.bsky.graph.getFollowers`);
        url.searchParams.set('actor', myDid);
        url.searchParams.set('limit', String(PAGE_LIMIT));
        if (cursor) url.searchParams.set('cursor', cursor);

        const res = await fetch(url);
        if (!res.ok) {
          console.error('import-atproto-graph: getFollowers failed', res.status);
          break;
        }
        const data = await res.json();
        const followers = data.followers || [];
        cursor = data.cursor || null;
        pageCount++;

        for (const follower of followers) {
          try {
            const followerDid = follower.did || '';
            if (!followerDid || existingFollowerDids.has(followerDid)) {
              skipped++;
              continue;
            }
            // Use service role so created_by_id is null (remote-originated,
            // matching the firehose-ingest pattern for incoming follows).
            await svc.entities.Follow.create({
              subject_did: myDid,
              did: followerDid,
              subject_name: follower.displayName || '',
              subject_handle: follower.handle || '',
              subject_avatar: follower.avatar || '',
              record_type: 'app.bsky.graph.follow',
              bridged: true,
            });
            existingFollowerDids.add(followerDid);
            followersImported++;
          } catch (e) {
            console.error('import-atproto-graph: follower create failed', e?.message || e);
            skipped++;
          }
        }
      } while (cursor && pageCount < MAX_PAGES);
    }

    // Follower reconnection: check if any newly imported follows point at a
    // SwapPulse member who has migrated from Bluesky. If so, dispatch a
    // notification so the migrated collector knows their Bluesky follower has
    // joined SwapPulse and is now following them here too.
    try {
      if (newlyImportedDids.size > 0) {
        const migratedMembers = await svc.entities.User
          .filter({ migrated_from_bluesky: true }, '-created_date', 100)
          .catch(() => []);
        const migratedDids = new Set(migratedMembers.map((u: any) => u.did).filter(Boolean));
        const reconnected = Array.from(newlyImportedDids).filter((d) => migratedDids.has(d));
        if (reconnected.length) {
          const actorName = user.display_name || user.full_name || user.username || user.bsky_handle || 'A collector';
          for (const migratedDid of reconnected) {
            try {
              await dispatchNotification(svc, {
                recipientDid: migratedDid,
                type: 'migration_reconnect',
                title: 'Your Bluesky follower joined SwapPulse',
                body: `${actorName} followed you on Bluesky and has now joined SwapPulse — they're following you here too.`,
                params: { actorDid: myDid, actorName },
                actorDid: myDid,
              });
            } catch (e) {
              console.error('import-atproto-graph: reconnect notify failed for', migratedDid, e?.message);
            }
          }
        }
      }
    } catch (e) {
      console.error('import-atproto-graph: reconnection check failed (non-fatal)', e?.message);
    }

    return Response.json({
      imported,
      followers_imported: followersImported,
      skipped,
      total,
    });
  } catch (error) {
    console.error('import-atproto-graph error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});