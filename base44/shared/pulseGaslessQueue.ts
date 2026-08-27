// Shared logic for queueing a PulseChain gasless $PULSE transfer. Called by
// the queue-pulse-gasless-transfer backend function and by send-crypto (when
// the gasless path is selected). Decrypts the custodial wallet key, ensures
// the relay is approved to spend $PULSE (one-time), signs an EIP-712
// meta-transaction intent, and creates a pending MetaTransaction record for
// the scheduled processor to relay on-chain. The user's wallet never needs
// native PLS gas after the one-time approve — the treasury relayer pays.

import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import { getPulseProvider, getPulseTokenContract, ensurePulseGasFunds } from './pulseClient.ts';
import {
  getPulseRelayAddress,
  signPulseGaslessIntent,
  PULSE_GASLESS_RELAY_ABI,
} from './pulseGaslessRelay.ts';
import { decryptPrivateKey, verifyPin } from './walletCrypto.ts';
import { verifyWalletPasskey } from './webauthn.ts';

export async function queuePulseGaslessTransfer(
  base44: any,
  req: Request,
  user: any,
  body: any,
): Promise<Response> {
  const did = user.data?.did || user.did;
  if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

  const { to_address, amount_wei, unlockCredential, pin } = body;
  if (!to_address || !ethers.isAddress(to_address)) {
    return Response.json({ error: 'Invalid recipient' }, { status: 400 });
  }
  const amount = BigInt(amount_wei || 0);
  if (amount <= 0n) return Response.json({ error: 'Invalid amount' }, { status: 400 });

  // Gasless service is unavailable until an admin deploys the relay.
  const relayAddress = await getPulseRelayAddress(base44.asServiceRole);
  if (!relayAddress) {
    return Response.json(
      { error: 'Gasless relay not deployed. An admin must run deploy-pulse-relay first.' },
      { status: 503 },
    );
  }

  const wallets = await base44.asServiceRole.entities.CustodialWallet
    .filter({ did, active: true }, '-created_date', 1).catch(() => []);
  if (!wallets.length) return Response.json({ error: 'No active custodial wallet' }, { status: 400 });
  const wallet = wallets[0];

  // Unlock (passkey or PIN) — mirrors send-crypto's custodial unlock.
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
    return Response.json({ requiresUnlock: true, hasPasskey: wallet.has_passkey, hasPin: wallet.has_pin });
  }

  const provider = getPulseProvider();
  const userAddress = wallet.wallet_address;
  const userWallet = new ethers.Wallet(privateKey, provider);
  const tokenContract = getPulseTokenContract(provider);
  const relay = new ethers.Contract(relayAddress, PULSE_GASLESS_RELAY_ABI, provider);

  const tokenBalance = await tokenContract.balanceOf(userAddress).catch(() => 0n);
  if (tokenBalance < amount) {
    return Response.json({ error: 'Insufficient PULSE balance' }, { status: 400 });
  }

  // One-time approve: the relay calls transferFrom, so it needs allowance. The
  // approve tx needs a tiny PLS stipend (funded by the treasury); after this,
  // all future transfers are gasless (the relay pays gas, not the user).
  const allowance = await tokenContract.allowance(userAddress, relayAddress).catch(() => 0n);
  if (allowance < amount) {
    try { await ensurePulseGasFunds(userAddress); } catch (e) { /* may already have gas */ }
    const approveTx = await getPulseTokenContract(userWallet).approve(relayAddress, ethers.MaxUint256);
    await approveTx.wait();
  }

  const [nonce, network] = await Promise.all([
    relay.nonces(userAddress),
    provider.getNetwork(),
  ]);
  const chainId = network.chainId;

  const tokenAddress = secrets.get('PULSE_TOKEN_CONTRACT');
  const tokenIface = new ethers.Interface(['function transferFrom(address from, address to, uint256 amount) returns (bool)']);
  const data = tokenIface.encodeFunctionData('transferFrom', [userAddress, to_address, amount]);

  const { signature } = await signPulseGaslessIntent({
    signer: userWallet,
    relayAddress,
    chainId,
    userAddress,
    targetContract: tokenAddress,
    data,
    nonce,
  });

  const metaTx = await base44.asServiceRole.entities.MetaTransaction.create({
    user_did: did,
    user_address: userAddress,
    target_contract: tokenAddress,
    function_name: 'transferFrom',
    args: { data, token: tokenAddress, from: userAddress, to: to_address, amount: amount.toString() },
    signature,
    nonce: Number(nonce),
    status: 'pending',
    chain: 'pulse',
  });

  return Response.json({ success: true, meta_tx_id: metaTx.id, status: 'pending', nonce: Number(nonce) });
}