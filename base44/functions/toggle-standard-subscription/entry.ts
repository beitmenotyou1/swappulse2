// toggle-standard-subscription — toggles a site.standard.graph.subscription
// record on the user's PDS, subscribing to (or unsubscribing from) another
// collector's per-author site.standard.publication. Idempotent: if a
// subscription already exists for (did, publicationUri), it's deleted
// (unsubscribe); otherwise it's created (subscribe). The local
// StandardSubscription entity is kept in sync.
//
// The caller passes the authorDid of the collector whose writing they want to
// subscribe to. The function looks up the author's StandardPublication to get
// the publication at:// URI.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createSubscriptionRecord, deleteSubscriptionRecord } from '../../shared/standardSite.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Authentication required' }, { status: 401 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const { authorDid } = body;

    if (!authorDid) return Response.json({ error: 'authorDid is required' }, { status: 400 });
    if (authorDid === caller.did) return Response.json({ error: 'Cannot subscribe to yourself' }, { status: 400 });

    // Look up the author's per-author publication
    const pubs = await svc.entities.StandardPublication
      .filter({ did: authorDid }, '-created_date', 1).catch(() => []);
    const pub = pubs?.[0];
    if (!pub?.publication_uri) {
      return Response.json({ error: 'This collector has not published any long-form content yet' }, { status: 404 });
    }

    // Check if the user already has a subscription
    const existing = await svc.entities.StandardSubscription
      .filter({ did: caller.did, publication_uri: pub.publication_uri }, '-created_date', 1).catch(() => []);

    if (existing?.length > 0) {
      // Unsubscribe
      await deleteSubscriptionRecord(base44, pub.publication_uri).catch(() => {});
      await svc.entities.StandardSubscription.delete(existing[0].id).catch(() => {});
      return Response.json({ ok: true, subscribed: false });
    }

    // Subscribe
    const pdsUri = await createSubscriptionRecord(base44, pub.publication_uri);
    if (!pdsUri) {
      return Response.json({ error: 'Failed to create subscription record on PDS' }, { status: 502 });
    }

    await svc.entities.StandardSubscription.create({
      did: caller.did,
      publication_uri: pub.publication_uri,
      author_did: authorDid,
    }).catch((e: any) => console.error('toggle-standard-subscription: local create failed', e?.message || e));

    return Response.json({ ok: true, subscribed: true });
  } catch (error) {
    console.error('toggle-standard-subscription error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});