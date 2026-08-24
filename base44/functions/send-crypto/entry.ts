// send-crypto — multi-chain send from the user's custodial wallet with
// three-layer security: (1) receive-allowlist check (recipient must be a traded
// contact or explicitly allowlisted), (2) passkey/PIN unlock, (3) one-time
// 6-digit code. Supports EVM native (POL/ETH) and USDC sends on any EVM chain.
// Solana/Bitcoin send is deferred (returns a clear message).
//
// Flow (state machine via presence of unlockCredential / send_code):
//   No unlock, no code  → return { requiresUnlock, gasEstimate, clearSigning }
//   Unlock, no code     → verify unlock, issue one-time code, return { requiresCode, code }
//   Code                → verify code, broadcast transaction

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  getOrCreateWalletBalance, updateBalance, calculateFee, PLATFORM_FEE_WALLET,
} from '../../shared/walletEscrow.ts';
import { decryptPrivateKey, verifyPin } from '../../shared/walletCrypto.ts';
import { verifySignedChallenge } from '../../shared/webauthn.ts';
import { verifyAuthenticationResponse } from 'npm:@simplewebauthn/server@10';
import { ethers } from 'npm:ethers@6.13.4';
import {
  getChainConfig, getEvmProvider, estimateEvmGas, formatNativeBalance,
} from '../../shared/multiChain.ts';

