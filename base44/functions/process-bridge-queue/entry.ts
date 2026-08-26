// process-bridge-queue — retries failed Polygon→PulseChain bridge relays.
// Loads queued BridgeQueue items, attempts relayBridgeMint for each, marks
// confirmed (and updates the matching OnChainAsset) on success, increments
// retry_count + last_error on failure, and permanently fails items that exceed
// max_retries. Called every 5 minutes by the "Bridge Queue Processor" workflow
// (via BACKEND_FUNCTION_SECRET) or directly by an admin.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { relayBridgeMint } from '../../shared/bridgeRelayer.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    // Auth: shared secret (workflow trigger) or admin caller.
    const expectedSecret = Deno.env.get('BACKEND_FUNCTION_SECRET');
    const headerSecret = req.headers.get('x-trigger-secret') || '';
    let bodySecret = '';
    try {
      const body = await req.clone().json().catch(() => ({}));
      bodySecret = String(body?.trigger_secret || '');
    } catch {}
    const secretOk = expectedSecret && expectedSecret.length > 0 &&
      (headerSecret === expectedSecret || bodySecret === expectedSecret);

    if (!secretOk) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch queued items (oldest first, batch of 50)
    const queuedItems = await svc.entities.BridgeQueue
      .filter({ status: 'queued' }, 'created_date', 50).catch(() => []);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const item of queuedItems) {
      processed++;

      // Permanently fail if max retries exceeded
      if ((item.retry_count || 0) >= (item.max_retries || 5)) {
        await svc.entities.BridgeQueue.update(item.id, {
          status: 'failed',
          last_error: 'Max retries exceeded',
          processed_at: new Date().toISOString(),
        });
        failed++;
        continue;
      }

      try {
        const payload = item.payload || {};

        const result = await relayBridgeMint({
          assetType: item.asset_type,
          to: payload.to,
          handleOrCardId: payload.handle || payload.cardId,
          nameOrCardName: payload.cardName || '',
          didOrCardImage: payload.did || payload.cardImage,
          metadataURI: payload.metadataURI,
          verificationLevel: payload.verificationLevel || 0,
          sourceTxHash: item.source_tx_hash,
        }, svc);

        // Mark confirmed
        await svc.entities.BridgeQueue.update(item.id, {
          status: 'confirmed',
          processed_at: new Date().toISOString(),
        });

        // Update the matching OnChainAsset (look up by source tx hash)
        const assets = await svc.entities.OnChainAsset
          .filter({ mint_tx_hash: item.source_tx_hash }).catch(() => []);

        if (assets.length) {
          await svc.entities.OnChainAsset.update(assets[0].id, {
            bridge_status: 'confirmed',
            pulsechain_token_id: result.pulseTokenId,
            pulsechain_tx_hash: result.pulseTxHash,
          });
        }

        succeeded++;
      } catch (err: any) {
        // Increment retry count and re-queue
        await svc.entities.BridgeQueue.update(item.id, {
          status: 'queued',
          retry_count: (item.retry_count || 0) + 1,
          last_error: (err?.message || 'unknown error').slice(0, 500),
        });
        failed++;
      }
    }

    return Response.json({
      processed,
      succeeded,
      failed,
      remaining: Math.max(0, queuedItems.length - processed),
    });
  } catch (error: any) {
    console.error('process-bridge-queue error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}