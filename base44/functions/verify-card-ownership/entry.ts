import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Verifies physical ownership of a card before minting it as an on-chain NFT.
// Uses AI vision (InvokeLLM) to compare the collector's scan photos against the
// TCGDex reference image, and optionally verifies a grading certificate via web
// lookup. Returns a CardVerificationSession with the achieved verification level:
//   Level 1 — scan photos uploaded
//   Level 2 — AI vision match with confidence >= 0.8
//   Level 3 — grading cert verified via web lookup
// Sessions expire after 1 hour to prevent replay or sharing.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { collectionEntryId, scanImageUrls, gradingCompany, gradingCertNumber } = body;
    if (!collectionEntryId) return Response.json({ error: 'Missing collectionEntryId' }, { status: 400 });
    if (!scanImageUrls || !Array.isArray(scanImageUrls) || scanImageUrls.length === 0) {
      return Response.json({ error: 'At least one scan photo is required' }, { status: 400 });
    }

    const did = user.did;
    if (!did) return Response.json({ error: 'No AT Protocol DID found' }, { status: 400 });

    // Fetch the collection entry (user-scoped so RLS enforces ownership)
    const entries = await base44.entities.CollectionEntry.filter({ id: collectionEntryId });
    if (!entries.length) return Response.json({ error: 'Collection entry not found' }, { status: 404 });
    const entry = entries[0];

    const cardId = entry.card_id || '';
    const cardName = entry.card_name || '';
    const referenceImage = entry.card_image || '';
    if (!referenceImage) {
      return Response.json({ error: 'No reference image available for this card' }, { status: 400 });
    }

    // AI vision comparison: scan photos vs TCGDex reference image
    const allImages = [referenceImage, ...scanImageUrls];
    const aiResult = await runVisionCheck(base44, allImages, cardName);

    let verificationLevel = 1; // Level 1: scan uploaded
    if (aiResult.matched && aiResult.confidence >= 0.8) {
      verificationLevel = 2; // Level 2: AI-verified
    }

    // Optional grading cert verification (Level 3)
    let gradingVerified = false;
    if (gradingCompany && gradingCompany !== 'none' && gradingCertNumber) {
      gradingVerified = await verifyGradingCert(base44, gradingCompany, gradingCertNumber, cardName);
      if (gradingVerified) {
        verificationLevel = 3;
      }
    }

    const status = verificationLevel >= 2 ? 'verified' : (aiResult.matched ? 'verified' : 'failed');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    const session = await base44.entities.CardVerificationSession.create({
      did,
      collection_entry_id: collectionEntryId,
      card_id: cardId,
      card_name: cardName,
      scan_image_urls: scanImageUrls,
      ai_match_result: aiResult,
      grading_company: gradingCompany || 'none',
      grading_cert_number: gradingCertNumber || '',
      grading_verified: gradingVerified,
      verification_level: verificationLevel,
      status,
      expires_at: expiresAt,
    });

    return Response.json({
      session,
      verificationLevel,
      aiResult,
      gradingVerified,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Runs the AI vision comparison via InvokeLLM. Passes the reference image + scan
// photos and asks for a structured JSON response with match confidence and
// anomaly flags.
async function runVisionCheck(base44: any, imageUrls: string[], cardName: string): Promise<any> {
  const prompt = `You are a Pokémon card authentication assistant. The first image is the official reference card ("${cardName}"). The remaining images are photos of a physical card submitted by a collector claiming to own it.

Compare the submitted photos against the reference and determine:
1. matched — do the photos show the same card as the reference (same artwork, set, variant)?
2. confidence — your confidence score from 0.0 to 1.0
3. anomalies — list any issues you notice (e.g. "looks like a screen photo of another screen", "different card entirely", "poor lighting obscures detail", "reprint or counterfeit indicators")
4. is_screen_photo — does it look like the photo was taken of a screen/monitor rather than a physical card?
5. notes — brief explanation of your assessment

Be conservative: if you cannot clearly confirm the card matches, set matched=false.`;

  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    file_urls: imageUrls,
    response_json_schema: {
      type: 'object',
      properties: {
        matched: { type: 'boolean' },
        confidence: { type: 'number' },
        anomalies: { type: 'array', items: { type: 'string' } },
        is_screen_photo: { type: 'boolean' },
        notes: { type: 'string' },
      },
      required: ['matched', 'confidence'],
    },
  });

  return res;
}

// Verifies a grading certificate via InvokeLLM web lookup. Asks the LLM to search
// the grading company's public verification page and confirm the cert number
// matches the claimed card.
async function verifyGradingCert(base44: any, company: string, certNumber: string, cardName: string): Promise<boolean> {
  const prompt = `Verify this grading certificate. Search the web for the ${company.toUpperCase()} certificate verification page and check if certificate number "${certNumber}" exists and matches a card named "${cardName}".

Return a JSON object with:
- verified: true if the certificate exists and matches the card name
- found_card: the card name found on the certificate (if any)
- notes: any relevant details

If you cannot verify (page unavailable, cert not found, or card name mismatch), set verified=false.`;

  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    response_json_schema: {
      type: 'object',
      properties: {
        verified: { type: 'boolean' },
        found_card: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['verified'],
    },
  });

  return res?.verified === true;
}