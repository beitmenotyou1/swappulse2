// convert-token — converts the user's highest-value Polygon token to USDC.
// The system identifies the token with the highest USD value in the user's
// custodial wallet and swaps it to USDC via a platform swap (sending the token
// to the platform reserve and crediting USDC from the reserve). A 2% fee is
// collected. Requires passkey/PIN unlock.
//
// In production this would use a DEX aggregator (1inch, 0x); for now the
// platform acts as the liquidity provider at a 1:1 value rate.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import {
  getOrCreateWalletBalance, updateBalance, getProvider, getUsdcContract,
  calculateFee, creditUsdcFromReserve, sweepFeeToPlatformWallet, USDC_CONTRACT_ADDRESS,
} from '../../shared/walletEscrow.ts';
import { decryptPrivateKey, verifyPin } from '../../shared/walletCrypto.ts';
import { verifySignedChallenge } from '../../shared/webauthn.ts';
import { verifyAuthenticationResponse } from 'npm:@simplewebauthn/server@10';

const ERC20_BALANCE_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address, uint256) returns (bool)',
];

// Server-side allowlist of ERC20 token contract addresses that may be
// converted to USDC via this endpoint. The platform credits real USDC from
// its reserve wallet in exchange for the user's tokens, so accepting an
// arbitrary user-supplied token_address would let an attacker mint a
// worthless custom token and drain the reserve. Only tokens listed here
// are accepted; the list is intentionally empty by default (fail-closed)
// until a proper price oracle / DEX aggregator is integrated. Add supported
// token addresses (lowercased) when oracle-backed valuation is available.
const SUPPORTED_TOKEN_ADDRESSES: ReadonlySet<string> = new Set([
  // e.g. '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // USDC.e
  // e.g. '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // USDC (native)
]);

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { token_address, unlockCredential, pin } = body;
    if (!token_address || !ethers.isAddress(token_address)) {
      return Response.json({ error: 'Invalid token address' }, { status: 400 });
    }
    if (token_address.toLowerCase() === USDC_CONTRACT_ADDRESS.toLowerCase()) {
      return Response.json({ error: 'Token is already USDC' }, { status: 400 });
    }
    // Security: only tokens in the server-side allowlist may be converted.
    // Without this check an attacker could create a worthless custom ERC20,
    // mint a large balance, and drain the platform's USDC reserve at the
    // 1:1 exchange rate assumed below.
    if (!SUPPORTED_TOKEN_ADDRESSES.has(token_address.toLowerCase())) {
      return Response.json({ error: 'This token is not supported for conversion.' }, { status: 403 });
    }

    // Get the user's custodial wallet
    const wallets = await base44.asServiceRole.entities.CustodialWallet
      .filter({ did, active: true }, '-created_date', 1).catch(() => []);
    if (!wallets.length) return Response.json({ error: 'No active wallet found' }, { status: 400 });
    const wallet = wallets[0];

    // Unlock the wallet
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
      return Response.json({
        requiresUnlock: true,
        hasPasskey: wallet.has_passkey,
        hasPin: wallet.has_pin,
      });
    }

    const provider = getProvider();
    const userWallet = new ethers.Wallet(privateKey, provider);

    // Get the token balance
    const tokenContract = new ethers.Contract(token_address, ERC20_BALANCE_ABI, provider);
    const tokenBalance = await tokenContract.balanceOf(wallet.wallet_address);
    if (tokenBalance === 0n) {
      return Response.json({ error: 'No balance of this token' }, { status: 400 });
    }

    const tokenDecimals = await tokenContract.decimals();
    const tokenSymbol = await tokenContract.symbol().catch(() => 'UNKNOWN');

    // Convert token to USDC equivalent (1:1 at same decimals for now)
    // In production this would use a price oracle + DEX swap
    const usdcEquivalentWei = tokenDecimals >= 6
      ? tokenBalance / (10n ** BigInt(tokenDecimals - 6))
      : tokenBalance * (10n ** BigInt(6 - tokenDecimals));

    const feeWei = calculateFee(usdcEquivalentWei);
    const netUsdcWei = usdcEquivalentWei - feeWei;

    // Transfer the token from user's wallet to the platform reserve
    const platformWallet = new ethers.Wallet(
      (await import('base44:runtime')).secrets.get('POLYGON_PRIVATE_KEY'),
      provider,
    );
    const userTokenContract = new ethers.Contract(token_address, ERC20_BALANCE_ABI, userWallet);
    const tokenTx = await userTokenContract.transfer(platformWallet.address, tokenBalance);
    await tokenTx.wait();

    // Credit USDC from the platform reserve to the user's wallet
    let creditTxHash = '';
    let feeTxHash = '';
    try {
      const creditResult = await creditUsdcFromReserve(wallet.wallet_address, netUsdcWei);
      creditTxHash = creditResult.txHash;
    } catch (e) {
      return Response.json({ error: 'USDC credit failed: ' + (e as any)?.message }, { status: 500 });
    }

    try {
      const feeResult = await sweepFeeToPlatformWallet(feeWei);
      feeTxHash = feeResult.txHash;
    } catch (e) {
      console.error('Fee sweep failed:', (e as any)?.message);
    }

    // Update balance
    const balance = await getOrCreateWalletBalance(base44, did, wallet.wallet_address);
    await updateBalance(base44, balance.id, {
      usdc_wei: (BigInt(balance.usdc_wei || '0') + netUsdcWei).toString(),
      total_fees_paid_wei: (BigInt(balance.total_fees_paid_wei || '0') + feeWei).toString(),
    });

    // Record the transfer
    await base44.entities.CryptoTransfer.create({
      did,
      transfer_type: 'token_convert',
      from_address: wallet.wallet_address,
      to_address: wallet.wallet_address,
      amount_wei: netUsdcWei.toString(),
      fee_wei: feeWei.toString(),
      tx_hash: creditTxHash,
      status: 'confirmed',
      description: `Converted ${tokenSymbol} to USDC`,
    });

    // Record fee in ledger
    await base44.asServiceRole.entities.FeeLedger.create({
      fee_source: 'token_convert',
      source_did: did,
      original_amount_wei: usdcEquivalentWei.toString(),
      fee_usdc_wei: feeWei.toString(),
      fee_tx_hash: feeTxHash,
      swept: !!feeTxHash,
      swept_at: feeTxHash ? new Date().toISOString() : undefined,
    });

    return Response.json({
      success: true,
      token_symbol: tokenSymbol,
      token_amount: tokenBalance.toString(),
      usdc_credited_wei: netUsdcWei.toString(),
      fee_wei: feeWei.toString(),
      tx_hash: creditTxHash,
      fee_tx_hash: feeTxHash,
    });
  } catch (error: any) {
    console.error('convert-token error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}