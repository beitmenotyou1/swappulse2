import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { queuePulseGaslessTransfer } from '../../shared/pulseGaslessQueue.ts';

// Queue a gasless $PULSE transfer on PulseChain. The user's custodial wallet
// signs an EIP-712 meta-transaction intent (server-side, after passkey/PIN
// unlock); the treasury relayer submits it on-chain and pays the native PLS
// gas. The user never needs to hold PLS. Processed by the scheduled
// process-meta-transactions workflow (chain=pulse path).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    return await queuePulseGaslessTransfer(base44, req, user, body);
  } catch (error: any) {
    console.error('queue-pulse-gasless-transfer error:', error?.message || error);
    return Response.json({ error: error?.message || 'Failed to queue gasless transfer' }, { status: 500 });
  }
}