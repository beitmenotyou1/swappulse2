// configure-lz-peers — establishes bidirectional LayerZero peer links between
// the OFT contracts on PulseChain and Polygon. Must be called once after both
// OFT contracts are deployed. Calls setPeer() on each chain pointing to the other.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import { OFT_PULSE_TOKEN_ABI, LAYERZERO_CHAIN_IDS } from '../../shared/crossChainBridge.ts';

const OFT_SET_PEER_ABI = [
  'function setPeer(uint16 dstChainId, address peer) external',
  'function peers(uint16 dstChainId) view returns (address)',
  ...OFT_PULSE_TOKEN_ABI,
];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const pulseOft = secrets.get('OFT_PULSE_TOKEN_CONTRACT');
    const polygonOft = secrets.get('OFT_POLYGON_TOKEN_CONTRACT');

    if (!pulseOft) {
      return Response.json({ error: 'OFT_PULSE_TOKEN_CONTRACT secret not set. Deploy on PulseChain first.' }, { status: 400 });
    }
    if (!polygonOft) {
      return Response.json({ error: 'OFT_POLYGON_TOKEN_CONTRACT secret not set. Deploy on Polygon first.' }, { status: 400 });
    }

    const pulseRpc = secrets.get('PULSE_RPC_URL');
    const pulseKey = secrets.get('PULSE_PRIVATE_KEY');
    const polygonRpc = secrets.get('POLYGON_RPC_URL');
    const polygonKey = secrets.get('POLYGON_PRIVATE_KEY');

    if (!pulseRpc || !pulseKey || !polygonRpc || !polygonKey) {
      return Response.json({ error: 'RPC URLs and private keys for both chains must be set' }, { status: 400 });
    }

    const results: any = {};

    // 1. Configure PulseChain → Polygon peer
    try {
      const pulseProvider = new ethers.JsonRpcProvider(pulseRpc);
      const pulseWallet = new ethers.Wallet(pulseKey, pulseProvider);
      const pulseContract = new ethers.Contract(pulseOft, OFT_SET_PEER_ABI, pulseWallet);

      const tx1 = await pulseContract.setPeer(LAYERZERO_CHAIN_IDS.polygonAmoy, polygonOft);
      await tx1.wait();
      results.pulseToPolygon = { txHash: tx1.hash, peer: polygonOft, lzChainId: LAYERZERO_CHAIN_IDS.polygonAmoy };
    } catch (e: any) {
      return Response.json({ error: 'Failed to configure PulseChain peer', details: e?.message || e }, { status: 500 });
    }

    // 2. Configure Polygon → PulseChain peer
    try {
      const polygonProvider = new ethers.JsonRpcProvider(polygonRpc);
      const polygonWallet = new ethers.Wallet(polygonKey, polygonProvider);
      const polygonContract = new ethers.Contract(polygonOft, OFT_SET_PEER_ABI, polygonWallet);

      const tx2 = await polygonContract.setPeer(LAYERZERO_CHAIN_IDS.pulseChain, pulseOft);
      await tx2.wait();
      results.polygonToPulse = { txHash: tx2.hash, peer: pulseOft, lzChainId: LAYERZERO_CHAIN_IDS.pulseChain };
    } catch (e: any) {
      return Response.json({ error: 'Failed to configure Polygon peer', details: e?.message || e }, { status: 500 });
    }

    return Response.json({
      status: 'configured',
      peers: results,
      message: 'Cross-chain peer configuration complete. $PULSE transfers are now enabled.',
      testInstructions: [
        'Approve the OFT contract to spend your $PULSE tokens',
        'Call send() on PulseChain with the recipient address',
        'Wait for LayerZero to relay the message (~1-5 minutes)',
        'Recipient receives $PULSE on the destination chain',
      ],
    });
  } catch (error: any) {
    console.error('configure-lz-peers error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}