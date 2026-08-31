import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  ageEligible,
  attestationCommitment,
  getVerifiedConfig,
  jsonError,
  normalizeHex,
  relayMintCard,
} from '../../shared/chainRelay.ts';

// Card NFTs are minted by the relay because the CardNft contract is owner-gated.
// That is deliberate: a collector must never be able to mint themselves a
// verification level they did not earn. This function is the only place that
// authorises a mint, and it does so strictly from a verified
// CardVerificationSession that belongs to the caller.

async function activeIdentity(svc: any, userId: string) {
  const rows = await svc.entities.ChainIdentity.filter({ user_id: userId }, '-created_date', 10).catch(() => []);
  const authoritative = ['REGISTERED', 'MERGED', 'RECOVERED'];
  return (rows || []).find((row: any) => authoritative.includes(String(row.status || ''))) || null;
}

function cardIdFelt(cardId: string): string {
  // TCGDex ids are short ASCII; encode directly into a felt so the on-chain
  // record is queryable without a separate lookup table.
  const bytes = new TextEncoder().encode(cardId);
  if (bytes.length === 0 || bytes.length > 31) throw new Error('CARD_ID_LENGTH_NOT_SUPPORTED');
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `0x${BigInt(`0x${hex}`).toString(16)}`;
}

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return jsonError('Method not allowed', 405);
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return jsonError('Unauthorized', 401);
    const svc = base44.asServiceRole;
    if (!(await ageEligible(svc, me.id))) {
      return jsonError('Adult testnet eligibility is required', 403, 'AGE_ELIGIBILITY_REQUIRED');
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.verification_session_id || '').trim();
    if (!sessionId) return jsonError('verification_session_id is required', 400, 'SESSION_REQUIRED');

    const identity = await activeIdentity(svc, me.id);
    if (!identity?.account_address) {
      return jsonError('Secure your on-chain identity before minting', 409, 'IDENTITY_NOT_SECURED');
    }

    const config = await getVerifiedConfig(svc);
    if (!config) return jsonError('SwapPulse Testnet verification pins are stale or incomplete', 409, 'CHAIN_VERIFICATION_REQUIRED');
    if (!String(config.card_nft_address || '').trim()) {
      return jsonError('Card minting is not enabled on this network yet', 409, 'CARD_NFT_NOT_CONFIGURED');
    }

    const sessionRows = await svc.entities.CardVerificationSession.filter({ id: sessionId }, '-created_date', 1).catch(() => []);
    const session = sessionRows?.[0];
    if (!session || String(session.created_by_id) !== String(me.id)) {
      return jsonError('Verification session not found', 404, 'SESSION_NOT_FOUND');
    }
    if (session.status !== 'verified') {
      return jsonError('This card has not completed verification', 409, 'SESSION_NOT_VERIFIED');
    }
    if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
      return jsonError('This verification session has expired — scan the card again', 409, 'SESSION_EXPIRED');
    }

    const level = Number(session.verification_level || 0);
    if (!Number.isInteger(level) || level < 0 || level > 3) return jsonError('Invalid verification level', 409, 'INVALID_LEVEL');

    const attestationHash = await attestationCommitment(session.id, String(session.card_id), level);

    // The commitment is the on-chain idempotency key, so a repeated request
    // returns the existing token rather than minting a duplicate.
    const existing = await svc.entities.ChainCardToken.filter({ attestation_hash: attestationHash }, '-created_date', 1).catch(() => []);
    if (existing?.[0] && existing[0].status === 'MINTED') {
      return Response.json({ ok: true, already_minted: true, token: existing[0] });
    }

    const cardDetail = await svc.functions.invoke('get-card-detail', { card_id: session.card_id }).catch(() => null);
    const card = cardDetail?.data?.card || cardDetail?.data || {};
    const cardName = String(session.card_name || card?.name || session.card_id);
    const cardImage = String(card?.image_url || card?.image || '');

    // Metadata is a TCGDex-sourced JSON blob. The token references it by URL and
    // carries the verification level on-chain, so the trust level survives even
    // if an external indexer only reads the contract.
    const metadata = {
      name: cardName,
      description: `SwapPulse verified card possession attestation for ${cardName}.`,
      image: cardImage,
      external_url: 'https://swappulse.org/card/' + encodeURIComponent(String(session.card_id)),
      attributes: [
        { trait_type: 'Card ID', value: String(session.card_id) },
        { trait_type: 'Verification Level', value: level },
        { trait_type: 'Set', value: String(card?.set_name || '') },
        { trait_type: 'Rarity', value: String(card?.rarity || '') },
        { trait_type: 'Grading Company', value: String(session.grading_company || 'none') },
      ],
      swappulse: {
        network: 'SWAPPULSE_TESTNET',
        attestation_hash: attestationHash,
        verification_level: level,
        verified_at: session.updated_date || session.created_date,
      },
    };
    const metadataFile = new File([JSON.stringify(metadata, null, 2)], `card-${session.card_id}.json`, { type: 'application/json' });
    const uploaded = await svc.integrations.Core.UploadFile({ file: metadataFile });
    const metadataUri = String(uploaded?.file_url || '');
    if (!/^https:\/\//.test(metadataUri)) return jsonError('Could not store the card metadata', 502, 'METADATA_UPLOAD_FAILED');

    const record = existing?.[0]
      ? existing[0]
      : await svc.entities.ChainCardToken.create({
        did: String(me.did || ''),
        network: 'SWAPPULSE_TESTNET',
        card_id: String(session.card_id),
        card_name: cardName,
        card_image: cardImage,
        collection_entry_id: String(session.collection_entry_id || ''),
        verification_session_id: session.id,
        verification_level: level,
        attestation_hash: attestationHash,
        metadata_uri: metadataUri,
        owner_address: normalizeHex(identity.account_address, 'account address'),
        soulbound: true,
        status: 'DRAFTED',
      });

    try {
      const minted = await relayMintCard({
        to: normalizeHex(identity.account_address, 'account address'),
        card_id: cardIdFelt(String(session.card_id)),
        verification_level: level,
        attestation_hash: attestationHash,
        metadata_uri: metadataUri,
        soulbound: 1,
      });
      const txHash = normalizeHex(minted?.transaction_hash, 'mint transaction hash');
      await svc.entities.ChainCardToken.update(record.id, {
        status: 'MINTED',
        tx_hash: txHash,
        metadata_uri: metadataUri,
        confirmed_at: new Date().toISOString(),
        last_error: '',
      });
      return Response.json({ ok: true, record_id: record.id, transaction_hash: txHash, verification_level: level });
    } catch (mintError: any) {
      const code = String(mintError?.message || 'MINT_FAILED').slice(0, 200);
      await svc.entities.ChainCardToken.update(record.id, { status: 'FAILED', last_error: code });
      throw mintError;
    }
  } catch (error: any) {
    const code = String(error?.message || 'MINT_CARD_FAILED').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 120);
    console.error('mint-card failed:', code);
    const clientError = code.includes('NOT_CONFIGURED') || code.includes('NOT_ALLOWED') || code.includes('MISMATCH') || code.includes('REQUIRED') || code.includes('NOT_SUPPORTED');
    return jsonError(clientError ? code.replaceAll('_', ' ') : 'Card minting failed', clientError ? 409 : 502, code);
  }
}