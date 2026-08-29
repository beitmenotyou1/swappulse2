// pds-blob-upload — uploads user media to the AT Protocol PDS as a real blob
// (com.atproto.repo.uploadBlob) so images are portable and federated, not
// locked to an external storage URL.
//
// Uses the per-user PdsCredential session when available (writes the blob to
// the user's own repo); falls back to the shared bridge session for users
// without one. Returns { blobCid, blobUrl, mimeType, size } where blobUrl is a
// com.atproto.sync.getBlob URL that serves the bytes.
//
// Input: { mimeType, base64 } — the file bytes base64-encoded (frontend reads
// the File via FileReader.readAsDataURL and strips the data: prefix).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSession, getPdsSessionForUser } from '../../shared/pdsSession.ts';

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { mimeType, base64 } = body as any;
    if (!base64 || !mimeType) {
      return Response.json({ error: 'mimeType and base64 are required' }, { status: 400 });
    }

    const normalizedMime = String(mimeType || '').toLowerCase();
    if (!normalizedMime.startsWith('image/') || normalizedMime === 'image/svg+xml') {
      return Response.json({ error: 'Only standard image uploads are accepted' }, { status: 415 });
    }
    // 10 MB decoded payload, checked before atob to avoid unnecessary memory use.
    const maxDecodedBytes = 10 * 1024 * 1024;
    const estimatedDecodedBytes = Math.floor(String(base64).length * 3 / 4);
    if (estimatedDecodedBytes > maxDecodedBytes) {
      return Response.json({ error: 'Image is too large. Maximum size is 10 MB.' }, { status: 413 });
    }

    // Resolve session: per-user credential if the user has a real did:plc,
    // otherwise the shared bridge account.
    let session: { accessJwt: string; did: string };
    let targetPdsUrl = '';
    try {
      const { getUserIdentity } = await import('../../shared/userIdentity.ts');
      const identity = user.did?.startsWith('did:plc:')
        ? await getUserIdentity(base44.asServiceRole, user) : null;
      if (identity) {
        const s = await getPdsSessionForUser(identity.pdsUrl, identity.did, identity.appPassword);
        targetPdsUrl = s.pdsUrl;
        session = { accessJwt: s.session.accessJwt, did: s.session.did };
      } else {
        const s = await getPdsSession();
        targetPdsUrl = s.pdsUrl;
        session = { accessJwt: s.session.accessJwt, did: s.session.did };
      }
    } catch (e: any) {
      console.error('pds-blob-upload: session resolve failed', e?.message || e);
      return Response.json({ error: `PDS session failed: ${e?.message || e}` }, { status: 502 });
    }

    const bytes = decodeBase64(base64);

    const res = await fetch(`${targetPdsUrl}/xrpc/com.atproto.repo.uploadBlob`, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'Content-Type': normalizedMime,
        'Authorization': `Bearer ${session.accessJwt}`,
      },
      body: bytes,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('pds-blob-upload: uploadBlob failed', res.status, text.slice(0, 300));
      return Response.json({ error: `uploadBlob failed (${res.status})` }, { status: 502 });
    }

    const data = await res.json();
    const blob = data.blob || {};
    const blobCid = blob.ref?.$link || blob.cid || '';
    if (!blobCid) {
      console.error('pds-blob-upload: no blob cid in response', JSON.stringify(data).slice(0, 300));
      return Response.json({ error: 'PDS returned no blob cid' }, { status: 502 });
    }

    const blobUrl = `${targetPdsUrl}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(session.did)}&cid=${encodeURIComponent(blobCid)}`;

    return Response.json({
      blobCid,
      blobUrl,
      mimeType: blob.mimeType || normalizedMime,
      size: blob.size ?? bytes.length,
    });
  } catch (error) {
    console.error('pds-blob-upload error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}