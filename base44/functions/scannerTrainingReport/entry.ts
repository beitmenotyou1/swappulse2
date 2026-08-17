// scannerTrainingReport — upgraded for the ML learning loop.
//
// Adds: active model version, accuracy broken down by rarity (resolved via
// the local TcgdexCard cache), corrections accumulated since the last
// training snapshot, and a candidate new model-version tag when a retraining
// threshold is met. Admin-only (unchanged).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { MODEL_VERSION } from '../../shared/scannerLearning.ts';

const RETRAIN_THRESHOLD = 50; // new accepted corrections needed to suggest a new model version

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const since = body?.since;

    let corrections = await svc.entities.ScannerCorrection.list('-created_date', 10000);
    if (since) {
      corrections = corrections.filter((c: any) => c.created_at && c.created_at >= since);
    }

    const total = corrections.length;
    const byType: Record<string, number> = {};
    const misidentifiedCards: Record<string, number> = {};
    let totalConfidence = 0;
    let confidenceCorrect = 0;
    let confidenceWrong = 0;
    let confirmCount = 0;
    let wrongCount = 0;

    for (const c of corrections) {
      byType[c.correction_type] = (byType[c.correction_type] || 0) + 1;
      if (c.correction_type === 'confirm_correct') {
        confirmCount++;
        if (c.confidence != null) confidenceCorrect += c.confidence;
      } else {
        wrongCount++;
        if (c.confidence != null) confidenceWrong += c.confidence;
        if (c.predicted_card_id) {
          misidentifiedCards[c.predicted_card_id] = (misidentifiedCards[c.predicted_card_id] || 0) + 1;
        }
      }
      if (c.confidence != null) totalConfidence += c.confidence;
    }

    const accuracyEstimate = total > 0 ? confirmCount / total : 0;
    const topMisidentified = Object.entries(misidentifiedCards)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([card_id, count]) => ({ card_id, count }));

    // Rarity breakdown: resolve corrected cards' rarities from the local cache.
    const correctedIds = [...new Set(corrections.map((c: any) => c.corrected_card_id).filter(Boolean))];
    const cards = correctedIds.length
      ? await svc.entities.TcgdexCard.filter({ card_id: { $in: correctedIds } }, '-created_date', 500).catch(() => [])
      : [];
    const rarityByCard = new Map(cards.map((c: any) => [c.card_id, c.rarity || 'Unknown']));
    const rarityBreakdown: Record<string, { correct: number; wrong: number }> = {};
    for (const c of corrections) {
      const r = rarityByCard.get(c.corrected_card_id) || 'Unknown';
      if (!rarityBreakdown[r]) rarityBreakdown[r] = { correct: 0, wrong: 0 };
      if (c.correction_type === 'confirm_correct') rarityBreakdown[r].correct++;
      else rarityBreakdown[r].wrong++;
    }

    // Corrections since the last training snapshot + new-version candidate.
    let correctionsSinceSnapshot = total;
    let lastSnapshotAt: string | null = null;
    let lastSnapshotVersion: string | null = null;
    try {
      const snapshots = await svc.entities.ScannerTrainingSnapshot.list('-generated_at', 1);
      const last = snapshots[0];
      if (last) {
        lastSnapshotAt = last.generated_at;
        lastSnapshotVersion = last.version_tag;
        correctionsSinceSnapshot = corrections.filter((c: any) => !lastSnapshotAt || (c.created_at || '') > lastSnapshotAt).length;
      }
    } catch (e: any) {
      console.error('[scannerTrainingReport] snapshot lookup failed', e?.message || e);
    }
    const newVersionCandidate = correctionsSinceSnapshot >= RETRAIN_THRESHOLD;

    // Catalog sync status.
    let catalogLastSynced: string | null = null;
    let catalogLang = 'en';
    let catalogSetsSynced = 0;
    try {
      const state = (await svc.entities.TcgdexSyncState.list('-created_date', 1))[0];
      if (state) {
        catalogLastSynced = state.last_synced_at;
        catalogLang = state.current_lang;
        catalogSetsSynced = state.sets_synced || 0;
      }
    } catch (e: any) {
      console.error('[scannerTrainingReport] sync state lookup failed', e?.message || e);
    }

    // LLM insights (unchanged).
    let insights = '';
    try {
      const llmRes: any = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze these Pokémon TCG scanner correction metrics and provide 3-5 concise actionable bullet points for improving the card scanner model. Focus on patterns, confidence calibration, rarity gaps, and specific cards needing more training data.

Metrics:
- Active model version: ${MODEL_VERSION}
- Total corrections: ${total}
- Confirm correct (positive signal): ${confirmCount}
- Wrong predictions: ${wrongCount}
- Accuracy estimate: ${(accuracyEstimate * 100).toFixed(1)}%
- Correction breakdown: ${JSON.stringify(byType)}
- Accuracy by rarity: ${JSON.stringify(rarityBreakdown)}
- Top misidentified cards: ${JSON.stringify(topMisidentified)}
- Corrections since last training snapshot: ${correctionsSinceSnapshot}
- Avg confidence when correct: ${confirmCount > 0 ? (confidenceCorrect / confirmCount).toFixed(2) : 'N/A'}
- Avg confidence when wrong: ${wrongCount > 0 ? (confidenceWrong / wrongCount).toFixed(2) : 'N/A'}

Provide only the bullet points, no preamble.`,
      });
      insights = typeof llmRes === 'string' ? llmRes : JSON.stringify(llmRes);
    } catch (e: any) {
      console.error('scannerTrainingReport LLM failed', e?.message || e);
      insights = 'Insight generation unavailable.';
    }

    return Response.json({
      model_version: MODEL_VERSION,
      total_corrections: total,
      by_type: byType,
      accuracy_estimate: accuracyEstimate,
      rarity_breakdown: rarityBreakdown,
      top_misidentified: topMisidentified,
      avg_confidence_correct: confirmCount > 0 ? confidenceCorrect / confirmCount : 0,
      avg_confidence_wrong: wrongCount > 0 ? confidenceWrong / wrongCount : 0,
      corrections_since_snapshot: correctionsSinceSnapshot,
      last_snapshot_at: lastSnapshotAt,
      last_snapshot_version: lastSnapshotVersion,
      new_version_candidate: newVersionCandidate,
      catalog_last_synced: catalogLastSynced,
      catalog_lang: catalogLang,
      catalog_sets_synced: catalogSetsSynced,
      insights,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('scannerTrainingReport error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}