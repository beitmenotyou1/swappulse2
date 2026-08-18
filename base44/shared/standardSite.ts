// standardSite — shared module for Standard.site (site.standard.*) publishing.
//
// Provides helpers to build site.standard.document and site.standard.publication
// records, resolve the SwapPulse publication URI, ensure per-author publications,
// upload cover images as PDS blobs, and map the Midnight Vault theme to
// site.standard.theme.basic RGB values.
//
// Standard.site records are published IN ADDITION to the existing
// org.swappulse.* records. The org.swappulse.* record remains the canonical
// SwapPulse record; the site.standard.document is the interoperable long-form
// metadata wrapper that makes the content portable and discoverable across the
// ATmosphere.

import { getPdsSession, getPdsSessionForUser, pdsRequest, clearPdsSession } from './pdsSession.ts';

// ─── Theme ──────────────────────────────────────────────────────────────────
// Midnight Vault palette (from src/index.css .dark) mapped to RGB integers.
// background:  hsl(226 47% 9%)  ≈ [12, 17, 34]
// foreground:  hsl(210 40% 96%) ≈ [241, 245, 249]
// accent:      hsl(45 96% 56%)  ≈ [251, 197, 35]
// accentFg:    same as background
export const SWAPPULSE_THEME = {
  background: [12, 17, 34],
  foreground: [241, 245, 249],
  accent: [251, 197, 35],
  accentForeground: [12, 17, 34],
};

// SwapPulse site URL — the publication url field. Uses the configured app URL
// so it works in preview and production.
function getSiteUrl(): string {
  return Deno.env.get('WIX_CHECKOUT_APP_URL') || 'https://swappulse.org';
}

// ─── Publication helpers ────────────────────────────────────────────────────

/** Build a site.standard.publication record for the SwapPulse site itself. */
export function buildSitePublicationRecord(iconBlob: any = null): any {
  const rec: any = {
    $type: 'site.standard.publication',
    name: 'SwapPulse',
    url: getSiteUrl(),
    description: 'A decentralized social network for Pokémon TCG collectors. Free, open-source, and built on the AT Protocol.',
    basicTheme: SWAPPULSE_THEME,
    preferences: { showInDiscover: true },
  };
  if (iconBlob) rec.icon = iconBlob;
  return rec;
}

/** Build a per-author site.standard.publication record for a collector. */
export function buildAuthorPublicationRecord(params: {
  name: string;
  handle: string;
  avatar: string;
  profileUrl: string;
  iconBlob?: any;
}): any {
  const rec: any = {
    $type: 'site.standard.publication',
    name: params.name || params.handle || 'SwapPulse Collector',
    url: params.profileUrl,
    description: `Collector writing on SwapPulse${params.handle ? ` @${params.handle}` : ''}.`,
    preferences: { showInDiscover: true },
  };
  if (params.iconBlob) rec.icon = params.iconBlob;
  return rec;
}

// ─── Document helpers ───────────────────────────────────────────────────────

