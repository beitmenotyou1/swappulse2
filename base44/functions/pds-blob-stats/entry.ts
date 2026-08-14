// pds-blob-stats — counts how many user media assets are stored as PDS blobs
// (com.atproto.sync.getBlob URLs) vs external storage URLs, across the key
// media-bearing entities. Powers the "PDS Blob Storage" status row in the admin
// cutover panel. Admin-only.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const PDS_BLOB_MARKER = 'com.atproto.sync.getBlob';

function isUrl(v: any): boolean {
  return typeof v === 'string' && v.startsWith('http');
}
function classify(v: any, acc: { pds: number; external: number }) {
  if (!isUrl(v)) return;
  if (v.includes(PDS_BLOB_MARKER)) acc.pds++;
  else acc.external++;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    const svc = base44.asServiceRole;

    const acc = { pds: 0, external: 0 };

    // User avatars + headers
    try {
      const users = await svc.entities.User.list('-created_date', 200);
      for (const u of users) {
        classify((u as any).avatar, acc);
        classify((u as any).header, acc);
      }
    } catch (e) { console.error('pds-blob-stats: User scan failed', e?.message); }

    // Story segment media
    try {
      const stories = await svc.entities.Story.list('-created_date', 200);
      for (const s of stories) {
        const segs = (s as any).segments || [];
        for (const seg of segs) classify(seg?.media_blob, acc);
      }
    } catch (e) { console.error('pds-blob-stats: Story scan failed', e?.message); }

    // Binder covers
    try {
      const binders = await svc.entities.Binder.list('-created_date', 200);
      for (const b of binders) classify((b as any).cover_image_uri, acc);
    } catch (e) { console.error('pds-blob-stats: Binder scan failed', e?.message); }

    // Journal covers
    try {
      const journals = await svc.entities.Journal.list('-created_date', 200);
      for (const j of journals) classify((j as any).cover_image_uri, acc);
    } catch (e) { console.error('pds-blob-stats: Journal scan failed', e?.message); }

    return Response.json({
      pds: acc.pds,
      external: acc.external,
      total: acc.pds + acc.external,
    });
  } catch (error) {
    console.error('pds-blob-stats error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}