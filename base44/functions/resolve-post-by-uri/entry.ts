// resolve-post-by-uri — on-demand resolution of a Bluesky post by its at:// URI.
// Checks if the post already exists locally; if not, fetches it from the public
// AppView (app.bsky.feed.getPosts), maps it via the shared firehoseMappers post
// mapper, creates a local Post record (bridged, created_by_id null for remote),
// and returns the local post id + record. Idempotent — returns the existing
// local post if already present.
//
// This is the engine that lets notifications and links point to on-site routes
// (/post/at/:encodedAtUri) instead of external bsky.app URLs: the PostDetail
// page calls this function when the user opens /post/at/:atUri, the post is
// fetched and stored locally, and the user can then view, reply, like, repost,
// and quote it entirely on-site via the existing PostCard / PostReplyThread.
//
// Input:  { at_uri: string }
// Output: { postId: string, post: object }  (or { error } on failure)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { FIELD_MAPPERS } from '../../shared/firehoseMappers.ts';

const APPVIEW = 'https://public.api.bsky.app';

// Fetch the reply thread (depth 3) from the AppView and store any reply
// posts not yet in the local DB, setting reply_to by resolving each reply's
// parent_uri to a local post id. Idempotent via at_uri dedup.
async function fetchAndStoreThread(svc: any, postUri: string): Promise<void> {
  const url = new URL(`${APPVIEW}/xrpc/app.bsky.feed.getPostThread`);
  url.searchParams.set('uri', postUri);
  url.searchParams.set('depth', '3');
  url.searchParams.set('parentHeight', '0');
  const res = await fetch(url);
  if (!res.ok) return;
  const data = await res.json();
  const thread = data?.thread;
  if (!thread || thread.$type !== 'app.bsky.feed.defs#threadViewPost') return;

  const postMapper = FIELD_MAPPERS['app.bsky.feed.post'];
  if (!postMapper) return;

  // Recursively walk reply nodes, storing each reply post not yet local.
  const walk = async (node: any) => {
    const replies = node?.replies || [];
    for (const child of replies) {
      if (child?.$type !== 'app.bsky.feed.defs#threadViewPost') continue;
      const rp = child.post;
      if (!rp?.uri) continue;
      const existing = await svc.entities.Post.filter({ at_uri: rp.uri }, '-created_date', 1).catch(() => []);
      if (!existing || existing.length === 0) {
        const author = rp.author || {};
        const mapped = postMapper(rp.record || {}, rp.uri, author.did || '', author);
        mapped.cid = rp.cid || '';
        const created = await svc.entities.Post.create(mapped).catch(() => null);
        if (created) {
          const parentUri = rp.record?.reply?.parent?.uri || '';
          if (parentUri) {
            const parents = await svc.entities.Post.filter({ at_uri: parentUri }, '-created_date', 1).catch(() => []);
            if (parents?.[0]?.id) {
              await svc.entities.Post.update(created.id, { reply_to: parents[0].id }).catch(() => {});
            }
          }
        }
      }
      await walk(child);
    }
  };
  await walk(thread);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { at_uri } = body;

    if (!at_uri || typeof at_uri !== 'string') {
      return Response.json({ error: 'at_uri is required' }, { status: 400 });
    }

    // Idempotent: return the existing local post if we already have it.
    try {
      const existing = await svc.entities.Post.filter({ at_uri }, '-created_date', 1);
      if (existing && existing.length > 0) {
        return Response.json({ postId: existing[0].id, post: existing[0] });
      }
    } catch (e) {
      console.error('resolve-post-by-uri: local lookup failed', e?.message || e);
    }

    // Fetch from the public AppView.
    const url = new URL(`${APPVIEW}/xrpc/app.bsky.feed.getPosts`);
    url.searchParams.append('uris', at_uri);
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`resolve-post-by-uri: getPosts failed (${res.status})`);
      return Response.json({ error: `getPosts failed (${res.status})` }, { status: 502 });
    }
    const data = await res.json();
    const remotePost = (data.posts || [])[0];
    if (!remotePost || !remotePost.uri) {
      return Response.json({ error: 'Post not found on Bluesky' }, { status: 404 });
    }

    const mapper = FIELD_MAPPERS['app.bsky.feed.post'];
    if (!mapper) {
      return Response.json({ error: 'Post mapper not configured' }, { status: 500 });
    }

    const author = remotePost.author || {};
    const mapped = mapper(remotePost.record || remotePost.value || {}, remotePost.uri, author.did || '', author);
    mapped.cid = remotePost.cid || '';

    try {
      const created = await svc.entities.Post.create(mapped);
      // Fetch the reply thread so replies are immediately available on the
      // post detail page without waiting for the next firehose-ingest cycle.
      try {
        await fetchAndStoreThread(svc, at_uri);
      } catch (e) {
        console.error('resolve-post-by-uri: thread fetch failed', e?.message || e);
      }
      return Response.json({ postId: created.id, post: created });
    } catch (e) {
      console.error('resolve-post-by-uri: create failed', e?.message || e);
      // Race: another request may have created it between our check and create.
      // Try one more lookup before giving up.
      try {
        const retry = await svc.entities.Post.filter({ at_uri }, '-created_date', 1);
        if (retry && retry.length > 0) {
          return Response.json({ postId: retry[0].id, post: retry[0] });
        }
      } catch {}
      return Response.json({ error: 'Failed to create local post' }, { status: 500 });
    }
  } catch (error) {
    console.error('resolve-post-by-uri error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}