/** Strip markdown formatting to plain text for the document textContent. */
export function stripMarkdown(md: string): string {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, '')   // code blocks
    .replace(/`[^`]*`/g, '')          // inline code
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // image alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // link text
    .replace(/^#{1,6}\s+/gm, '')       // headings
    .replace(/[*_~]/g, '')            // bold/italic/strikethrough
    .replace(/^>\s+/gm, '')            // blockquotes
    .replace(/^[-*+]\s+/gm, '')        // list markers
    .replace(/^\d+\.\s+/gm, '')        // numbered lists
    .replace(/\n{3,}/g, '\n\n')        // collapse extra newlines
    .trim();
}

/** Build a site.standard.document record from entity data. */
export function buildDocumentRecord(params: {
  site: string;           // at:// URI of the publication
  title: string;
  path: string;            // URL path on swappulse.org
  description?: string;
  coverImageBlob?: any;    // PDS blob ref
  tags?: string[];
  textContent: string;     // plain text content
  publishedAt?: string;
  bskyPostRef?: string;    // at:// URI of companion Bluesky post
  links?: Array<{ title: string; uri: string }>;
}): any {
  const rec: any = {
    $type: 'site.standard.document',
    site: params.site,
    title: params.title,
    path: params.path,
    publishedAt: params.publishedAt || new Date().toISOString(),
    content: [{
      $type: 'site.standard.content.text',
      text: { text: (params.textContent || '').slice(0, 100000) },
    }],
  };
  if (params.description) rec.description = params.description.slice(0, 300);
  if (params.coverImageBlob) rec.coverImage = params.coverImageBlob;
  if (params.tags?.length) rec.tags = params.tags.slice(0, 10);
  if (params.bskyPostRef) rec.bskyPostRef = params.bskyPostRef;
  if (params.links?.length) rec.links = params.links;
  return rec;
}

// ─── Blob upload ────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_HOSTS = new Set([
  'assets.tcgdex.net',
  'media.base44static.com',
  'static.wixstatic.com',
  'media.base44.com',
]);

/** Fetch a remote image and upload it to the PDS as a blob. Returns the blob
 *  ref object or null on failure. SSRF-protected like atproto-bridge. */
export async function uploadImageBlob(
  pdsUrl: string,
  accessJwt: string,
  imageUrl: string,
): Promise<any | null> {
  try {
    let parsedUrl: URL;
    try { parsedUrl = new URL(imageUrl); } catch { return null; }
    if (parsedUrl.protocol !== 'https:') return null;
    if (!ALLOWED_IMAGE_HOSTS.has(parsedUrl.hostname.toLowerCase())) return null;

    const imgRes = await fetch(imageUrl, { redirect: 'manual' });
    if (imgRes.status >= 300 && imgRes.status < 400) return null;
    if (!imgRes.ok) return null;

    const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
    const bytes = new Uint8Array(await imgRes.arrayBuffer());

    const uploadRes = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`, {
      method: 'POST',
      headers: { 'Content-Type': mimeType, 'Authorization': `Bearer ${accessJwt}` },
      body: bytes,
    });
    if (!uploadRes.ok) return null;
    const data = await uploadRes.json();
    return data.blob || null;
  } catch (e) {
    console.error('standardSite: uploadImageBlob failed', e?.message || e);
    return null;
  }
}

// ─── Session resolution ─────────────────────────────────────────────────────

/** Resolve the PDS session for the calling user. Uses per-user session if the
 *  user has a did:plc + PdsCredential, otherwise falls back to the shared
 *  bridge account. Mirrors atproto-bridge's resolveSession. */
export async function resolvePdsSession(base44: any): Promise<{ pdsUrl: string; session: any }> {
  const pdsUrl = Deno.env.get('PDS_URL');
  if (!pdsUrl) throw new Error('PDS_URL not configured');

  try {
    const user = await base44.auth.me();
    if (user?.did?.startsWith('did:plc:')) {
      const creds = await base44.asServiceRole.entities.PdsCredential
        .filter({ user_id: user.id }).catch(() => []);
      if (creds?.length > 0 && creds[0].app_password) {
        try {
          return await getPdsSessionForUser(pdsUrl, user.did, creds[0].app_password);
        } catch (e) {
          console.error('standardSite: per-user session failed, falling back to shared', e?.message || e);
        }
      }
    }
  } catch { /* no auth context */ }

  return getPdsSession();
}

// ─── SwapPulse publication management ──────────────────────────────────────

/** Get or create the SwapPulse site.standard.publication record. Returns the
 *  at:// URI. Idempotent: if a StandardSiteConfig row exists, returns its URI;
 *  otherwise creates the publication on the shared bridge PDS and stores it. */
export async function ensureSitePublication(base44: any): Promise<{ uri: string; did: string }> {
  const svc = base44.asServiceRole;
  const existing = await svc.entities.StandardSiteConfig.list('-created_date', 1).catch(() => []);
  if (existing?.length > 0 && existing[0].publication_uri) {
    return { uri: existing[0].publication_uri, did: existing[0].publication_did || '' };
  }

  const { pdsUrl, session } = await getPdsSession();
  const record = buildSitePublicationRecord();
  let result: any = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.createRecord', {
    repo: session.did, collection: 'site.standard.publication', record,
  });
  if (result?.error && result.status === 401) {
    clearPdsSession();
    const fresh = await getPdsSession();
    result = await pdsRequest(fresh.pdsUrl, fresh.session.accessJwt, 'com.atproto.repo.createRecord', {
      repo: fresh.session.did, collection: 'site.standard.publication', record,
    });
  }
  if (result?.error) {
    throw new Error(`Failed to create SwapPulse publication (${result.status})`);
  }

  await svc.entities.StandardSiteConfig.create({
    publication_uri: result.uri,
    publication_did: session.did,
    published_at: new Date().toISOString(),
  }).catch((e: any) => console.error('standardSite: failed to store StandardSiteConfig', e?.message || e));

  return { uri: result.uri, did: session.did };
}

// ─── Per-author publication management ──────────────────────────────────────

/** Get or create a collector's per-author site.standard.publication record.
 *  Returns the at:// URI. Created lazily on first long-form publish. */
