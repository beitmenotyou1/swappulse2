import React, { useState, useEffect, useCallback } from 'react';
import { Wallet as WalletIcon, History, Package, Settings as SettingsIcon, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCryptoEnabled } from '@/hooks/useCryptoEnabled';
import { useSettings } from '@/hooks/useSettings';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import PageHeader from '@/components/PageHeader';
import TotalBalanceCard from '@/components/wallet/TotalBalanceCard';
import AssetList from '@/components/wallet/AssetList';
import ChainSwitcher from '@/components/wallet/ChainSwitcher';
import TopUpModal from '@/components/wallet/TopUpModal';
import SendCryptoModal from '@/components/wallet/SendCryptoModal';
import ReceiveModal from '@/components/wallet/ReceiveModal';
import ConvertModal from '@/components/wallet/ConvertModal';
import RefundModal from '@/components/wallet/RefundModal';
import TransactionHistory from '@/components/wallet/TransactionHistory';
import BankAccountSection from '@/components/wallet/BankAccountSection';
import EscrowTradeList from '@/components/wallet/EscrowTradeList';
import LowBalanceAlertCard from '@/components/wallet/LowBalanceAlertCard';
import WalletTrendsChart from '@/components/wallet/WalletTrendsChart';
import ReceiveAllowlistSection from '@/components/wallet/ReceiveAllowlistSection';
import useSEO from '@/hooks/useSEO';

const TABS = [
  { key: 'assets', label: 'Assets', icon: WalletIcon },
  { key: 'activity', label: 'Activity', icon: History },
  { key: 'escrows', label: 'Escrows', icon: Package },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function Wallet() {
  const { user } = useAuth();
  const { cryptoEnabled } = useCryptoEnabled();
  const { settings } = useSettings();
  const { prices } = useCryptoPrices();
  const displayCurrency = settings?.crypto?.display_currency || 'USDC';
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assets');
  const [selectedChain, setSelectedChain] = useState('all');
  const [showTopUp, setShowTopUp] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [showRefund, setShowRefund] = useState(false);

  useSEO({
    title: 'Wallet',
    description: 'Manage your SwapPulse multi-chain wallet: top up, send, receive, and convert across Polygon, Ethereum, Solana, and Bitcoin.',
    canonicalPath: '/wallet',
  });

  const userDid = user?.data?.did || user?.did;
  const username = user?.bsky_handle || user?.username || '';

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

  const hasWallet = !!(walletData?.multi_chain_wallet || walletData?.custodial_wallet);
  const balance = walletData?.balance;
  const chainBalances = walletData?.chain_balances || [];
  const chainAddresses = walletData?.chain_addresses || {};

  const reloadAfterModal = () => {
    setShowTopUp(false); setShowSend(false); setShowReceive(false); setShowConvert(false); setShowRefund(false);
    loadWallet();
  };

  return (
    <div>
      <PageHeader title="Wallet" subtitle="Multi-chain · Send, receive, and convert" />

      <TotalBalanceCard
        balance={balance}
        chainBalances={chainBalances}
        cryptoEnabled={cryptoEnabled}
        formatFiat={formatFiat}
        formatUsdc={formatUsdc}
        onTopUp={() => setShowTopUp(true)}
        onSend={() => setShowSend(true)}
        onReceive={() => setShowReceive(true)}
        onConvert={() => setShowConvert(true)}
        onRefund={() => setShowRefund(true)}
        hasWallet={hasWallet}
        displayCurrency={displayCurrency}
        prices={prices}
      />

      <div className="mt-4 flex gap-1 rounded-xl border border-border bg-card p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition ${
              activeTab === tab.key
                ? 'bg-primary text-white'
                : 'text-muted-foreground hover:bg-secondary'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {activeTab === 'assets' && (
          <div className="space-y-4">
            {cryptoEnabled && hasWallet && (
              <ChainSwitcher selected={selectedChain} onSelect={setSelectedChain} />
            )}
            <AssetList
              balance={balance}
              chainBalances={chainBalances}
              cryptoEnabled={cryptoEnabled}
              chainAddresses={chainAddresses}
              formatFiat={formatFiat}
              formatUsdc={formatUsdc}
              displayCurrency={displayCurrency}
              prices={prices}
              selectedChain={selectedChain}
              hiddenCount={0}
            />
            {balance && (
              <LowBalanceAlertCard balance={balance} onUpdated={loadWallet} />
            )}
            {cryptoEnabled && !hasWallet && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <WalletIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-bold">Create a Multi-Chain Wallet</h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Generate a custodial wallet with addresses on Polygon, Ethereum, Arbitrum, Optimism, Base, Solana, and Bitcoin. Go to Settings → Wallet to create one.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-4">
            <WalletTrendsChart transfers={walletData?.transfers || []} topups={walletData?.topups || []} />
            <div>
              <div className="mb-3 flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-bold">Transaction History</h2>
              </div>
              <TransactionHistory
                transfers={walletData?.transfers || []}
                topups={walletData?.topups || []}
                formatFiat={formatFiat}
                formatUsdc={formatUsdc}
              />
            </div>
          </div>
        )}

        {activeTab === 'escrows' && hasWallet && (
          <EscrowTradeList userDid={userDid} onUpdated={loadWallet} />
        )}
        {activeTab === 'escrows' && !hasWallet && (
          <div className="py-12 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-semibold text-muted-foreground">No escrow trades yet</p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            {cryptoEnabled && hasWallet && (
              <ReceiveAllowlistSection
                allowlistedAddresses={walletData?.allowlisted_addresses || []}
                strictMode={balance?.receive_strict_mode || false}
                onUpdated={loadWallet}
              />
            )}
            {!cryptoEnabled && (
              <BankAccountSection bankAccount={walletData?.bank_account} onUpdated={loadWallet} />
            )}
            {balance && balance.fiat_cents > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-bold">Refund Balance</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Refund unused fiat top-ups back to your original payment method. Refundable: {formatFiat(balance.total_topup_cents || 0, balance?.currency || 'GBP')}
                </p>
                <button
                  onClick={() => setShowRefund(true)}
                  className="mt-3 rounded-full border border-border bg-secondary px-4 py-2 text-xs font-bold hover:bg-secondary/80"
                >
                  Request Refund
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showTopUp && <TopUpModal onClose={reloadAfterModal} />}
      {showSend && <SendCryptoModal wallet={walletData?.multi_chain_wallet || walletData?.custodial_wallet} chainAddresses={chainAddresses} onClose={reloadAfterModal} />}
      {showReceive && <ReceiveModal chainAddresses={chainAddresses} username={username} onClose={() => setShowReceive(false)} />}
      {showConvert && <ConvertModal balance={balance} wallet={walletData?.multi_chain_wallet || walletData?.custodial_wallet} onClose={reloadAfterModal} />}
      {showRefund && <RefundModal balance={balance} topups={walletData?.topups || []} onClose={reloadAfterModal} />}
    </div>
  );
}