const ERC20_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const {
      chain, asset, to_address, amount_wei,
      unlockCredential, pin, send_code, username,
    } = body;

    // Resolve username to address if provided
    let recipient = to_address;
    if (!recipient && username) {
      const aliasRes = await base44.functions.invoke('resolve-wallet-alias', { username });
      const aliasData = aliasRes?.data || aliasRes;
      if (aliasData?.addresses?.evm) {
        recipient = aliasData.addresses.evm;
      } else {
        return Response.json({ error: 'Could not resolve username' }, { status: 400 });
      }
    }

    if (!recipient) return Response.json({ error: 'Recipient address required' }, { status: 400 });
    const chainConfig = getChainConfig(chain || 'polygon');
    if (!chainConfig) return Response.json({ error: 'Unsupported chain' }, { status: 400 });

    // EVM address validation
    if (chainConfig.type === 'evm' && !ethers.isAddress(recipient)) {
      return Response.json({ error: 'Invalid recipient address' }, { status: 400 });
    }

    const amountWei = amount_wei ? BigInt(amount_wei) : 0n;
    if (!send_code && (!unlockCredential && !pin) && amountWei <= 0n) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Get the user's wallet (MultiChainWallet or legacy CustodialWallet)
    const mcWallets = await base44.asServiceRole.entities.MultiChainWallet
      .filter({ did, active: true }, '-created_date', 1).catch(() => []);
    let wallet: any = mcWallets[0] || null;
    let isMultiChain = !!wallet;

    if (!wallet) {
      const legacy = await base44.asServiceRole.entities.CustodialWallet
        .filter({ did, active: true }, '-created_date', 1).catch(() => []);
      wallet = legacy[0] || null;
    }
    if (!wallet) return Response.json({ error: 'No active wallet found' }, { status: 400 });

    const evmAddress = isMultiChain ? wallet.evm_address : wallet.wallet_address;

    // --- Step 1: No unlock, no code → return gas estimate + clear-signing ---
    if (!unlockCredential && !pin && !send_code) {
      // Receive-allowlist check: recipient must be a traded contact or allowlisted
      const isTrusted = await checkRecipientTrusted(base44, did, recipient);
      if (!isTrusted) {
        return Response.json({
          error: 'This address is not on your allowlist. Add it first, or send to a traded contact.',
          needsAllowlist: true,
        }, { status: 403 });
      }

      // Estimate gas
      let gasEstimate: any = null;
      let clearSigning: any = {
        action: `Send ${formatNativeBalance(amount_wei, chainConfig.nativeDecimals)} ${asset === 'USDC' ? 'USDC' : chainConfig.nativeSymbol}`,
        chain: chainConfig.name,
        recipient,
        amount: amount_wei,
        asset: asset || (chainConfig.type === 'evm' ? chainConfig.nativeSymbol : 'USDC'),
      };

      if (chainConfig.type === 'evm') {
        if (asset === 'USDC' && chainConfig.usdcAddress) {
          const contract = new ethers.Contract(chainConfig.usdcAddress, ERC20_ABI, getEvmProvider(chain));
          const data = contract.interface.encodeFunctionData('transfer', [recipient, amountWei]);
          gasEstimate = await estimateEvmGas(chain, evmAddress, chainConfig.usdcAddress!, data);
          clearSigning.contract = chainConfig.usdcAddress;
          clearSigning.contractLabel = 'USDC token contract';
        } else {
          gasEstimate = await estimateEvmGas(chain, evmAddress, recipient, '0x', amount_wei);
        }
        if (gasEstimate) {
          clearSigning.gasCost = gasEstimate.gasCost;
          clearSigning.gasCostFormatted = `${formatNativeBalance(gasEstimate.gasCost, 18)} ${chainConfig.nativeSymbol}`;
        }
      }

      return Response.json({
        requiresUnlock: true,
        hasPasskey: wallet.has_passkey,
        hasPin: wallet.has_pin,
        gasEstimate,
        clearSigning,
      });
    }

    // --- Step 2: Unlock provided, no code → verify unlock, issue one-time code ---
    if ((unlockCredential || pin) && !send_code) {
      let privateKey: string;

      if (unlockCredential) {
        const creds = await base44.asServiceRole.entities.WebAuthnCredential
          .filter({ user_id: user.id }, '-created_date', 50).catch(() => []);
        const validCreds = creds.filter((c: any) => c.credential_id);
        if (!validCreds.length) return Response.json({ error: 'No passkey enrolled' }, { status: 400 });

        const { assertion, challenge, challenge_signature } = unlockCredential;
        if (!assertion || !challenge || !challenge_signature) {
          return Response.json({ error: 'Missing unlock credentials' }, { status: 400 });
        }

        const sigValid = await verifySignedChallenge(
          Deno.env.get('BACKEND_FUNCTION_SECRET')!, challenge, challenge_signature,
        );
        if (!sigValid) return Response.json({ error: 'Invalid challenge' }, { status: 403 });

        let verified = false;
        for (const cred of validCreds) {
          try {
            const result = await verifyAuthenticationResponse({
              response: assertion,
              expectedChallenge: challenge,
              expectedOrigin: new URL(req.url).origin,
              expectedRPID: new URL(req.url).hostname,
              authenticator: {
                credentialID: cred.credential_id,
                credentialPublicKey: cred.public_key,
                counter: cred.counter || 0,
              },
            });
            if (result.verified) {
              verified = true;
              await base44.asServiceRole.entities.WebAuthnCredential.update(cred.id, {
                counter: result.authenticationInfo?.newCounter || cred.counter + 1,
              });
              break;
            }
          } catch {}
        }
        if (!verified) return Response.json({ error: 'Passkey verification failed' }, { status: 403 });
        privateKey = await decryptPrivateKey(wallet);
      } else if (pin) {
        const pinValid = await verifyPin(wallet, pin);
        if (!pinValid) return Response.json({ error: 'Invalid PIN' }, { status: 403 });
        privateKey = await decryptPrivateKey(wallet, pin);
      } else {
        return Response.json({ error: 'Missing unlock credential' }, { status: 400 });
      }

      // Issue a one-time 6-digit code
      const code = String(Math.floor(Math.random() * 900000) + 100000);
      const codeHash = await hashCode(code);
      const expiresAt = new Date(Date.now() + 60_000).toISOString();

      await base44.entities.SendCode.create({
        did,
        code_hash: codeHash,
        purpose: 'send_crypto',
        to_address: recipient,
        amount_wei: amount_wei || '0',
        chain: chain || 'polygon',
        asset: asset || 'USDC',
        expires_at: expiresAt,
        used: false,
        created_at: new Date().toISOString(),
      });

      return Response.json({
        requiresCode: true,
        code, // plaintext — shown in-app, TTL 60s
      });
    }

    // --- Step 3: Code provided → verify code, broadcast transaction ---
    if (send_code) {
      // Find the matching unused, unexpired SendCode
      const codes = await base44.asServiceRole.entities.SendCode
        .filter({ did, to_address: recipient, used: false }, '-created_date', 10).catch(() => []);

      const now = Date.now();
      const match = codes.find((c: any) => {
        if (new Date(c.expires_at).getTime() < now) return false;
        if (c.amount_wei !== String(amount_wei || '0')) return false;
        if (c.chain !== (chain || 'polygon')) return false;
        return true;
      });

      if (!match) return Response.json({ error: 'Invalid or expired code' }, { status: 403 });

      const codeHash = await hashCode(send_code);
      if (codeHash !== match.code_hash) {
        return Response.json({ error: 'Incorrect one-time code' }, { status: 403 });
      }

      // Mark code as used
      await base44.asServiceRole.entities.SendCode.update(match.id, {
        used: true,
        used_at: new Date().toISOString(),
      });

      // Decrypt the private key (server-encrypted, no re-unlock needed)
      const privateKey = await decryptPrivateKey(wallet);
      const isUsdc = (asset || 'USDC') === 'USDC';

      // Execute the on-chain transaction
      if (chainConfig.type !== 'evm') {
        return Response.json({
          error: `Sending on ${chainConfig.name} is coming soon. EVM chains are supported now.`,
        }, { status: 400 });
      }

      const provider = getEvmProvider(chain);
      const userWallet = new ethers.Wallet(privateKey, provider);

      let txHash = '';
      let feeTxHash = '';

      if (isUsdc && chainConfig.usdcAddress) {
        // USDC send + 2% fee
        const contract = new ethers.Contract(chainConfig.usdcAddress, ERC20_ABI, userWallet);
        const feeWei = calculateFee(amountWei);
        const totalDebit = amountWei + feeWei;

        // Check on-chain USDC balance
        const balance = await getOrCreateWalletBalance(base44, did, evmAddress);
        if (BigInt(balance.usdc_wei || '0') < totalDebit) {
          return Response.json({ error: 'Insufficient USDC for amount + fee' }, { status: 400 });
        }

        const sendTx = await contract.transfer(recipient, amountWei);
        await sendTx.wait();
        txHash = sendTx.hash;

        try {
          const feeTx = await contract.transfer(PLATFORM_FEE_WALLET, feeWei);
          await feeTx.wait();
          feeTxHash = feeTx.hash;
        } catch (e) {
          console.error('Fee transfer failed:', (e as any)?.message);
        }

        await updateBalance(base44, balance.id, {
          usdc_wei: (BigInt(balance.usdc_wei || '0') - totalDebit).toString(),
          total_fees_paid_wei: (BigInt(balance.total_fees_paid_wei || '0') + feeWei).toString(),
        });

        await base44.entities.CryptoTransfer.create({
          did,
          transfer_type: 'send',
          from_address: evmAddress,
          to_address: recipient,
          amount_wei: amountWei.toString(),
          fee_wei: feeWei.toString(),
          tx_hash: txHash,
          status: 'confirmed',
          description: `Sent USDC on ${chainConfig.name} to ${recipient.slice(0, 8)}…${recipient.slice(-6)}`,
        });

        await base44.asServiceRole.entities.FeeLedger.create({
          fee_source: 'send',
          source_did: did,
          original_amount_wei: amountWei.toString(),
          fee_usdc_wei: feeWei.toString(),
          fee_tx_hash: feeTxHash,
          swept: !!feeTxHash,
          swept_at: feeTxHash ? new Date().toISOString() : undefined,
        });
      } else {
        // Native token send (POL, ETH)
        const tx = await userWallet.sendTransaction({
          to: recipient,
          value: amountWei,
        });
        await tx.wait();
        txHash = tx.hash;

        await base44.entities.CryptoTransfer.create({
          did,
          transfer_type: 'send',
          from_address: evmAddress,
          to_address: recipient,
          amount_wei: amountWei.toString(),
          fee_wei: '0',
          tx_hash: txHash,
          status: 'confirmed',
          description: `Sent ${chainConfig.nativeSymbol} on ${chainConfig.name} to ${recipient.slice(0, 8)}…${recipient.slice(-6)}`,
        });
      }

      return Response.json({
        success: true,
        tx_hash: txHash,
        fee_tx_hash: feeTxHash,
        chain: chainConfig.key,
        explorer_url: `${chainConfig.explorerUrl}/tx/${txHash}`,
      });
    }

    return Response.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error: any) {
    console.error('send-crypto error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

// --- Helpers ---

async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Check if recipient is a traded contact or on the user's ReceiveAllowlist
async function checkRecipientTrusted(base44: any, did: string, address: string): Promise<boolean> {
  const lowerAddr = address.toLowerCase();

  // Check explicit allowlist
  const allowlist = await base44.entities.ReceiveAllowlist
    .filter({ did }).catch(() => []);
  if (allowlist.some((a: any) => a.address.toLowerCase() === lowerAddr)) return true;

  // Check traded contacts (completed/released escrow trades)
  const trades = await base44.asServiceRole.entities.EscrowTrade
    .filter({ buyer_did: did, status: 'released' }, '-created_date', 100).catch(() => []);
  const sellerTrades = await base44.asServiceRole.entities.EscrowTrade
    .filter({ seller_did: did, status: 'released' }, '-created_date', 100).catch(() => []);

  const allTrades = [...trades, ...sellerTrades];
  for (const t of allTrades) {
    const counterpartyWallet = t.buyer_did === did ? t.seller_wallet : t.buyer_wallet;
    if (counterpartyWallet && counterpartyWallet.toLowerCase() === lowerAddr) return true;
  }

  return false;
}