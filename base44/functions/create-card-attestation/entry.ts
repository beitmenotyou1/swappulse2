// create-card-attestation — creates a CardVerificationSession for a collector
// proving physical ownership of a Pokémon TCG card, runs an AI vision
// comparison of the uploaded scan photos against the TCGDex reference image,
// and records the achieved verification level.
//
// NOTE: this is an OFF-CHAIN attestation. It is scoped to the caller's account
// and stores their DID for reference, but nothing here is signed by, or bound
// to, their chain identity — no key, signature or chain call is involved. Any
// UI that claims the on-chain identity signs an attestation is wrong. Binding
// these sessions to the smart account is still outstanding work.
//
// Verification levels:
//   0 = self-attested (scan failed AI check)
//   1 = scanned (partial match, below confidence threshold)
//   2 = AI-verified scan (matched, high confidence, not a screen photo)
//   3 = graded cert (reserved for future grading-company verification)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { syncPossessionVerified } from '../../shared/possessionVerification.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const collectionEntryId = String(body.collection_entry_id || '').trim();
    const cardId = String(body.card_id || '').trim();
    const cardName = String(body.card_name || '').trim();
    const scanImageUrls: string[] = Array.isArray(body.scan_image_urls)
      ? body.scan_image_urls.filter((u: unknown) => Boolean(u))
      : [];

    if (!collectionEntryId || !cardId) {
      return Response.json({ error: 'collection_entry_id and card_id are required' }, { status: 400 });
    }
    if (scanImageUrls.length === 0) {
      return Response.json({ error: 'At least one scan photo is required' }, { status: 400 });
    }
    if (scanImageUrls.length > 4) {
      return Response.json({ error: 'Maximum 4 scan photos' }, { status: 400 });
    }
    // Only accept well-formed HTTPS URLs as scan photos — these are stored on
    // the session and passed to the AI vision call.
    for (const raw of scanImageUrls) {
      let url: URL;
      try {
        url = new URL(String(raw));
      } catch {
        return Response.json({ error: 'Scan photo URLs must be valid URLs' }, { status: 400 });
      }
      if (url.protocol !== 'https:' || url.username || url.password || String(raw).length > 2000) {
        return Response.json({ error: 'Scan photo URLs must be plain HTTPS URLs' }, { status: 400 });
      }
    }

    const svc = base44.asServiceRole;

    // Rate limit: at most 10 AI-verified attestation attempts per user per hour
    // (each call runs a vision LLM comparison).
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentSessions = await svc.entities.CardVerificationSession
      .filter({ created_by_id: me.id, created_date: { $gte: hourAgo } }, '-created_date', 50)
      .catch(() => []);
    const recentAiAttempts = recentSessions.filter((s: any) => (s.scan_image_urls || []).length > 0);
    if (recentAiAttempts.length >= 10) {
      return Response.json({ error: 'Too many verification attempts. Please try again in an hour.', code: 'RATE_LIMITED' }, { status: 429 });
    }

    // Verify the collection entry belongs to the calling user.
    const entries = await svc.entities.CollectionEntry
      .filter({ id: collectionEntryId, created_by_id: me.id }, '-created_date', 1)
      .catch(() => []);
    if (!entries?.[0]) {
      return Response.json({ error: 'Collection entry not found' }, { status: 404 });
    }

    // Look up the TCGDex reference image for AI comparison.
    const cards = await svc.entities.TcgdexCard
      .filter({ card_id: cardId }, '-updated_date', 1)
      .catch(() => []);
    const refCard = cards?.[0];
    let refImage = String(refCard?.image || '');
    if (refImage && !refImage.startsWith('http')) {
      refImage = `https://assets.tcgdex.net/${refImage}`;
    }

    // Create the verification session (expires in 1 hour).
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const session = await svc.entities.CardVerificationSession.create({
      did: me.did || '',
      collection_entry_id: collectionEntryId,
      card_id: cardId,
      card_name: cardName,
      scan_image_urls: scanImageUrls,
      verification_level: 0,
      status: 'pending',
      expires_at: expiresAt,
    });

    // Run AI vision comparison of scan photos vs reference card image.
    let aiResult: any = null;
    let verificationLevel = 0;
    let aiStatus = 'failed';

    try {
      const fileUrls = [...scanImageUrls];
      if (refImage) fileUrls.push(refImage);

      const llmRes = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a Pokémon TCG card verification assistant. Compare the uploaded scan photo(s) of a physical Pokémon TCG card with the reference card image (if provided as the last image). The card is "${cardName}" (TCGDex ID: ${cardId}).

Assess:
1. Does the scan photo show the same card as the reference (same name, artwork, set)?
2. Is it a photo of a physical card, or a photo of a screen/digital image?
3. Are there visible signs of counterfeiting, digital manipulation, or printing anomalies?
4. What is your confidence level (0.0 to 1.0)?

Return your assessment as structured JSON.`,
        file_urls: fileUrls,
        response_json_schema: {
          type: 'object',
          properties: {
            matched: { type: 'boolean', description: 'True if the scan appears to show the same card' },
            confidence: { type: 'number', description: 'Confidence score 0.0 to 1.0' },
            is_screen_photo: { type: 'boolean', description: 'True if the scan appears to be a photo of a screen' },
            anomalies: { type: 'array', items: { type: 'string' }, description: 'Detected anomalies' },
            notes: { type: 'string', description: 'Additional notes' },
          },
        },
      });

      aiResult = llmRes;

      if (aiResult?.matched && aiResult?.confidence >= 0.7 && !aiResult?.is_screen_photo) {
        verificationLevel = 2;
        aiStatus = 'verified';
      } else if (aiResult?.matched && aiResult?.confidence >= 0.5) {
        verificationLevel = 1;
        aiStatus = 'verified';
      } else {
        verificationLevel = 0;
        aiStatus = 'failed';
      }
    } catch (e: any) {
      console.error('create-card-attestation: AI comparison failed', e?.message || e);
      aiResult = {
        matched: false, confidence: 0, is_screen_photo: false,
        anomalies: ['AI comparison unavailable'], notes: e?.message || 'AI vision call failed',
      };
      verificationLevel = 0;
      aiStatus = 'failed';
    }

    await svc.entities.CardVerificationSession.update(session.id, {
      ai_match_result: aiResult,
      verification_level: verificationLevel,
      status: aiStatus,
    });

    // A verified photo attestation also counts toward trade-listing badges.
    if (aiStatus === 'verified') {
      await syncPossessionVerified(svc, me.id, cardId).catch(() => 0);
    }

    const updatedRows = await svc.entities.CardVerificationSession
      .filter({ id: session.id }, '-created_date', 1)
      .catch(() => []);
    const updated = updatedRows?.[0] || { ...session, ai_match_result: aiResult, verification_level: verificationLevel, status: aiStatus };

    return Response.json({
      ok: true,
      session: {
        id: updated.id,
        card_id: updated.card_id,
        card_name: updated.card_name,
        verification_level: updated.verification_level,
        status: updated.status,
        ai_match_result: updated.ai_match_result,
        scan_image_urls: updated.scan_image_urls,
        created_date: updated.created_date || updated.created_at,
      },
      verification_level: verificationLevel,
      attested: verificationLevel >= 2,
    });
  } catch (error: any) {
    console.error('create-card-attestation error:', error?.message || error);
    return Response.json({ error: error?.message || 'Attestation failed' }, { status: 500 });
  }
}