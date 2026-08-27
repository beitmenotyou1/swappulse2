// send-crypto — sends USDC from the user's custodial wallet to an external
// Polygon address. Requires passkey/PIN unlock of the custodial wallet.
// A 2% fee is collected in USDC to the platform fee wallet.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  getOrCreateWalletBalance, updateBalance, getUsdcContract, getProvider,
  calculateFee, PLATFORM_FEE_WALLET, USDC_CONTRACT_ADDRESS,
} from '../../shared/walletEscrow.ts';
import { decryptPrivateKey, verifyPin } from '../../shared/walletCrypto.ts';
import { verifyWalletPasskey } from '../../shared/webauthn.ts';
import { ethers } from 'npm:ethers@6.13.4';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { to_address, usdc_wei, unlockCredential, pin, token, amount_wei } = body;
    const isPulse = token === 'pulse';
    const transferAmount = isPulse ? (amount_wei || usdc_wei) : usdc_wei;
    if (!to_address || !ethers.isAddress(to_address)) {
      return Response.json({ error: 'Invalid recipient address' }, { status: 400 });
    }
    if (!transferAmount || BigInt(transferAmount) <= 0n) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Read the user's default wallet preference
    const settingsList = await base44.asServiceRole.entities.SettingsConfig
      .filter({ did }, '-updated_date', 1).catch(() => []);
    const defaultWalletPref = settingsList[0]?.config?.wallet?.default_wallet || 'custodial';

    // --- ERC-20 $PULSE token transfer on PulseChain ---
    // PULSE is an ERC-20 token (PulseToken contract), NOT native PLS gas coin.
    // This matches execute-conversion, which disburses PULSE as ERC-20 tokens.
    // Native PLS is only for gas; the user's custodial wallet is auto-funded
    // with a small PLS stipend if needed before the transfer.
    if (isPulse) {
      if (defaultWalletPref === 'linked') {
        return Response.json({
          error: 'Sending $PULSE from a linked wallet requires switching your browser wallet to PulseChain. Use a custodial wallet for $PULSE sends.',
        }, { status: 400 });
      }

      const wallets = await base44.asServiceRole.entities.CustodialWallet
        .filter({ did, active: true }, '-created_date', 1).catch(() => []);
      if (!wallets.length) return Response.json({ error: 'No active wallet found' }, { status: 400 });
      const wallet = wallets[0];

      const pulseAmount = BigInt(transferAmount);
      const fee = calculateFee(pulseAmount);
      const totalDebit = pulseAmount + fee;

      // Resolve PulseChain clients
      let pulseProvider, getPulseTokenContract, ensurePulseGasFunds, pulseTreasuryAddress;
      try {
        const pulse = await import('../../shared/pulseClient.ts');
        pulseProvider = pulse.getPulseProvider();
        getPulseTokenContract = pulse.getPulseTokenContract;
        ensurePulseGasFunds = pulse.ensurePulseGasFunds;
        pulseTreasuryAddress = pulse.getPulseMintWallet().address;
      } catch {
        return Response.json({ error: 'PulseChain RPC not configured' }, { status: 400 });
      }

      // Check ERC-20 PULSE token balance (not native PLS)
      const tokenContract = getPulseTokenContract(pulseProvider);
      const tokenBalance = await tokenContract.balanceOf(wallet.wallet_address).catch(() => 0n);
      if (tokenBalance < totalDebit) {
        return Response.json({ error: 'Insufficient PULSE token balance for amount + fee' }, { status: 400 });
      }

      // Unlock the wallet (passkey or PIN)
      let privateKey: string;
      if (unlockCredential) {
        const { assertion, challenge, challenge_signature } = unlockCredential;
        if (!assertion || !challenge || !challenge_signature) {
          return Response.json({ error: 'Missing unlock credentials' }, { status: 400 });
        }
        const result = await verifyWalletPasskey(req, base44.asServiceRole, user.id, assertion, challenge, challenge_signature);
        if (!result.verified) return Response.json({ error: result.error }, { status: result.status });
        privateKey = await decryptPrivateKey(wallet);
      } else if (pin) {
        const pinValid = await verifyPin(wallet, pin);
        if (!pinValid) return Response.json({ error: 'Invalid PIN' }, { status: 403 });
        privateKey = await decryptPrivateKey(wallet, pin);
      } else {
        return Response.json({
          requiresUnlock: true,
          hasPasskey: wallet.has_passkey,
          hasPin: wallet.has_pin,
        });
      }

      // Ensure the user's custodial wallet has native PLS for gas before the
      // ERC-20 transfer. The treasury auto-funds a small stipend if needed.
      try {
        await ensurePulseGasFunds(wallet.wallet_address);
      } catch (e) {
        console.error('PULSE gas stipend failed:', (e as any)?.message);
        // Continue — the user may already have enough gas
      }

      // Send ERC-20 PULSE tokens to the recipient
      const userWallet = new ethers.Wallet(privateKey, pulseProvider);
      const userTokenContract = getPulseTokenContract(userWallet);
      const sendTx = await userTokenContract.transfer(to_address, pulseAmount);
      await sendTx.wait();

      // Send 2% fee as ERC-20 PULSE to the PulseChain treasury wallet (not the
      // Polygon PLATFORM_FEE_WALLET, which is on a different chain)
      let feeTxHash = '';
      try {
        const feeTx = await userTokenContract.transfer(pulseTreasuryAddress, fee);
        await feeTx.wait();
        feeTxHash = feeTx.hash;
      } catch (e) {
        console.error('PULSE fee transfer failed:', (e as any)?.message);
      }

      // Record the transfer
      await base44.entities.CryptoTransfer.create({
        did,
        transfer_type: 'send',
        from_address: wallet.wallet_address,
        to_address,
        amount_wei: pulseAmount.toString(),
        fee_wei: fee.toString(),
        tx_hash: sendTx.hash,
        fee_tx_hash: feeTxHash,
        status: 'confirmed',
        description: `Sent PULSE to ${to_address.slice(0, 8)}…${to_address.slice(-6)}`,
      });

      await base44.asServiceRole.entities.FeeLedger.create({
        fee_source: 'send',
        source_did: did,
        original_amount_wei: pulseAmount.toString(),
        fee_usdc_wei: fee.toString(),
        fee_tx_hash: feeTxHash,
        swept: !!feeTxHash,
        swept_at: feeTxHash ? new Date().toISOString() : undefined,
      });

      return Response.json({
        success: true,
        tx_hash: sendTx.hash,
        fee_tx_hash: feeTxHash,
        fee_wei: fee.toString(),
        token: 'pulse',
      });
    }

    // If the default wallet is a linked (external/hardware) wallet, the send
    // must be signed client-side (MetaMask/Ledger) — we can't decrypt a private
    // key we don't hold. Return the transaction details for the frontend to sign.
    if (defaultWalletPref === 'linked') {
      const links = await base44.asServiceRole.entities.WalletLink.filter({ did, active: true }).catch(() => []);
      if (!links.length) return Response.json({ error: 'No linked wallet found' }, { status: 400 });
      const linkedWallet = links[0];

      // If the client already signed and broadcast, record the transfer.
      if (body.client_tx_hash) {
        // Verify the client-signed tx actually exists on-chain and was sent
        // from the linked wallet — prevents fabricated transfer/fee records.
        const provider = getProvider();
        const receipt = await provider.getTransactionReceipt(body.client_tx_hash).catch(() => null);
        if (!receipt || receipt.status !== 1) {
          return Response.json({ error: 'Transaction not found or failed on-chain' }, { status: 400 });
        }
        if (receipt.from.toLowerCase() !== linkedWallet.wallet_address.toLowerCase()) {
          return Response.json({ error: 'Transaction was not sent from your linked wallet' }, { status: 400 });
        }
        const amountWei = BigInt(usdc_wei);
        const feeWei = calculateFee(amountWei);
        await base44.entities.CryptoTransfer.create({
          did,
          transfer_type: 'send',
          from_address: linkedWallet.wallet_address,
          to_address,
          amount_wei: amountWei.toString(),
          fee_wei: feeWei.toString(),
          tx_hash: body.client_tx_hash,
          fee_tx_hash: body.client_fee_tx_hash || '',
          status: 'confirmed',
          description: `Sent USDC to ${to_address.slice(0, 8)}…${to_address.slice(-6)}`,
        });
        await base44.asServiceRole.entities.FeeLedger.create({
          fee_source: 'send',
          source_did: did,
          original_amount_wei: amountWei.toString(),
          fee_usdc_wei: feeWei.toString(),
          fee_tx_hash: body.client_fee_tx_hash || '',
          swept: !!body.client_fee_tx_hash,
          swept_at: body.client_fee_tx_hash ? new Date().toISOString() : undefined,
        });
        return Response.json({ success: true, tx_hash: body.client_tx_hash, fee_tx_hash: body.client_fee_tx_hash || '' });
      }

      // Return the transaction details for client-side signing
      return Response.json({
        requiresClientSign: true,
        from_address: linkedWallet.wallet_address,
        to_address,
        amount_wei: usdc_wei,
        fee_wei: calculateFee(BigInt(usdc_wei)).toString(),
        usdc_contract_address: USDC_CONTRACT_ADDRESS,
        platform_fee_wallet: PLATFORM_FEE_WALLET,
        hardware: linkedWallet.hardware,
        wallet_type: linkedWallet.wallet_type,
      });
    }

    // Get the user's custodial wallet
    const wallets = await base44.asServiceRole.entities.CustodialWallet
      .filter({ did, active: true }, '-created_date', 1).catch(() => []);
    if (!wallets.length) return Response.json({ error: 'No active wallet found' }, { status: 400 });
    const wallet = wallets[0];

    // Check balance
    const balance = await getOrCreateWalletBalance(base44, did, wallet.wallet_address);
    const amountWei = BigInt(usdc_wei);
    const feeWei = calculateFee(amountWei);
    const totalDebit = amountWei + feeWei;

    if (BigInt(balance.usdc_wei || '0') < totalDebit) {
      return Response.json({ error: 'Insufficient USDC for amount + fee' }, { status: 400 });
    }

    // Unlock the wallet
    let privateKey: string;
    if (unlockCredential) {
      const { assertion, challenge, challenge_signature } = unlockCredential;
      if (!assertion || !challenge || !challenge_signature) {
        return Response.json({ error: 'Missing unlock credentials' }, { status: 400 });
      }
      const result = await verifyWalletPasskey(req, base44.asServiceRole, user.id, assertion, challenge, challenge_signature);
      if (!result.verified) return Response.json({ error: result.error }, { status: result.status });
      privateKey = await decryptPrivateKey(wallet);
    } else if (pin) {
      const pinValid = await verifyPin(wallet, pin);
      if (!pinValid) return Response.json({ error: 'Invalid PIN' }, { status: 403 });
      privateKey = await decryptPrivateKey(wallet, pin);
    } else {
      return Response.json({
        requiresUnlock: true,
        hasPasskey: wallet.has_passkey,
        hasPin: wallet.has_pin,
      });
    }

    // Execute the on-chain transfers
    const userWallet = new ethers.Wallet(privateKey, getProvider());
    const contract = getUsdcContract(userWallet);

    // Send USDC to recipient
    const sendTx = await contract.transfer(to_address, amountWei);
    await sendTx.wait();

    // Send fee to platform fee wallet
    let feeTxHash = '';
    try {
      const feeTx = await contract.transfer(PLATFORM_FEE_WALLET, feeWei);
      await feeTx.wait();
      feeTxHash = feeTx.hash;
    } catch (e) {
      console.error('Fee transfer failed:', (e as any)?.message);
    }

    // Debit balance
    await updateBalance(base44, balance.id, {
      usdc_wei: (BigInt(balance.usdc_wei || '0') - totalDebit).toString(),
      total_fees_paid_wei: (BigInt(balance.total_fees_paid_wei || '0') + feeWei).toString(),
    });

    // Record the transfer
    await base44.entities.CryptoTransfer.create({
      did,
      transfer_type: 'send',
      from_address: wallet.wallet_address,
      to_address,
      amount_wei: amountWei.toString(),
      fee_wei: feeWei.toString(),
      tx_hash: sendTx.hash,
      status: 'confirmed',
      description: `Sent USDC to ${to_address.slice(0, 8)}…${to_address.slice(-6)}`,
    });

    // Record fee in ledger
    await base44.asServiceRole.entities.FeeLedger.create({
      fee_source: 'send',
      source_did: did,
      original_amount_wei: amountWei.toString(),
      fee_usdc_wei: feeWei.toString(),
      fee_tx_hash: feeTxHash,
      swept: !!feeTxHash,
      swept_at: feeTxHash ? new Date().toISOString() : undefined,
    });

    return Response.json({
      success: true,
      tx_hash: sendTx.hash,
      fee_tx_hash: feeTxHash,
      fee_wei: feeWei.toString(),
    });
  } catch (error: any) {
    console.error('send-crypto error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}