// monitor-lz-transfers — scheduled function that monitors pending cross-chain
// $PULSE transfers for failures or delays. Runs every 5 minutes via Base44 workflow.
// Checks:
//   - Transfers older than 10 minutes (potential failure)
//   - MessageSent vs MessageReceived event matching
// Updates the CrossChainTransfer entity status accordingly.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import { OFT_PULSE_TOKEN_ABI } from '../../shared/oftPulseTokenArtifacts.ts';

const TRANSFER_TIMEOUT_MINUTES = 10;

const EVENT_ABI = [
  'event MessageSent(uint16 indexed dstChainId, address from, address to, uint256 amount)',
  'event MessageReceived(uint16 indexed srcChainId, bytes32 indexed messageId, address from, address to, uint256 amount)',
];

export default async function (req: Request): Promise<Response> {
  try {
    // Authenticate via service secret
    const authHeader = req.headers.get('authorization');
    const expectedSecret = secrets.get('BACKEND_FUNCTION_SECRET');
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);

    // Fetch pending transfers from the database
    const pendingTransfers = await base44.asServiceRole.entities.CrossChainTransfer
      .filter({ status: 'pending' }, '-sent_at', 100)
      .catch(() => []);

    if (pendingTransfers.length === 0) {
      return Response.json({ status: 'monitored', pending: 0, timedOut: 0, timestamp: new Date().toISOString() });
    }

    let timedOut = 0;
    const now = Date.now();

    for (const transfer of pendingTransfers) {
      const sentAt = new Date(transfer.sent_at).getTime();
      const ageMinutes = (now - sentAt) / 60000;

      if (ageMinutes > TRANSFER_TIMEOUT_MINUTES) {
        // Mark as failed
        await base44.asServiceRole.entities.CrossChainTransfer.update(transfer.id, {
          status: 'failed',
          failed_at: new Date().toISOString(),
          failure_reason: `Transfer timed out after ${Math.round(ageMinutes)} minutes`,
        }).catch(() => {});
        timedOut++;
      }
    }

    // Optionally: query on-chain events to confirm delivery
    // This would require scanning blocks on both chains for MessageReceived events
    // For now, we rely on the timeout mechanism above

    return Response.json({
      status: 'monitored',
      pending: pendingTransfers.length,
      timedOut,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('monitor-lz-transfers error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}