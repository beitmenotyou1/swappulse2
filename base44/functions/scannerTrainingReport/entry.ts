import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const since = body?.since;

    // Service role to read all corrections across users
    let corrections = await base44.asServiceRole.entities.ScannerCorrection.list('-created_date', 1000);
    if (since) {
      corrections = corrections.filter(c => c.created_at && c.created_at >= since);
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

    // Use LLM to generate actionable insights
    let insights = '';
    try {
      const llmRes = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze these Pokémon TCG scanner correction metrics and provide 3-5 concise actionable bullet points for improving the card scanner model. Focus on patterns, confidence calibration, and specific cards needing more training data.

Metrics:
- Total corrections: ${total}
- Confirm correct (positive signal): ${confirmCount}
- Wrong predictions: ${wrongCount}
- Accuracy estimate: ${(accuracyEstimate * 100).toFixed(1)}%
- Correction breakdown: ${JSON.stringify(byType)}
- Top misidentified cards: ${JSON.stringify(topMisidentified)}
- Avg confidence when correct: ${confirmCount > 0 ? (confidenceCorrect / confirmCount).toFixed(2) : 'N/A'}
- Avg confidence when wrong: ${wrongCount > 0 ? (confidenceWrong / wrongCount).toFixed(2) : 'N/A'}

Provide only the bullet points, no preamble.`,
      });
      insights = typeof llmRes === 'string' ? llmRes : JSON.stringify(llmRes);
    } catch (e) {
      console.error('scannerTrainingReport LLM failed', e?.message || e);
      insights = 'Insight generation unavailable.';
    }

    return Response.json({
      total_corrections: total,
      by_type: byType,
      accuracy_estimate: accuracyEstimate,
      top_misidentified: topMisidentified,
      avg_confidence_correct: confirmCount > 0 ? confidenceCorrect / confirmCount : 0,
      avg_confidence_wrong: wrongCount > 0 ? confidenceWrong / wrongCount : 0,
      insights,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('scannerTrainingReport error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}