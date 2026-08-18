// publish-standard-document — publishes a site.standard.document record on
// the author's own PDS for a journal, card review, or binder. Called from the
// client after the existing org.swappulse.* bridge completes.
//
// The document is published IN ADDITION to the org.swappulse.* record. The
// org.swappulse.* record remains canonical; the site.standard.document is the
// interoperable long-form metadata wrapper.
//
// Flow:
//   1. Ensure the SwapPulse site publication exists (ensureSitePublication)
//   2. Ensure the author's per-author publication exists (ensureAuthorPublication)
//   3. Upload cover image as a PDS blob (if provided)
//   4. Create the site.standard.document record on the author's PDS
//   5. Return { documentUri, authorPubUri } so the client can store them
//
// Only public-visibility content should call this — callers gate on visibility
// before invoking. Non-public content does not get a standard.site document.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  ensureSitePublication,
  ensureAuthorPublication,
  publishDocument,
  deleteDocument,
} from '../../shared/standardSite.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    // Delete action: remove a standard.site.document from the PDS when the
    // content is deleted or made non-public.
    if (body.action === 'delete') {
      const { documentUri } = body;
      if (!documentUri) return Response.json({ error: 'documentUri is required' }, { status: 400 });
      const ok = await deleteDocument(base44, documentUri);
      return Response.json({ ok, deleted: ok });
    }

    const {
      entityType,      // 'journal' | 'card_review' | 'binder'
      entityId,
      title,
      path,
      description,
      coverImageUrl,
      tags,
      textContent,
      publishedAt,
      bskyPostRef,
      links,
      authorName,
      authorHandle,
      authorAvatar,
    } = body;

    if (!entityType || !title || !path) {
      return Response.json({ error: 'entityType, title, and path are required' }, { status: 400 });
    }
    if (!['journal', 'card_review', 'binder'].includes(entityType)) {
      return Response.json({ error: 'Invalid entityType' }, { status: 400 });
    }

    // 1. Ensure the SwapPulse site publication exists
    const sitePub = await ensureSitePublication(base44);

    // 2. Ensure the author's per-author publication exists
    const profileUrl = `${Deno.env.get('WIX_CHECKOUT_APP_URL') || 'https://swappulse.org'}/profile/${caller.did}`;
    const authorPubUri = await ensureAuthorPublication(base44, {
      did: caller.did,
      name: authorName || caller.full_name || '',
      handle: authorHandle || '',
      avatar: authorAvatar || '',
      profileUrl,
    });

    // 3+4. Publish the document (uploads cover image as blob if provided)
    const documentUri = await publishDocument(base44, {
      siteUri: sitePub.uri,
      authorPubUri,
      title,
      path,
      description,
      coverImageUrl,
      tags,
      textContent,
      publishedAt,
      bskyPostRef,
      links,
    });

    if (!documentUri) {
      return Response.json({ error: 'Failed to publish standard.site document' }, { status: 502 });
    }

    console.log('publish-standard-document: published', entityType, entityId, documentUri);
    return Response.json({ ok: true, documentUri, authorPubUri });
  } catch (error) {
    console.error('publish-standard-document error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});