// backfill-phashes — admin-triggered pass to compute perceptual hashes (pHash)
// for existing TcgdexCard records that lack one. Processes a batch per call;
// admin re-triggers until `has_more` is false. Also picks up new cards that
// weren't hashed during sync (sync caps pHash computation per run).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { computePHashFromUrl, buildJpgUrl } from '../../shared/phash.ts';

const BATCH_SIZE = 50;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    // Find records without a pHash. { phash: null } matches null or missing.
    let toHash: any[] = [];
    try {
      toHash = await svc.entities.TcgdexCard.filter({ phash: null }, '-created_date', BATCH_SIZE);
    } catch (e: any) {
      console.error('[backfill-phashes] query failed, trying fallback', e?.message || e);
      // Fallback: load recent records and filter in code.
      const recent = await svc.entities.TcgdexCard.list('-created_date', BATCH_SIZE * 3).catch(() => []);
      toHash = (recent || []).filter((c: any) => !c.phash).slice(0, BATCH_SIZE);
    }

    if (!toHash || toHash.length === 0) {
      return Response.json({ ok: true, processed: 0, hashed: 0, failed: 0, has_more: false });
    }

    let hashed = 0;
    let failed = 0;
    let debug: any = null;
    for (const card of toHash) {
      const jpgUrl = buildJpgUrl(card.image);
      if (!jpgUrl) { failed++; continue; }
      const ph = await computePHashFromUrl(jpgUrl);
      if (ph) {
        try {
          await svc.entities.TcgdexCard.update(card.id, { phash: ph });
          hashed++;
        } catch (e: any) {
          console.error('[backfill-phashes] update failed', card.card_id, e?.message || e);
          failed++;
        }
      } else {
        failed++;
        if (!debug) {
          // Capture debug info for the first failure.
          try {
            const res = await fetch(jpgUrl, { redirect: 'error' });
            debug = {
              card_id: card.card_id,
              image: card.image,
              jpgUrl,
              fetchStatus: res.status,
              contentType: res.headers.get('content-type'),
              contentLength: res.headers.get('content-length'),
            };
          } catch (e: any) {
            debug = { card_id: card.card_id, jpgUrl, fetchError: e?.message || String(e) };
          }
        }
      }
    }

    return Response.json({
      ok: true,
      processed: toHash.length,
      hashed,
      failed,
      has_more: toHash.length === BATCH_SIZE,
      debug,
    });
  } catch (error: any) {
    console.error('[backfill-phashes] error', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}