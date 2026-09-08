import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { MODEL_VERSION } from '../../shared/scannerLearning.ts';

const CONDITIONS = new Set(['mint', 'near_mint', 'excellent', 'good', 'damaged']);
const VARIANTS = new Set(['normal', 'holo', 'reverse_holo']);

function jsonError(message: string, status: number, code: string) {
  return Response.json({ error: message, code }, { status });
}

function clean(value: unknown, max = 160): string {
  return String(value || '').trim().slice(0, max);
}

function intInRange(value: unknown, min: number, max: number): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max
    ? number
    : null;
}

async function catalogueCard(svc: any, cardId: string) {
  const cached = await svc.entities.TcgdexCard
    .filter({ card_id: cardId }, '-updated_date', 1)
    .catch(() => []);
  if (cached?.[0]) {
    return {
      id: clean(cached[0].card_id, 100),
      set_id: clean(cached[0].set_id, 80),
    };
  }

  const response = await svc.functions.invoke('tcgdex', {
    action: 'getCard',
    cardId,
    lang: 'en',
  }).catch(() => null);
  const outer = response?.data ?? response ?? {};
  const card = outer?.data ?? outer?.card ?? null;
  if (!card || clean(card.id || card.cardId, 100) !== cardId) return null;
  return {
    id: cardId,
    set_id: clean(card?.set?.id || card?.set_id, 80),
  };
}