export async function ensureAuthorPublication(base44: any, params: {
  did: string;
  name: string;
  handle: string;
  avatar: string;
  profileUrl: string;
}): Promise<string> {
  const svc = base44.asServiceRole;
  const existing = await svc.entities.StandardPublication
    .filter({ did: params.did }, '-created_date', 1).catch(() => []);
  if (existing?.length > 0 && existing[0].publication_uri) {
    return existing[0].publication_uri;
  }

  const { pdsUrl, session } = await resolvePdsSession(base44);
  const record = buildAuthorPublicationRecord({
    name: params.name, handle: params.handle,
    avatar: params.avatar, profileUrl: params.profileUrl,
  });
  let result: any = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.createRecord', {
    repo: session.did, collection: 'site.standard.publication', record,
  });
  if (result?.error && result.status === 401) {
    clearPdsSession();
    const fresh = await resolvePdsSession(base44);
    result = await pdsRequest(fresh.pdsUrl, fresh.session.accessJwt, 'com.atproto.repo.createRecord', {
      repo: fresh.session.did, collection: 'site.standard.publication', record,
    });
  }
  if (result?.error) {
    throw new Error(`Failed to create author publication (${result.status})`);
  }

  await svc.entities.StandardPublication.create({
    did: params.did,
    publication_uri: result.uri,
    name: params.name,
    handle: params.handle,
    avatar: params.avatar,
    profile_url: params.profileUrl,
  }).catch((e: any) => console.error('standardSite: failed to store StandardPublication', e?.message || e));

  return result.uri;
}

// ─── Document publishing ────────────────────────────────────────────────────

/** Publish a site.standard.document record on the author's PDS. Returns the
 *  at:// URI of the created document, or null on failure. */
export async function publishDocument(base44: any, params: {
  siteUri: string;         // SwapPulse publication at:// URI
  authorPubUri: string;    // per-author publication at:// URI
  title: string;
  path: string;
  description?: string;
  coverImageUrl?: string;  // remote URL to fetch and upload as blob
  tags?: string[];
  textContent: string;
  publishedAt?: string;
  bskyPostRef?: string;
  links?: Array<{ title: string; uri: string }>;
}): Promise<string | null> {
  const { pdsUrl, session } = await resolvePdsSession(base44);

  // Upload cover image as a blob if a URL is provided
  let coverBlob: any = null;
  if (params.coverImageUrl) {
    coverBlob = await uploadImageBlob(pdsUrl, session.accessJwt, params.coverImageUrl);
  }

  const record = buildDocumentRecord({
    site: params.authorPubUri,  // document belongs to the author's publication
    title: params.title,
    path: params.path,
    description: params.description,
    coverImageBlob: coverBlob,
    tags: params.tags,
    textContent: params.textContent,
    publishedAt: params.publishedAt,
    bskyPostRef: params.bskyPostRef,
    links: params.links,
  });

  let result: any = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.createRecord', {
    repo: session.did, collection: 'site.standard.document', record,
  });
  if (result?.error && result.status === 401) {
    clearPdsSession();
    const fresh = await resolvePdsSession(base44);
    result = await pdsRequest(fresh.pdsUrl, fresh.session.accessJwt, 'com.atproto.repo.createRecord', {
      repo: fresh.session.did, collection: 'site.standard.document', record,
    });
  }
  if (result?.error) {
    console.error('standardSite: publishDocument failed', result.status, result.body);
    return null;
  }
  return result.uri || null;
}

/** Delete a site.standard.document record from the PDS. */
export async function deleteDocument(base44: any, documentUri: string): Promise<boolean> {
  try {
    const segs = documentUri.replace(/^at:\/\//, '').split('/');
    const collection = segs[1];
    const rkey = segs[2];
    if (!rkey || collection !== 'site.standard.document') return false;

    const { pdsUrl, session } = await resolvePdsSession(base44);
    let result: any = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.deleteRecord', {
      repo: session.did, collection, rkey,
    });
    if (result?.error && result.status === 401) {
      clearPdsSession();
      const fresh = await resolvePdsSession(base44);
      result = await pdsRequest(fresh.pdsUrl, fresh.session.accessJwt, 'com.atproto.repo.deleteRecord', {
        repo: fresh.session.did, collection, rkey,
      });
    }
    return !result?.error || result.status === 404;
  } catch (e) {
    console.error('standardSite: deleteDocument failed', e?.message || e);
    return false;
  }
}

// ─── Recommend / Subscribe record helpers ──────────────────────────────────

