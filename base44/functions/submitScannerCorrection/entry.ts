import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (!body.corrected_card_id) {
      return Response.json({ error: 'corrected_card_id required' }, { status: 400 });
    }

    // Auto-detect correction type if not provided
    let correctionType = body.correction_type;
    if (!correctionType) {
      if (!body.predicted_card_id) {
        correctionType = 'no_match_found';
      } else if (body.predicted_set_id && body.corrected_set_id && body.predicted_set_id !== body.corrected_set_id) {
        correctionType = 'wrong_set';
      } else if (body.predicted_card_id !== body.corrected_card_id) {
        correctionType = 'wrong_card';
      } else {
        correctionType = 'confirm_correct';
      }
    }

    const record = await base44.entities.ScannerCorrection.create({
      image_hash: body.image_hash || '',
      image_url: body.image_url || '',
      predicted_card_id: body.predicted_card_id || '',
      predicted_set_id: body.predicted_set_id || '',
      predicted_card_name: body.predicted_card_name || '',
      corrected_card_id: body.corrected_card_id,
      corrected_set_id: body.corrected_set_id || '',
      corrected_card_name: body.corrected_card_name || '',
      confidence: body.confidence || 0,
      correction_type: correctionType,
      scanner_version: body.scanner_version || '',
      notes: body.notes || '',
      created_at: new Date().toISOString(),
      corrected_by: user.id,
    });

    return Response.json({
      status: 'accepted',
      correction_id: record.id,
      correction_type: correctionType,
      message: 'Correction recorded. Thank you for helping improve the scanner!',
    });
  } catch (error) {
    console.error('submitScannerCorrection error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}