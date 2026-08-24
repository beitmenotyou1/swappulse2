// get-wallet-balance — returns the user's wallet balance, recent
// transactions, bank account (masked), and top-up history. Used by the
// Wallet page to render all wallet state in one call.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    // Get custodial wallet
    const wallets = await base44.entities.CustodialWallet
      .filter({ did, active: true }, '-created_date', 1).catch(() => []);
    const custodialWallet = wallets[0] || null;

    // Get wallet balance
    let balance = null;
    if (custodialWallet) {
      const balances = await base44.entities.WalletBalance
        .filter({ did }, '-created_date', 1).catch(() => []);
      balance = balances[0] || null;
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

    // Get on-chain USDC balance from the custodial wallet
    let onChainUsdcWei = '0';
    if (custodialWallet) {
      try {
        const { getProvider, getUsdcContract } = await import('../../shared/walletEscrow.ts');
        const provider = getProvider();
        const contract = getUsdcContract(provider);
        const onChainBalance = await contract.balanceOf(custodialWallet.wallet_address);
        onChainUsdcWei = onChainBalance.toString();
      } catch {}
    }

    return Response.json({
      balance: balance ? {
        fiat_cents: balance.fiat_cents || 0,
        usdc_wei: balance.usdc_wei || '0',
        currency: balance.currency || 'GBP',
        total_topup_cents: balance.total_topup_cents || 0,
        total_fees_paid_wei: balance.total_fees_paid_wei || '0',
      } : null,
      custodial_wallet: custodialWallet ? {
        address: custodialWallet.wallet_address,
        has_passkey: custodialWallet.has_passkey,
        has_pin: custodialWallet.has_pin,
      } : null,
      on_chain_usdc_wei: onChainUsdcWei,
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