/** Create a site.standard.graph.recommend record on the user's PDS. */
export async function createRecommendRecord(base44: any, documentUri: string): Promise<string | null> {
  const { pdsUrl, session } = await resolvePdsSession(base44);
  const record = {
    $type: 'site.standard.graph.recommend',
    document: documentUri,
    createdAt: new Date().toISOString(),
  };
  let result: any = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.createRecord', {
    repo: session.did, collection: 'site.standard.graph.recommend', record,
  });
  if (result?.error && result.status === 401) {
    clearPdsSession();
    const fresh = await resolvePdsSession(base44);
    result = await pdsRequest(fresh.pdsUrl, fresh.session.accessJwt, 'com.atproto.repo.createRecord', {
      repo: fresh.session.did, collection: 'site.standard.graph.recommend', record,
    });
  }
  if (result?.error) { console.error('standardSite: createRecommendRecord failed', result.status); return null; }
  return result.uri || null;
}

/** Delete a site.standard.graph.recommend record from the user's PDS by
 *  matching the document URI. Returns true if deleted. */
export async function deleteRecommendRecord(base44: any, documentUri: string): Promise<boolean> {
  try {
    const { pdsUrl, session } = await resolvePdsSession(base44);
    // List recommend records to find the one matching this document
    const listUrl = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
    listUrl.searchParams.set('repo', session.did);
    listUrl.searchParams.set('collection', 'site.standard.graph.recommend');
    listUrl.searchParams.set('limit', '100');
    const res = await fetch(listUrl);
    if (!res.ok) return false;
    const data = await res.json();
    const match = (data.records || []).find((r: any) => r.value?.document === documentUri);
    if (!match) return false;
    const rkey = match.uri.split('/').pop();
    let result: any = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.deleteRecord', {
      repo: session.did, collection: 'site.standard.graph.recommend', rkey,
    });
    if (result?.error && result.status === 401) {
      clearPdsSession();
      const fresh = await resolvePdsSession(base44);
      result = await pdsRequest(fresh.pdsUrl, fresh.session.accessJwt, 'com.atproto.repo.deleteRecord', {
        repo: fresh.session.did, collection: 'site.standard.graph.recommend', rkey,
      });
    }
    return !result?.error || result.status === 404;
  } catch (e) {
    console.error('standardSite: deleteRecommendRecord failed', e?.message || e);
    return false;
  }
}

/** Create a site.standard.graph.subscription record on the user's PDS. */
export async function createSubscriptionRecord(base44: any, publicationUri: string): Promise<string | null> {
  const { pdsUrl, session } = await resolvePdsSession(base44);
  const record = {
    $type: 'site.standard.graph.subscription',
    publication: publicationUri,
    createdAt: new Date().toISOString(),
  };
  let result: any = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.createRecord', {
    repo: session.did, collection: 'site.standard.graph.subscription', record,
  });
  if (result?.error && result.status === 401) {
    clearPdsSession();
    const fresh = await resolvePdsSession(base44);
    result = await pdsRequest(fresh.pdsUrl, fresh.session.accessJwt, 'com.atproto.repo.createRecord', {
      repo: fresh.session.did, collection: 'site.standard.graph.subscription', record,
    });
  }
  if (result?.error) { console.error('standardSite: createSubscriptionRecord failed', result.status); return null; }
  return result.uri || null;
}

/** Delete a site.standard.graph.subscription record from the user's PDS by
 *  matching the publication URI. */
export async function deleteSubscriptionRecord(base44: any, publicationUri: string): Promise<boolean> {
  try {
    const { pdsUrl, session } = await resolvePdsSession(base44);
    const listUrl = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
    listUrl.searchParams.set('repo', session.did);
    listUrl.searchParams.set('collection', 'site.standard.graph.subscription');
    listUrl.searchParams.set('limit', '100');
    const res = await fetch(listUrl);
    if (!res.ok) return false;
    const data = await res.json();
    const match = (data.records || []).find((r: any) => r.value?.publication === publicationUri);
    if (!match) return false;
    const rkey = match.uri.split('/').pop();
    let result: any = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.repo.deleteRecord', {
      repo: session.did, collection: 'site.standard.graph.subscription', rkey,
    });
    if (result?.error && result.status === 401) {
      clearPdsSession();
      const fresh = await resolvePdsSession(base44);
      result = await pdsRequest(fresh.pdsUrl, fresh.session.accessJwt, 'com.atproto.repo.deleteRecord', {
        repo: fresh.session.did, collection: 'site.standard.graph.subscription', rkey,
      });
    }
    return !result?.error || result.status === 404;
  } catch (e) {
    console.error('standardSite: deleteSubscriptionRecord failed', e?.message || e);
    return false;
  }
}