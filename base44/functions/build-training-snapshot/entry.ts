// build-training-snapshot — builds an immutable, versioned training-dataset
// export from accepted ScannerCorrection records and uploads it as a private
// file. Returns the snapshot record with a manifest (row count, rarity
// distribution). Admin-only (service-role writes + private file upload).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { MODEL_VERSION } from '../../shared/scannerLearning.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const notes = String(body.notes || '');

    // Fetch accepted corrections (newest first, bounded).
    const corrections = await svc.entities.ScannerCorrection.list('-created_date', 10000);

    // Build the JSONL dataset rows.
    const rows = corrections.map((c: any) => ({
      correction_id: c.id,
      image_hash: c.image_hash || '',
      image_url: c.image_url || '',
      predicted_card_id: c.predicted_card_id || '',
      predicted_card_name: c.predicted_card_name || '',
      predicted_set_id: c.predicted_set_id || '',
      corrected_card_id: c.corrected_card_id,
      corrected_card_name: c.corrected_card_name || '',
      corrected_set_id: c.corrected_set_id || '',
      correction_type: c.correction_type,
      confidence: c.confidence || 0,
      scanner_version: c.scanner_version || '',
      created_at: c.created_at || '',
    }));

    if (rows.length === 0) {
      return Response.json({ error: 'No corrections available to snapshot' }, { status: 400 });
    }

    const jsonl = rows.map((r) => JSON.stringify(r)).join('\n');
    const blob = new Blob([jsonl], { type: 'application/jsonl' });
    const file = new File([blob], `scanner-training-${Date.now()}.jsonl`, { type: 'application/jsonl' });

    let fileUri = '';
    try {
      const upload: any = await svc.integrations.Core.UploadPrivateFile({ file });
      fileUri = upload?.file_uri || '';
    } catch (e: any) {
      console.error('[build-training-snapshot] upload failed', e?.message || e);
      return Response.json({ error: `Upload failed: ${e?.message || e}` }, { status: 502 });
    }
    if (!fileUri) return Response.json({ error: 'Upload returned no file URI' }, { status: 502 });

    // Compute rarity distribution by resolving corrected cards in the local cache.
    const correctedIds = [...new Set(corrections.map((c: any) => c.corrected_card_id).filter(Boolean))];
    const cards = correctedIds.length
      ? await svc.entities.TcgdexCard.filter({ card_id: { $in: correctedIds } }, '-created_date', 500).catch(() => [])
      : [];
    const rarityByCard = new Map(cards.map((c: any) => [c.card_id, c.rarity || 'Unknown']));
    const rarityDist: Record<string, number> = {};
    const langDist: Record<string, number> = {};
    for (const c of corrections) {
      const r = rarityByCard.get(c.corrected_card_id) || 'Unknown';
      rarityDist[r] = (rarityDist[r] || 0) + 1;
    }

    const versionTag = `scan-${new Date().toISOString().slice(0, 10)}-v${Date.now().toString().slice(-4)}`;
    const snapshot = await svc.entities.ScannerTrainingSnapshot.create({
      version_tag: versionTag,
      generated_at: new Date().toISOString(),
      file_uri: fileUri,
      row_count: rows.length,
      correction_ids: corrections.map((c: any) => c.id),
      rarity_distribution: rarityDist,
      language_distribution: langDist,
      model_version: MODEL_VERSION,
      notes,
    });

    return Response.json({
      ok: true,
      snapshot_id: snapshot.id,
      version_tag: versionTag,
      row_count: rows.length,
      file_uri: fileUri,
      rarity_distribution: rarityDist,
    });
  } catch (error: any) {
    console.error('[build-training-snapshot] error', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}