import React, { useState, useEffect, useCallback } from 'react';
import { Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Building2, History, Loader2, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCryptoEnabled } from '@/hooks/useCryptoEnabled';
import PageHeader from '@/components/PageHeader';
import BalanceCards from '@/components/wallet/BalanceCards';
import TopUpModal from '@/components/wallet/TopUpModal';
import SendCryptoModal from '@/components/wallet/SendCryptoModal';
import ReceiveModal from '@/components/wallet/ReceiveModal';
import ConvertModal from '@/components/wallet/ConvertModal';
import RefundModal from '@/components/wallet/RefundModal';
import TransactionHistory from '@/components/wallet/TransactionHistory';
import BankAccountSection from '@/components/wallet/BankAccountSection';
import EscrowTradeList from '@/components/wallet/EscrowTradeList';
import useSEO from '@/hooks/useSEO';

export default function Wallet() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { cryptoEnabled } = useCryptoEnabled();
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [showRefund, setShowRefund] = useState(false);

  useSEO({
    title: 'Wallet',
    description: 'Manage your SwapPulse wallet: top up, send, receive, and convert between fiat and USDC.',
    canonicalPath: '/wallet',
  });

  const userDid = user?.data?.did || user?.did;

  const loadWallet = useCallback(async () => {
    if (!userDid) { setLoading(false); return; }
    try {
      const res = await base44.functions.invoke('get-wallet-balance', {});
      setWalletData(res.data);
    } catch (e) {
      console.error('Wallet load error:', e);
    } finally {
      setLoading(false);
    }
  }, [userDid]);

  useEffect(() => { loadWallet(); }, [loadWallet]);

  const formatFiat = (cents, currency = 'GBP') =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format((cents || 0) / 100);

  const formatUsdc = (wei) => {
    const usdc = Number(BigInt(wei || '0')) / 1_000_000;
    return usdc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Wallet" subtitle="Manage your funds" />
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  const hasWallet = !!walletData?.custodial_wallet;
  const balance = walletData?.balance;

  return (
    <div>
      <PageHeader title="Wallet" subtitle="Top up, send, receive, and convert your funds" />

      {/* Balance Cards */}
      <BalanceCards
        balance={balance}
        cryptoEnabled={cryptoEnabled}
        onChainUsdcWei={walletData?.on_chain_usdc_wei}
        formatFiat={formatFiat}
        formatUsdc={formatUsdc}
      />

      {/* Action Buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => setShowTopUp(true)}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary/90 transition-colors"
        >
          <ArrowDownToLine className="h-4 w-4" /> Top Up
        </button>
        {cryptoEnabled && hasWallet && (
          <>
            <button
              onClick={() => setShowSend(true)}
              className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary transition-colors"
            >
              <ArrowUpFromLine className="h-4 w-4" /> Send
            </button>
            <button
              onClick={() => setShowReceive(true)}
              className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary transition-colors"
            >
              <ArrowDownToLine className="h-4 w-4" /> Receive
            </button>
            <button
              onClick={() => setShowConvert(true)}
              className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Convert
            </button>
          </>
        )}
        {balance && balance.fiat_cents > 0 && (
          <button
            onClick={() => setShowRefund(true)}
            className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary transition-colors"
          >
            <RotateCcw className="h-4 w-4" /> Refund
          </button>
        )}
      </div>

      {/* Bank Account Section (crypto off) */}
      {!cryptoEnabled && (
        <div className="mt-6">
          <BankAccountSection bankAccount={walletData?.bank_account} onUpdated={loadWallet} />
        </div>
      )}

      {/* No wallet CTA (crypto on but no custodial wallet) */}
      {cryptoEnabled && !hasWallet && (
        <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <WalletIcon className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-bold">Create a Wallet to Enable Crypto Features</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            You need a SwapPulse custodial wallet to send, receive, and hold USDC. Go to Settings → Polygon to create one.
          </p>
        </div>
      )}

      {/* Active Escrow Trades */}
      {hasWallet && (
        <div className="mt-6">
          <EscrowTradeList userDid={userDid} onUpdated={loadWallet} />
        </div>
      )}

      {/* Transaction History */}
      <div className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-bold">Transaction History</h2>
        </div>
        <TransactionHistory transfers={walletData?.transfers || []} topups={walletData?.topups || []} formatFiat={formatFiat} formatUsdc={formatUsdc} />
      </div>

      {/* Modals */}
      {showTopUp && (
        <TopUpModal onClose={() => { setShowTopUp(false); loadWallet(); }} />
      )}
      {showSend && (
        <SendCryptoModal wallet={walletData?.custodial_wallet} onClose={() => { setShowSend(false); loadWallet(); }} />
      )}
      {showReceive && (
        <ReceiveModal walletAddress={walletData?.custodial_wallet?.address} onClose={() => setShowReceive(false)} />
      )}
      {showConvert && (
        <ConvertModal balance={balance} wallet={walletData?.custodial_wallet} onClose={() => { setShowConvert(false); loadWallet(); }} />
      )}
      {showRefund && (
        <RefundModal balance={balance} topups={walletData?.topups || []} onClose={() => { setShowRefund(false); loadWallet(); }} />
      )}
    </div>
  );
}