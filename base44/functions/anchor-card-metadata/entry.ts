// anchor-card-metadata — hashes a TCGDex card's metadata and anchors the hash
// on PulseChain via the CardMetadataAnchor contract. This allows trade fairness
// calculations to verify that off-chain TCGDex data hasn't been tampered with.
//
// Admin-only. Can anchor a single card or a batch (Merkle root of multiple cards).
//
// POST body:
//   { cardId: "swsh3-136" }                    — anchor a single card
//   { batch: true }                            — anchor a Merkle root of all synced cards
//
// Documentation:
//   TCGDex Card Reference: https://tcgdex.dev/reference/card
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import {
  CARD_METADATA_ANCHOR_ABI,
} from '../../shared/cardMetadataAnchorArtifacts.ts';
import { getPulseMintWallet } from '../../shared/pulseClient.ts';

/** Build a deterministic JSON string of a card's metadata for hashing. */
function buildMetadataPayload(card: any): string {
  return JSON.stringify({
    id: card.card_id,
    name: card.name,
    set: card.set_id,
    rarity: card.rarity,
    image: card.image,
    local_id: card.local_id,
  });
}

/** Compute keccak256 of a UTF-8 string. */
function hashMetadata(data: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(data));
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;

    // Resolve the anchor address from the ContractRegistry (populated by
    // deploy-card-metadata-anchor). No secret dependency.
    const anchorRec = (await svc.entities.ContractRegistry
      .filter({ contract_key: 'card_metadata_anchor' }).catch(() => []))[0];
    const anchorAddress = anchorRec?.address || '';
    if (!anchorAddress) {
      return Response.json({
        error: 'CardMetadataAnchor not deployed. Run deploy-card-metadata-anchor first.',
      }, { status: 400 });
    }

    const wallet = getPulseMintWallet();
    const anchor = new ethers.Contract(anchorAddress, CARD_METADATA_ANCHOR_ABI, wallet);

    // Single card mode
    if (body.cardId) {
      const card = (await svc.entities.TcgdexCard.filter({ card_id: body.cardId }, '-updated_date', 1))[0];
      if (!card) {
        return Response.json({ error: `Card ${body.cardId} not found in local cache` }, { status: 404 });
      }

      const payload = buildMetadataPayload(card);
      const metadataHash = hashMetadata(payload);

      const tx = await anchor.anchorCard(card.card_id, metadataHash);
      const receipt = await tx.wait();

      return Response.json({
        success: true,
        card_id: card.card_id,
        metadata_hash: metadataHash,
        tx_hash: tx.hash,
        block_number: receipt.blockNumber,
        verify: `Call verifyCard("${card.card_id}", "${metadataHash}") on the contract to validate`,
      });
    }

    // Batch mode: anchor a Merkle root of all synced cards
    if (body.batch) {
      const cards = await svc.entities.TcgdexCard.list('-updated_date', 500);
      if (cards.length === 0) {
        return Response.json({ error: 'No cards in local cache to anchor' }, { status: 400 });
      }

      // Compute individual hashes and build a simple Merkle root
      const hashes = cards.map((c: any) => hashMetadata(buildMetadataPayload(c)));
      let merkleRoot: string;
      if (hashes.length === 1) {
        merkleRoot = hashes[0];
      } else {
        // Pair-wise hash until one root remains
        let layer = hashes;
        while (layer.length > 1) {
          const next: string[] = [];
          for (let i = 0; i < layer.length; i += 2) {
            const left = layer[i];
            const right = layer[i + 1] || layer[i];
            next.push(ethers.keccak256(left + right.slice(2)));
          }
          layer = next;
        }
        merkleRoot = layer[0];
      }

      const tx = await anchor.anchorBatch(merkleRoot, cards.length);
      const receipt = await tx.wait();

      return Response.json({
        success: true,
        card_count: cards.length,
        merkle_root: merkleRoot,
        tx_hash: tx.hash,
        block_number: receipt.blockNumber,
      });
    }

    return Response.json({ error: 'Provide cardId or batch=true' }, { status: 400 });
  } catch (error: any) {
    console.error('[anchor-card-metadata] error', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}