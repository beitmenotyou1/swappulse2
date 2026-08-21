// get-my-likes — lists the current user's app.bsky.feed.like records from
// their own PDS repo and returns a map of subjectUri → { likeUri, likeCid }.
// Used by the client-side viewerLikes cache to pre-fill liked state on posts
// that were liked directly on bsky.app (not via SwapPulse), preventing
// duplicate like creation and matching bsky.app's viewer state.
//
// Requires a provisioned did:plc + stored PdsCredential. Returns { likes: [] }
// for users without PDS credentials (they have no remote likes to reconcile).
//
// Caps at 500 most-recent likes to stay within serverless time limits.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSessionForUser } from '../../shared/pdsSession.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    let userDid = '';
    let pdsUrl = '';
    let appPassword = '';

    try {
      const me = await base44.auth.me();
      if (!me?.did?.startsWith('did:plc:')) {
        return Response.json({ likes: [], reason: 'no_pds_did' });
      }
      userDid = me.did;
      const { getUserIdentity } = await import('../../shared/userIdentity.ts');
      const identity = await getUserIdentity(svc, me);
      if (!identity) {
        return Response.json({ likes: [], reason: 'no_credential' });
      }
      pdsUrl = identity.pdsUrl;
      appPassword = identity.appPassword;
    } catch {
      return Response.json({ likes: [], reason: 'no_session' });
    }

    const { session } = await getPdsSessionForUser(pdsUrl, userDid, appPassword);
    const accessJwt = session.accessJwt;

    const likes: { subjectUri: string; likeUri: string; likeCid: string }[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
      url.searchParams.set('repo', userDid);
      url.searchParams.set('collection', 'app.bsky.feed.like');
      url.searchParams.set('limit', '100');
      if (cursor) url.searchParams.set('cursor', cursor);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessJwt}` } });
      if (!res.ok) {
        console.error(`get-my-likes: listRecords failed (${res.status})`);
        break;
      }
      const data = await res.json();
      for (const r of data.records || []) {
        const subjectUri = r.value?.subject?.uri;
        if (subjectUri) {
          likes.push({ subjectUri, likeUri: r.uri, likeCid: r.cid || '' });
        }
      }
      cursor = data.cursor || null;
      pages++;
    } while (cursor && pages < 5);

    return Response.json({ likes });
  } catch (error) {
    console.error('get-my-likes error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}