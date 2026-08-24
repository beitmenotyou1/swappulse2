// get-wallet-balance — returns the user's multi-chain wallet state: per-chain
// native + USDC balances, fiat balance, recent transfers, top-up history,
// bank account (masked), and wallet addresses for all chains. Used by the
// Wallet page to render all state in one call. Falls back to legacy
// CustodialWallet (Polygon-only) if no MultiChainWallet exists.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  getAllChainBalances, getChainConfig, formatNativeBalance, SUPPORTED_CHAINS,
} from '../../shared/multiChain.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    // Prefer MultiChainWallet, fall back to CustodialWallet
    const mcWallets = await base44.entities.MultiChainWallet
      .filter({ did, active: true }, '-created_date', 1).catch(() => []);
    const multiChainWallet = mcWallets[0] || null;

    let custodialWallet = null;
    if (!multiChainWallet) {
      const legacy = await base44.entities.CustodialWallet
        .filter({ did, active: true }, '-created_date', 1).catch(() => []);
      custodialWallet = legacy[0] || null;
    }

    const hasWallet = !!(multiChainWallet || custodialWallet);

    // Get wallet balance record
    const walletAddress = multiChainWallet?.evm_address || custodialWallet?.wallet_address || '';
    let balance = null;
    if (hasWallet) {
      const balances = await base44.entities.WalletBalance
        .filter({ did }, '-created_date', 1).catch(() => []);
      balance = balances[0] || null;
    }

    // Query multi-chain balances
    let chainBalances: any[] = [];
    let chainAddresses: any = {};
    if (multiChainWallet) {
      chainAddresses = {
        evm: multiChainWallet.evm_address,
        solana: multiChainWallet.solana_address || '',
        bitcoin: multiChainWallet.bitcoin_address || '',
      };
      // Per-chain EVM addresses (same key, different chains)
      for (const chain of SUPPORTED_CHAINS) {
        if (chain.type === 'evm') {
          chainAddresses[chain.key] = multiChainWallet.evm_address;
        }
      }
      chainBalances = await getAllChainBalances(
        multiChainWallet.evm_address,
        multiChainWallet.solana_address || undefined,
        multiChainWallet.bitcoin_address || undefined,
      );
    } else if (custodialWallet) {
      chainAddresses = { evm: custodialWallet.wallet_address, polygon: custodialWallet.wallet_address };
      // Legacy: only Polygon
      const { getEvmBalances } = await import('../../shared/multiChain.ts');
      const polyBal = await getEvmBalances('polygon', custodialWallet.wallet_address);
      chainBalances = [{
        chain: 'polygon',
        native: polyBal.native,
        nativeSymbol: 'POL',
        nativeDecimals: 18,
        usdc: polyBal.usdc,
      }];
    }

    // Update chain_balances on the WalletBalance record (best-effort)
    if (balance && chainBalances.length) {
      const chainMap: any = {};
      for (const cb of chainBalances) {
        chainMap[cb.chain] = {
          native_wei: cb.native,
          usdc_wei: cb.usdc || '0',
        };
      }
      try {
        await base44.entities.WalletBalance.update(balance.id, {
          chain_balances: chainMap,
          last_updated_at: new Date().toISOString(),
        });
      } catch {}
    }

    // Get recent transfers
    const transfers = await base44.entities.CryptoTransfer
      .filter({ did }, '-created_date', 20).catch(() => []);

    // Get top-up history
    const topups = await base44.entities.FiatTopUp
      .filter({ did }, '-created_date', 20).catch(() => []);

    // Get bank account (masked)
    const bankAccounts = await base44.entities.BankAccount
      .filter({ did, active: true }, '-created_date', 1).catch(() => []);
    const bankAccount = bankAccounts[0] || null;

    // Get receive allowlist count
    const allowlistCount = await base44.entities.ReceiveAllowlist
      .filter({ did }).catch(() => []);
    const allowlistedAddresses = (allowlistCount || []).map((a: any) => a.address);

    return Response.json({
      balance: balance ? {
        fiat_cents: balance.fiat_cents || 0,
        usdc_wei: balance.usdc_wei || '0',
        currency: balance.currency || 'GBP',
        total_topup_cents: balance.total_topup_cents || 0,
        total_fees_paid_wei: balance.total_fees_paid_wei || '0',
        default_chain: balance.default_chain || 'polygon',
        receive_strict_mode: balance.receive_strict_mode || false,
        chain_balances: balance.chain_balances || {},
      } : null,
      multi_chain_wallet: multiChainWallet ? {
        id: multiChainWallet.id,
        evm_address: multiChainWallet.evm_address,
        solana_address: multiChainWallet.solana_address || '',
        bitcoin_address: multiChainWallet.bitcoin_address || '',
        has_passkey: multiChainWallet.has_passkey,
        has_pin: multiChainWallet.has_pin,
      } : null,
      custodial_wallet: custodialWallet ? {
        address: custodialWallet.wallet_address,
        has_passkey: custodialWallet.has_passkey,
        has_pin: custodialWallet.has_pin,
      } : null,
      chain_addresses: chainAddresses,
      chain_balances: chainBalances,
      allowlisted_addresses: allowlistedAddresses,
      transfers: transfers || [],
      topups: topups || [],
      bank_account: bankAccount ? {
        iban_masked: bankAccount.iban_masked,
        bic_masked: bankAccount.bic_masked,
        account_holder_name: bankAccount.account_holder_name,
        bank_name: bankAccount.bank_name,
      } : null,
    });
  } catch (error: any) {
    console.error('get-wallet-balance error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}