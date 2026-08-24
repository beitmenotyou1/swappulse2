import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, QrCode, AtSign, Loader2, Zap } from 'lucide-react';
import QRCode from 'qrcode';
import PageHeader from '@/components/PageHeader';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { CHAINS, getChain } from '@/lib/chainRegistry';
import { useToast } from '@/components/ui/use-toast';
import useSEO from '@/hooks/useSEO';

// Dedicated receive page: collector picks a blockchain, then sees a large
// QR code of that chain's wallet address, the raw address with a copy
// button, and their minted username displayed as the human-readable alias.
export default function WalletReceive() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [upgrading, setUpgrading] = useState(false);

  const selectedChain = searchParams.get('chain') || '';
  const userDid = user?.data?.did || user?.did;

  useSEO({
    title: 'Receive Crypto',
    description: 'Select a blockchain and scan or copy your SwapPulse wallet address to receive crypto.',
    canonicalPath: '/wallet/receive',
  });

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

  // Wallet addresses per chain — each Bitcoin-derived chain has its own
  // address format (Bitcoin bech32, BCH CashAddr, Dogecoin/Litecoin P2PKH)
  const walletAddresses = walletData?.wallet_addresses || {};
  const evmAddress = walletAddresses.evm || walletData?.custodial_wallet?.address || null;
  const solanaAddress = walletAddresses.solana || null;
  const usernameHandle = walletData?.username_nft?.handle || user?.bsky_handle || user?.username;

  // Map each chain key to its specific address
  const addressByChain = useMemo(() => {
    const map = {};
    for (const c of CHAINS) {
      if (c.type === 'evm') map[c.key] = evmAddress;
      else if (c.type === 'solana') map[c.key] = solanaAddress;
      else if (c.type === 'bitcoin') map[c.key] = walletAddresses[c.key] || null;
      else map[c.key] = evmAddress; // 'other' chains fall back to EVM
    }
    return map;
  }, [evmAddress, solanaAddress, walletAddresses]);

  // Address for the selected chain
  const selectedChainDef = selectedChain ? getChain(selectedChain) : null;
  const selectedAddress = selectedChainDef ? addressByChain[selectedChainDef.key] : null;

  // Generate QR code client-side
  useEffect(() => {
    if (selectedAddress) {
      QRCode.toDataURL(selectedAddress, {
        width: 240,
        margin: 1,
        color: { dark: '#1e293b', light: '#ffffff' },
      })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(''));
    } else {
      setQrDataUrl('');
    }
  }, [selectedAddress]);

  const copyAddress = () => {
    if (!selectedAddress) return;
    navigator.clipboard.writeText(selectedAddress);
    setCopied(true);
    toast({ title: `${selectedChainDef?.name || 'Address'} copied!` });
    setTimeout(() => setCopied(false), 2000);
  };

  // Chains that have an address available
  const availableChains = useMemo(() => {
    return CHAINS.filter(c => !!addressByChain[c.key]);
  }, [addressByChain]);

  // Detect if the user has an EVM wallet but is missing Solana/Bitcoin addresses
  // (old CustodialWallet that hasn't been upgraded to MultiChainWallet)
  const hasEvmOnly = evmAddress && !solanaAddress && !walletAddresses.bitcoin;
  const missingChains = useMemo(() => {
    return CHAINS.filter(c => c.type !== 'evm' && !addressByChain[c.key]);
  }, [addressByChain]);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await base44.functions.invoke('upgrade-to-multi-chain', {});
      toast({ title: 'Wallet upgraded!', description: 'All chain addresses are now available.' });
      await loadWallet();
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      toast({ title: 'Upgrade failed', description: msg, variant: 'destructive' });
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Receive" subtitle="Select a blockchain to get your address" />
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  // If a chain is selected, show the QR + address view
  if (selectedChain && selectedChainDef) {
    return (
      <div>
        <PageHeader title={`Receive ${selectedChainDef.symbol}`} subtitle={selectedChainDef.name} />

        {/* Back to chain selection */}
        <button
          onClick={() => setSearchParams({})}
          className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Choose another chain
        </button>

        <div className="flex flex-col items-center gap-4">
          {/* Username alias badge */}
          {usernameHandle && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-4 py-2 text-sm font-bold text-accent">
              <AtSign className="h-4 w-4" />
              {usernameHandle}
            </div>
          )}

          {/* QR code */}
          {selectedAddress ? (
            <>
              <div className="rounded-2xl border-2 border-primary/20 bg-white p-4 shadow-raised">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Wallet address QR code" className="h-56 w-56" />
                ) : (
                  <div className="flex h-56 w-56 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Scan to send {selectedChainDef.symbol} on {selectedChainDef.name}
              </p>

              {/* Address with copy button */}
              <div className="w-full max-w-md rounded-xl border border-border bg-card p-4">
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Your Address</p>
                <p className="break-all font-mono text-sm">{selectedAddress}</p>
                <button
                  onClick={copyAddress}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy Address'}
                </button>
              </div>

              {/* Username note */}
              {usernameHandle && (
                <div className="w-full max-w-md rounded-xl border border-accent/20 bg-accent/5 p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-accent">@{usernameHandle}</span> is your
                    immutable address alias across all chains. Share it instead of the raw address.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                You don't have a {selectedChainDef.name} address yet.
                Create a multi-chain wallet in Settings → Wallet.
              </p>
              <Link to="/settings" className="mt-4 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90">
                Go to Settings
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Chain selection grid
  return (
    <div>
      <PageHeader title="Receive" subtitle="Select a blockchain to get your address" />

      {usernameHandle && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-accent/20 bg-accent/5 p-3">
          <AtSign className="h-4 w-4 text-accent" />
          <p className="text-xs text-muted-foreground">
            Your address alias <span className="font-bold text-accent">@{usernameHandle}</span> works across all chains
          </p>
        </div>
      )}

      {availableChains.length === 0 ? (
        <div className="py-12 text-center">
          <QrCode className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No wallet addresses found. Create a wallet in Settings to start receiving.
          </p>
          <Link to="/settings" className="mt-4 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90">
            Go to Settings
          </Link>
        </div>
      ) : (
        <>
          {/* Upgrade banner for old EVM-only wallets */}
          {hasEvmOnly && missingChains.length > 0 && (
            <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 p-4">
              <div className="flex items-start gap-3">
                <Zap className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">Unlock all chains</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Your wallet has an EVM address but is missing Solana, Bitcoin, Bitcoin Cash,
                    Dogecoin and Litecoin. Upgrade to generate all addresses — your EVM address
                    and NFTs stay the same.
                  </p>
                  <button
                    onClick={handleUpgrade}
                    disabled={upgrading}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
                  >
                    {upgrading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Upgrading...</>
                    ) : (
                      <><Zap className="h-4 w-4" /> Upgrade Wallet</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {availableChains.map((chain) => {
              const address = addressByChain[chain.key];
              return (
                <button
                  key={chain.key}
                  onClick={() => setSearchParams({ chain: chain.key })}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/30 hover:shadow-raised"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-sm font-bold text-primary">
                    {chain.symbol.slice(0, 3)}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold">{chain.name}</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}