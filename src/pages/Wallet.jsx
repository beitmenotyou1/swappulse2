import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet as WalletIcon, History, Package, Settings as SettingsIcon, Loader2, Image as ImageIcon, Globe as GlobeIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCryptoEnabled } from '@/hooks/useCryptoEnabled';
import { useSettings } from '@/hooks/useSettings';
import { useCryptoPrices, convertUsdcToDisplay } from '@/hooks/useCryptoPrices';
import PageHeader from '@/components/PageHeader';
import TotalBalanceCard from '@/components/wallet/TotalBalanceCard';
import AssetList from '@/components/wallet/AssetList';
import TopUpModal from '@/components/wallet/TopUpModal';
import PulseTokenCard from '@/components/wallet/PulseTokenCard';
import SendCryptoModal from '@/components/wallet/SendCryptoModal';
import RefundModal from '@/components/wallet/RefundModal';
import TransactionHistory from '@/components/wallet/TransactionHistory';
import BankAccountSection from '@/components/wallet/BankAccountSection';
import CryptoFeaturesSection from '@/components/settings/CryptoFeaturesSection';
import PolygonSettingsSection from '@/components/blockchain/PolygonSettingsSection';
import EscrowTradeList from '@/components/wallet/EscrowTradeList';
import LowBalanceAlertCard from '@/components/wallet/LowBalanceAlertCard';
import WalletTrendsChart from '@/components/wallet/WalletTrendsChart';
import NftPortfolioTab from '@/components/wallet/NftPortfolioTab';
import DappBrowserTab from '@/components/wallet/DappBrowserTab';
import ChainTabBar from '@/components/wallet/ChainTabBar';
import useSEO from '@/hooks/useSEO';

const TABS = [
  { key: 'assets', label: 'Assets', icon: WalletIcon },
  { key: 'nfts', label: 'NFTs', icon: ImageIcon },
  { key: 'activity', label: 'Activity', icon: History },
  { key: 'escrows', label: 'Escrows', icon: Package },
  { key: 'dapps', label: 'dApps', icon: GlobeIcon },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function Wallet() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cryptoEnabled } = useCryptoEnabled();
  const { settings, update } = useSettings();
  const { prices } = useCryptoPrices();
  const displayCurrency = settings?.crypto?.display_currency || 'USDC';
  const [walletData, setWalletData] = useState(null);
  const [chainBalances, setChainBalances] = useState([]);
  const [activeChain, setActiveChain] = useState('all');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assets');
  const [showTopUp, setShowTopUp] = useState(false);
  const [showSend, setShowSend] = useState(false);
  // Convert now navigates to the dedicated conversion page
  const [showRefund, setShowRefund] = useState(false);
  const [sendToken, setSendToken] = useState('usdc');

  useSEO({
    title: 'Wallet',
    description: 'Manage your SwapPulse wallet: top up, send, receive, and convert between fiat and USDC.',
    canonicalPath: '/wallet',
  });

  const userDid = user?.data?.did || user?.did;

  const loadWallet = useCallback(async () => {
    if (!userDid) { setLoading(false); return; }
    try {
      const [balanceRes, chainRes] = await Promise.all([
        base44.functions.invoke('get-wallet-balance', {}),
        base44.functions.invoke('get-multi-chain-balances', {}).catch(() => ({ data: { balances: [] } })),
      ]);
      setWalletData(balanceRes.data);
      setChainBalances(chainRes.data?.balances || []);
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
  const cryptoDisplay = cryptoEnabled && balance
    ? convertUsdcToDisplay(balance.usdc_wei, displayCurrency, prices)
    : null;

  const reloadAfterModal = () => {
    setShowTopUp(false); setShowSend(false); setShowRefund(false);
    loadWallet();
  };

  return (
    <div>
      <PageHeader title="Wallet" subtitle="Top up, send, receive, and convert your funds" />

      {/* $PULSE token — prominently displayed at the top */}
      {cryptoEnabled && walletData?.pulse && (
        <div className="mb-4">
          <PulseTokenCard
            pulse={walletData.pulse}
            pulsePrice={prices?.pulse}
            formatFiat={formatFiat}
            hasWallet={hasWallet}
            onSend={() => { setSendToken('pulse'); setShowSend(true); }}
          />
        </div>
      )}

      {/* Hero balance card with action buttons (MetaMask/Brave style) */}
      <TotalBalanceCard
        balance={balance}
        cryptoEnabled={cryptoEnabled}
        onChainUsdcWei={walletData?.on_chain_usdc_wei}
        formatFiat={formatFiat}
        formatUsdc={formatUsdc}
        onTopUp={() => setShowTopUp(true)}
        onSend={() => { setSendToken('usdc'); setShowSend(true); }}
        onReceive={() => navigate('/wallet/receive')}
        onConvert={() => navigate('/wallet/convert')}
        onRefund={() => setShowRefund(true)}
        hasWallet={hasWallet}
        cryptoDisplay={cryptoDisplay}
      />

      {/* Tab navigation */}
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

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === 'assets' && (
          <div className="space-y-4">
            {cryptoEnabled && chainBalances.length > 0 && (
              <ChainTabBar
                chains={chainBalances.filter(cb => parseFloat(cb.balance) > 0).map(cb => cb.chain)}
                activeChain={activeChain}
                onSelectChain={setActiveChain}
              />
            )}
            <AssetList
              balance={balance}
              cryptoEnabled={cryptoEnabled}
              onChainUsdcWei={walletData?.on_chain_usdc_wei}
              formatFiat={formatFiat}
              formatUsdc={formatUsdc}
              cryptoDisplay={cryptoDisplay}
              chainBalances={activeChain === 'all' ? chainBalances : chainBalances.filter(cb => cb.chain === activeChain)}
              cryptoPrices={prices}
              pulse={walletData?.pulse}
              pulsePrice={prices?.pulse}
            />
            {balance && (
              <LowBalanceAlertCard balance={balance} onUpdated={loadWallet} />
            )}
            {cryptoEnabled && !hasWallet && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <WalletIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-bold">Create a Wallet to Enable Crypto Features</h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  You need a SwapPulse custodial wallet to send, receive, and hold USDC. Go to the Settings tab to create one.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'nfts' && (
          <NftPortfolioTab />
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

        {activeTab === 'dapps' && (
          <DappBrowserTab walletAddress={walletData?.custodial_wallet?.address} />
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <CryptoFeaturesSection />

            {cryptoEnabled && (
              <PolygonSettingsSection settings={settings} update={update} />
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

      {/* Modals */}
      {showTopUp && <TopUpModal onClose={reloadAfterModal} />}
      {showSend && <SendCryptoModal wallet={walletData?.custodial_wallet} token={sendToken} pulseBalance={walletData?.pulse?.native_balance || '0'} onClose={reloadAfterModal} />}

      {showRefund && <RefundModal balance={balance} topups={walletData?.topups || []} onClose={reloadAfterModal} />}
    </div>
  );
}