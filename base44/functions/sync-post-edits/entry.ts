// sync-post-edits — pushes locally-edited bridged posts to the PDS so post
// edits made on SwapPulse are reflected on Bluesky (the outbound half of
// two-way post edit sync). The inbound half is handled by firehose-ingest's
// CID comparison during repo scan.
//
// For each migrated user with a PdsCredential:
//   1. List their bridged posts (bridged=true, at_uri starts with their DID).
//   2. For each post, compare the local content_hash with the stored
//      content_hash to detect edits.
//   3. For edited posts, fetch the existing PDS record, update the text field,
//      regenerate facets (hashtags + links), and push via putRecord.
//      Fetching the existing record preserves reply refs, embeds, and other
//      fields that SwapPulse doesn't track locally.
//
// Returns { scanned, edited, pushed, failed, errors }.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSessionForUser } from '../../shared/pdsSession.ts';
import { computeContentHash } from '../../shared/bridgePublish.ts';
import { attachRichTextFacets } from '../../shared/hashtagFacets.ts';

async function fetchExistingPostRecord(
  pdsUrl: string,
  accessJwt: string,
  repoDid: string,
  rkey: string,
): Promise<any | null> {
  try {
    const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.getRecord`);
    url.searchParams.set('repo', repoDid);
    url.searchParams.set('collection', 'app.bsky.feed.post');
    url.searchParams.set('rkey', rkey);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessJwt}` } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.value || null;
  } catch {
    return null;
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (caller && caller.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    const svc = base44.asServiceRole;
    const pdsUrl = Deno.env.get('PDS_URL');
    if (!pdsUrl) {
      return Response.json({ error: 'PDS_URL not configured' }, { status: 500 });
    }

    // Process migrated users with PDS credentials (their posts live under their
    // own DID, so we need their per-user PDS session).
    const usersWithDid = await svc.entities.User
      .filter({ migrated_from_bluesky: true }, '-created_date', 50).catch(() => []);
    const { getUserIdentity } = await import('../../shared/userIdentity.ts');

    let scanned = 0, edited = 0, pushed = 0, failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const user of (usersWithDid || [])) {
      if (!user.migrated_from_bluesky) continue;
      const identity = await getUserIdentity(svc, user);
      if (!identity) continue;

      let session: any;
      try {
        const s = await getPdsSessionForUser(identity.pdsUrl, identity.did, identity.appPassword);
        session = s.session;
      } catch (e: any) {
        console.error('sync-post-edits: session failed for', identity.did, e?.message || e);
        continue;
      }

      // List this user's bridged posts (under their own DID).
      const posts = await svc.entities.Post
        .filter({ did: identity.did, bridged: true }, '-updated_date', 50).catch(() => []);

      for (const post of (posts || [])) {
        scanned++;
        if (!post.at_uri || !post.at_uri.startsWith(`at://${identity.did}/`)) continue;

        // Compute the current content hash from the local post text and compare
        // with the stored hash to detect edits.
        const currentRecord = {
          $type: 'app.bsky.feed.post',
          text: post.content || '',
        };
        const currentHash = await computeContentHash(currentRecord).catch(() => '');
        if (!currentHash) continue;

        // If no stored hash or the hash matches, no edit detected.
        if (post.content_hash && post.content_hash === currentHash) continue;

        // Edit detected — fetch the existing PDS record to preserve reply
        // refs, embeds, and other fields, then update only the text.
        const rkey = post.at_uri.split('/').pop() || '';
        if (!rkey) continue;

        const existingRecord = await fetchExistingPostRecord(identity.pdsUrl, session.accessJwt, identity.did, rkey);
        if (!existingRecord) {
          // Record was deleted on the PDS — skip (firehose-ingest will tombstone
          // the local copy).
          continue;
        }

        // Update the text and regenerate facets (hashtags + links) from the
        // new text. Preserve all other fields (createdAt, reply, embed, langs).
        existingRecord.text = post.content || '';
        existingRecord.$type = 'app.bsky.feed.post';
        // Regenerate facets from the updated text so hashtags and links render
        // correctly on Bluesky.
        attachRichTextFacets(existingRecord);

        edited++;

        try {
          const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.putRecord`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
            body: JSON.stringify({
              repo: identity.did,
              collection: 'app.bsky.feed.post',
              rkey,
              record: existingRecord,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            // Update the local CID and content_hash so the next run detects
            // no further edits.
            await svc.entities.Post.update(post.id, {
              cid: data.cid || post.cid,
              content_hash: currentHash,
            }).catch(() => {});
            pushed++;
          } else {
            failed++;
            const t = await res.text().catch(() => '');
            errors.push({ id: post.id, error: `putRecord failed (${res.status})` });
            console.error('sync-post-edits: putRecord failed', res.status, t.slice(0, 200));
          }
        } catch (e: any) {
          failed++;
          errors.push({ id: post.id, error: e?.message || 'Unknown error' });
          console.error('sync-post-edits: push error', e?.message || e);
        }
      }
    }

    return Response.json({
      scanned, edited, pushed, failed,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    console.error('sync-post-edits error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}