export default async function (req: Request): Promise<Response> {
  let session: any = null;
  let base44: any = null;

  try {
    if (req.method !== 'POST') {
      return jsonError('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
    }

    base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) {
      return jsonError('Sign in to add scanned cards', 401, 'UNAUTHORISED');
    }
    const userDid = clean(me.did, 200);
    if (!userDid) {
      return jsonError(
        'Initialise your collector identity before confirming',
        409,
        'IDENTITY_REQUIRED',
      );
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = clean(body.session_id, 120);
    const rawSelections = Array.isArray(body.selections) ? body.selections : [];
    const rawSkipped = Array.isArray(body.skipped_indexes) ? body.skipped_indexes : [];

    if (!sessionId) {
      return jsonError('A scan session is required', 400, 'SESSION_REQUIRED');
    }

    const svc = base44.asServiceRole;
    const sessions = await svc.entities.CardScanSession
      .filter({ id: sessionId, user_id: me.id }, '-created_date', 1)
      .catch(() => []);
    session = sessions?.[0];

    if (!session) {
      return jsonError('Scan session not found', 404, 'SESSION_NOT_FOUND');
    }
    if (clean(session.did, 200) !== userDid) {
      return jsonError(
        'Scan session identity does not match this account',
        403,
        'SESSION_IDENTITY_MISMATCH',
      );
    }
    if (session.status === 'completed') {
      return Response.json({
        ok: true,
        already_completed: true,
        added_count: Number(session.added_count || 0),
      });
    }
    if (session.status !== 'review') {
      return jsonError(
        'This scan session is not ready for confirmation',
        409,
        'SESSION_NOT_READY',
      );
    }
    if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
      return jsonError('This scan session has expired', 409, 'SESSION_EXPIRED');
    }

    const results = Array.isArray(session.results) ? session.results : [];
    const imageCount = Number(session.image_count || 0);
    if (imageCount < 1 || imageCount > 10 || results.length !== imageCount) {
      return jsonError('Scan results are incomplete', 409, 'INCOMPLETE_SCAN_RESULTS');
    }

    const skipped = new Set<number>();
    for (const rawIndex of rawSkipped) {
      const index = intInRange(rawIndex, 0, imageCount - 1);
      if (index === null || skipped.has(index)) {
        return jsonError('Invalid skipped image list', 400, 'INVALID_SKIPPED_IMAGES');
      }
      skipped.add(index);
    }

    const selections = [];
    const selectedIndexes = new Set<number>();
    const allEntryIds: string[] = [];
    let totalQuantity = 0;

    for (const raw of rawSelections) {
      const imageIndex = intInRange(raw?.image_index, 0, imageCount - 1);
      const selectedCardId = clean(raw?.selected_card_id, 100);
      const condition = clean(raw?.condition, 30);
      const variant = clean(raw?.variant, 30);
      const quantity = intInRange(raw?.quantity, 1, 20);
      const entryIds = Array.isArray(raw?.collection_entry_ids)
        ? raw.collection_entry_ids.map((value: unknown) => clean(value, 120)).filter(Boolean)
        : [];

      if (
        imageIndex === null ||
        selectedIndexes.has(imageIndex) ||
        skipped.has(imageIndex) ||
        !selectedCardId ||
        !CONDITIONS.has(condition) ||
        !VARIANTS.has(variant) ||
        quantity === null ||
        entryIds.length !== quantity ||
        new Set(entryIds).size !== entryIds.length
      ) {
        return jsonError('Invalid confirmed card selection', 400, 'INVALID_SELECTION');
      }

      selectedIndexes.add(imageIndex);
      totalQuantity += quantity;
      allEntryIds.push(...entryIds);
      selections.push({
        image_index: imageIndex,
        selected_card_id: selectedCardId,
        condition,
        variant,
        quantity,
        collection_entry_ids: entryIds,
      });
    }

    if (selectedIndexes.size + skipped.size !== imageCount) {
      return jsonError(
        'Review every image before confirming the batch',
        400,
        'BATCH_REVIEW_INCOMPLETE',
      );
    }
    if (selections.length === 0 || totalQuantity > 100) {
      return jsonError(
        'Select at least one card and no more than 100 copies',
        400,
        'INVALID_BATCH_SIZE',
      );
    }
    if (new Set(allEntryIds).size !== allEntryIds.length) {
      return jsonError('Collection entry IDs must be unique', 400, 'DUPLICATE_ENTRY_ID');
    }

    await svc.entities.CardScanSession.update(session.id, { status: 'adding' });

    const catalogue = new Map<string, any>();
    for (const selection of selections) {
      if (!catalogue.has(selection.selected_card_id)) {
        const card = await catalogueCard(svc, selection.selected_card_id);
        if (!card) {
          throw new Error('CATALOGUE_CARD_NOT_FOUND');
        }
        catalogue.set(selection.selected_card_id, card);
      }
    }

    const entries = await svc.entities.CollectionEntry
      .filter(
        {
          id: { $in: allEntryIds },
          created_by_id: me.id,
        },
        '-created_date',
        Math.min(100, allEntryIds.length),
      )
      .catch(() => []);
    const entriesById = new Map(
      (entries || []).map((entry: any) => [String(entry.id), entry]),
    );

    for (const selection of selections) {
      for (const entryId of selection.collection_entry_ids) {
        const entry: any = entriesById.get(entryId);
        if (
          !entry ||
          clean(entry.card_id, 100) !== selection.selected_card_id ||
          clean(entry.condition, 30) !== selection.condition ||
          clean(entry.variant, 30) !== selection.variant
        ) {
          throw new Error('COLLECTION_ENTRY_MISMATCH');
        }
      }
    }

    const existingCorrections = await svc.entities.ScannerCorrection
      .filter(
        { scan_session_id: session.id, user_id: me.id },
        '-created_date',
        20,
      )
      .catch(() => []);
    const existingIndexes = new Set(
      (existingCorrections || []).map((row: any) => Number(row.image_index)),
    );

    for (const selection of selections) {
      if (existingIndexes.has(selection.image_index)) continue;

      const result = results.find(
        (row: any) => Number(row.image_index) === selection.image_index,
      ) || {};
      const predicted = clean(result?.candidates?.[0]?.card_id, 100);
      const predictedSet = clean(result?.candidates?.[0]?.set_id, 80);
      const selectedSet = clean(catalogue.get(selection.selected_card_id)?.set_id, 80);

      let correctionType = 'confirm_correct';
      if (!predicted) correctionType = 'no_match';
      else if (predicted !== selection.selected_card_id) {
        correctionType =
          predictedSet && selectedSet && predictedSet !== selectedSet
            ? 'wrong_set'
            : 'wrong_card';
      }

      await svc.entities.ScannerCorrection.create({
        user_id: String(me.id),
        did: userDid,
        scan_session_id: String(session.id),
        image_index: selection.image_index,
        predicted_card_id: predicted,
        selected_card_id: selection.selected_card_id,
        collection_entry_id: selection.collection_entry_ids[0],
        correction_type: correctionType,
        model_version: clean(session.model_version || MODEL_VERSION, 80),
        confidence: Math.max(0, Math.min(1, Number(result.confidence || 0))),
        detected_language: clean(result.detected_language, 30),
        selected_condition: selection.condition,
        selected_variant: selection.variant,
        review_status: 'quarantined',
        accepted: false,
      });
    }

    const completedAt = new Date().toISOString();
    await svc.entities.CardScanSession.update(session.id, {
      status: 'completed',
      confirmed_items: selections,
      skipped_indexes: Array.from(skipped).sort((a, b) => a - b),
      added_count: totalQuantity,
      completed_at: completedAt,
      error_code: '',
    });

    return Response.json({
      ok: true,
      added_count: totalQuantity,
      reviewed_images: imageCount,
      skipped_count: skipped.size,
      corrections_quarantined: selections.length,
      completed_at: completedAt,
    });
  } catch (error: any) {
    const code = clean(error?.message || 'SCAN_CONFIRMATION_FAILED', 120)
      .toUpperCase()
      .replace(/[^A-Z0-9_:-]/g, '_');
    console.error('complete-card-scan failed:', code);
    if (session?.id && base44) {
      await base44.asServiceRole.entities.CardScanSession
        .update(session.id, {
          status: 'review',
          error_code: code || 'SCAN_CONFIRMATION_FAILED',
        })
        .catch(() => null);
    }
    const clientError =
      code.includes('MISMATCH') ||
      code.includes('NOT_FOUND') ||
      code.includes('INVALID');
    return jsonError(
      clientError
        ? 'The confirmed collection records did not match this scan.'
        : 'The scan could not be finalised. Existing collection entries were not removed.',
      clientError ? 409 : 502,
      code || 'SCAN_CONFIRMATION_FAILED',
    );
  }
}
