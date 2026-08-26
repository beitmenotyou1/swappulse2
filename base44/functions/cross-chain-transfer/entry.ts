// cross-chain-transfer — handles cross-chain $PULSE transfers via LayerZero OFT.
// Supports two actions:
//   - "quote": returns the estimated gas cost and SwapPulse fees
//   - "transfer": initiates the transfer (custodial wallet signing or client-side MetaMask)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import {
  quoteCrossChainGas,
  buildSendTransactionData,
  sendCrossChain,
  getLzChainId,
  type ChainKey,
} from '../../shared/crossChainBridge.ts';
import { decryptPrivateKey, verifyPin } from '../../shared/walletCrypto.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const did = user.data?.did || user.did;
    if (!did) {
      return Response.json({ error: 'AT Protocol DID required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, fromChain, toChain, toAddress, amount, unlockCredential } = body;

    // --- Validation ---
    if (!['quote', 'transfer'].includes(action)) {
      return Response.json({ error: 'Invalid action (use "quote" or "transfer")' }, { status: 400 });
    }
    if (!fromChain || !toChain || !['pulse', 'polygon'].includes(fromChain) || !['pulse', 'polygon'].includes(toChain)) {
      return Response.json({ error: 'Invalid chain (must be "pulse" or "polygon")' }, { status: 400 });
    }
    if (fromChain === toChain) {
      return Response.json({ error: 'Source and destination chains must differ' }, { status: 400 });
    }
    if (!toAddress || !ethers.isAddress(toAddress)) {
      return Response.json({ error: 'Valid recipient address required' }, { status: 400 });
    }
    if (!amount || BigInt(amount) <= 0n) {
      return Response.json({ error: 'Valid amount required (in wei)' }, { status: 400 });
    }

    const amountBig = BigInt(amount);
    const fromChainKey = fromChain as ChainKey;
    const toChainKey = toChain as ChainKey;

    // --- QUOTE ACTION ---
    if (action === 'quote') {
      try {
        const quote = await quoteCrossChainGas(fromChainKey, toChainKey, amountBig, base44.asServiceRole);

        return Response.json({
          action: 'quote',
          fromChain,
          toChain,
          amount: amountBig.toString(),
          fees: {
            lzGasCost: quote.lzGasCost.toString(),
            lzGasCostHuman: ethers.formatEther(quote.lzGasCost) + ' ETH',
            swapPulseFee: quote.swapPulseFee.toString(),
            swapPulseFeeHuman: ethers.formatEther(quote.swapPulseFee) + ' PULSE',
            total: quote.totalCost.toString(),
            totalHuman: ethers.formatEther(quote.totalCost) + ' combined',
          },
          estimatedDelivery: '1-5 minutes',
        });
      } catch (e: any) {
        return Response.json({ error: 'Failed to quote gas cost', details: e?.message || e }, { status: 500 });
      }
    }

    // --- TRANSFER ACTION ---
    // Check linked wallet
    const links = await base44.entities.WalletLink.filter({ did, active: true }).catch(() => []);
    if (!links.length) {
      return Response.json({ error: 'No linked wallet found. Link a wallet first.' }, { status: 400 });
    }
    const walletAddress = links[0].wallet_address;

    // Check for custodial wallet
    const custodialWallets = await base44.entities.CustodialWallet.filter({ did, active: true }).catch(() => []);
    const multiWallets = await base44.entities.MultiChainWallet.filter({ did, active: true }).catch(() => []);
    const custodialWallet = custodialWallets[0] || multiWallets[0];
    const isCustodial = !!custodialWallet;

    if (isCustodial) {
      const cw = custodialWallet;

      // Check if wallet needs unlock
      if ((cw.has_passkey || cw.has_pin) && !unlockCredential) {
        return Response.json({
          requiresUnlock: true,
          hasPasskey: cw.has_passkey,
          hasPin: cw.has_pin,
        }, { status: 200 });
      }

      // Verify PIN if needed
      if ((cw.has_passkey || cw.has_pin) && unlockCredential?.pin) {
        const pinValid = await verifyPin(cw, unlockCredential.pin);
        if (!pinValid) {
          return Response.json({ error: 'Invalid PIN' }, { status: 403 });
        }
      }

      // Decrypt private key and create signer
      const privateKey = await decryptPrivateKey(cw, unlockCredential?.pin);
      const rpcUrl = fromChain === 'pulse' ? secrets.get('PULSE_RPC_URL') : secrets.get('POLYGON_RPC_URL');
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const signerWallet = new ethers.Wallet(privateKey, provider);

      // Execute the cross-chain send
      const result = await sendCrossChain(fromChainKey, toChainKey, toAddress, amountBig, signerWallet, base44.asServiceRole);

      // Record in database
      await base44.asServiceRole.entities.CrossChainTransfer.create({
        did,
        from_chain: fromChain,
        to_chain: toChain,
        from_lz_chain_id: getLzChainId(fromChainKey),
        to_lz_chain_id: getLzChainId(toChainKey),
        from_address: walletAddress,
        to_address: toAddress,
        amount_wei: amountBig.toString(),
        tx_hash: result.txHash,
        status: 'pending',
        sent_at: new Date().toISOString(),
      });

      return Response.json({
        status: 'submitted',
        txHash: result.txHash,
        explorerUrl: result.explorerUrl,
        message: 'Cross-chain transfer initiated. Tokens will arrive within 1-5 minutes.',
        estimatedDelivery: '1-5 minutes',
      });
    } else {
      // --- Linked Wallet Flow (client-side signing via MetaMask) ---
      const txData = await buildSendTransactionData(fromChainKey, toChainKey, toAddress, amountBig, base44.asServiceRole);

      // Record in database as pending (will be updated when tx is confirmed)
      const transferRecord = await base44.asServiceRole.entities.CrossChainTransfer.create({
        did,
        from_chain: fromChain,
        to_chain: toChain,
        from_lz_chain_id: getLzChainId(fromChainKey),
        to_lz_chain_id: getLzChainId(toChainKey),
        from_address: walletAddress,
        to_address: toAddress,
        amount_wei: amountBig.toString(),
        status: 'pending',
        sent_at: new Date().toISOString(),
      });

      return Response.json({
        requiresClientSign: true,
        transferId: transferRecord.id,
        transaction: {
          to: txData.to,
          data: txData.data,
          value: txData.value,
          from: walletAddress,
          description: `Send ${ethers.formatEther(amountBig)} PULSE from ${fromChain} to ${toAddress} on ${toChain}`,
        },
      });
    }
  } catch (error: any) {
    console.error('cross-chain-transfer error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}