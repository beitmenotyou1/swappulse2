import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, ArrowDown, Zap, Info } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/PageHeader';
import UnlockWalletModal from '@/components/blockchain/UnlockWalletModal';
import useSEO from '@/hooks/useSEO';

// Major Polygon ERC20 tokens available for conversion via DEX aggregator
const POLYGON_TOKENS = [
  { symbol: 'USDC', name: 'USD Coin', address: '0x3c499c542cEF5E3811e1192ce70d8cc03d5c3359', decimals: 6 },
  { symbol: 'USDT', name: 'Tether USD', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
  { symbol: 'WPOL', name: 'Wrapped POL', address: '0x0d500B1d8E8Fb31E3Fb05fb7391a75E6d4cD5c56', decimals: 18 },
  { symbol: 'WETH', name: 'Wrapped Ether', address: '0x7ceB233D2C190576F053aC4F70D3aB62Dd5c5b65', decimals: 18 },
  { symbol: 'WBTC', name: 'Wrapped BTC', address: '0x1BFD67037B42Cf73acf470CfDc6D9BcD5B83C2E5', decimals: 8 },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x8f3Cf7ad23Cd3CaDbD9735AfF958023239c6A063', decimals: 18 },
];

const getToken = (addr) => POLYGON_TOKENS.find((t) => t.address.toLowerCase() === addr.toLowerCase());
const FEE_RATE = 0.02;

export default function WalletConvert() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { prices } = useCryptoPrices();
  const { toast } = useToast();
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [mode, setMode] = useState('fiat_to_crypto');
  const [amount, setAmount] = useState('');
  const [targetToken, setTargetToken] = useState(POLYGON_TOKENS[0].address);
  const [sourceToken, setSourceToken] = useState(POLYGON_TOKENS[1].address);
  const [destToken, setDestToken] = useState(POLYGON_TOKENS[0].address);
  const [unlockState, setUnlockState] = useState(null);

  useSEO({
    title: 'Convert',
    description: 'Swap between fiat and cryptocurrencies on Polygon. 2% platform fee.',
    canonicalPath: '/wallet/convert',
  });

  const userDid = user?.data?.did || user?.did;
  const currency = balance?.currency || 'GBP';
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';

  const loadBalance = useCallback(async () => {
    if (!userDid) { setLoading(false); return; }
    try {
      const res = await base44.functions.invoke('get-wallet-balance', {});
      setBalance(res.data?.balance || null);
    } catch (e) {
      console.error('Balance load error:', e);
    } finally {
      setLoading(false);
    }
  }, [userDid]);

  useEffect(() => { loadBalance(); }, [loadBalance]);

  const fiatCents = balance?.fiat_cents || 0;
  const usdcWei = balance?.usdc_wei || '0';
  const usdcAmount = Number(BigInt(usdcWei)) / 1_000_000;

  const targetTok = getToken(targetToken);
  const sourceTok = getToken(sourceToken);
  const destTok = getToken(destToken);

  const numericAmount = parseFloat(amount) || 0;
  const fee = numericAmount * FEE_RATE;
  const net = numericAmount * (1 - FEE_RATE);

  // Estimated rate display using cached prices
  const rateLabel = useMemo(() => {
    if (mode === 'fiat_to_crypto') {
      const usdcRate = currency === 'GBP' ? (prices?.usdc?.gbp || 1) : currency === 'EUR' ? (prices?.usdc?.eur || 1) : 1;
      if (targetTok?.symbol === 'USDC') return `1 ${currency} ≈ ${(1 / usdcRate).toFixed(4)} USDC`;
      const tokPriceUsd = prices?.[targetTok?.symbol?.toLowerCase()]?.usd || 0;
      if (tokPriceUsd > 0) return `1 ${targetTok?.symbol} ≈ $${tokPriceUsd.toFixed(4)}`;
      return 'Rate available at execution';
    }
    if (mode === 'crypto_to_crypto') {
      const srcPrice = prices?.[sourceTok?.symbol?.toLowerCase()]?.usd || 0;
      const dstPrice = prices?.[destTok?.symbol?.toLowerCase()]?.usd || 0;
      if (srcPrice > 0 && dstPrice > 0) return `1 ${sourceTok?.symbol} ≈ ${(srcPrice / dstPrice).toFixed(6)} ${destTok?.symbol}`;
      return 'Live DEX rate at execution';
    }
    if (mode === 'usdc_to_fiat') {
      const usdcRate = currency === 'GBP' ? (prices?.usdc?.gbp || 1) : currency === 'EUR' ? (prices?.usdc?.eur || 1) : 1;
      return `1 USDC ≈ ${symbol}${usdcRate.toFixed(4)}`;
    }
    return '';
  }, [mode, currency, prices, sourceTok, destTok, targetTok, symbol]);

  const maxAmount = mode === 'fiat_to_crypto'
    ? (fiatCents / 100).toFixed(2)
    : mode === 'usdc_to_fiat'
      ? usdcAmount.toFixed(6)
      : '';

  const handleExecute = async (unlockCredential) => {
    if (numericAmount <= 0) return;
    setExecuting(true);
    try {
      if (mode === 'fiat_to_crypto') {
        const cents = Math.round(numericAmount * 100);
        const res = await base44.functions.invoke('execute-conversion', {
          mode: 'fiat_to_crypto',
          fiat_cents: cents,
          target_token: targetToken,
          currency,
        });
        if (res.data?.error) {
          toast({ title: 'Conversion failed', description: res.data.error, variant: 'destructive' });
          return;
        }
        toast({ title: 'Converted!', description: `Successfully converted ${symbol}${(cents / 100).toFixed(2)} to ${targetTok?.symbol}.` });
        navigate('/wallet');
      } else if (mode === 'crypto_to_crypto') {
        const amountWei = BigInt(Math.round(numericAmount * Math.pow(10, sourceTok.decimals))).toString();
        const res = await base44.functions.invoke('execute-conversion', {
          mode: 'crypto_to_crypto',
          source_token: sourceToken,
          target_token: destToken,
          amount: amountWei,
          unlockCredential,
        });
        if (res.data?.requiresUnlock) {
          setUnlockState({ hasPasskey: res.data.hasPasskey, hasPin: res.data.hasPin });
          setExecuting(false);
          return;
        }
        if (res.data?.error) {
          toast({ title: 'Swap failed', description: res.data.error, variant: 'destructive' });
          return;
        }
        toast({ title: 'Swapped!', description: `Successfully converted ${sourceTok?.symbol} to ${destTok?.symbol}.` });
        navigate('/wallet');
      } else {
        const wei = BigInt(Math.round(numericAmount * 1_000_000)).toString();
        const res = await base44.functions.invoke('execute-usdc-to-fiat', {
          usdc_wei: wei, unlockCredential, currency,
        });
        if (res.data?.requiresUnlock) {
          setUnlockState({ hasPasskey: res.data.hasPasskey, hasPin: res.data.hasPin });
          setExecuting(false);
          return;
        }
        if (res.data?.error) {
          toast({ title: 'Conversion failed', description: res.data.error, variant: 'destructive' });
          return;
        }
        toast({ title: 'Converted!', description: `${symbol}${(res.data.fiat_credited_cents / 100).toFixed(2)} credited to your fiat balance.` });
        navigate('/wallet');
      }
    } catch (e) {
      toast({ title: 'Conversion failed', description: e.message, variant: 'destructive' });
    } finally {
      setExecuting(false);
    }
  };

  const handleUnlock = (credential) => {
    setUnlockState(null);
    handleExecute(credential);
  };

  const switchTokens = () => {
    if (mode !== 'crypto_to_crypto') return;
    setSourceToken(destToken);
    setDestToken(sourceToken);
    setAmount('');
  };

  const canExecute = numericAmount > 0 && !executing;

  return (
    <div>
      <PageHeader title="Convert" subtitle="Swap between fiat and crypto on Polygon" />

      {/* Mode selector */}
      <div className="mx-auto mb-4 flex max-w-lg gap-1 rounded-full border border-border bg-card p-1">
        {[
          { key: 'fiat_to_crypto', label: 'Buy Crypto' },
          { key: 'crypto_to_crypto', label: 'Swap' },
          { key: 'usdc_to_fiat', label: 'Sell to Fiat' },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => { setMode(m.key); setAmount(''); }}
            className={`flex-1 rounded-full px-2 py-2 text-xs font-bold transition ${
              mode === m.key ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-secondary'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-lg space-y-4">
        {/* Balance display */}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5 text-xs">
            <span className="text-muted-foreground">Available</span>
            <span className="font-semibold">
              {mode === 'fiat_to_crypto' && `${symbol}${(fiatCents / 100).toFixed(2)} ${currency}`}
              {mode === 'crypto_to_crypto' && `${usdcAmount.toFixed(2)} USDC`}
              {mode === 'usdc_to_fiat' && `${usdcAmount.toFixed(2)} USDC`}
            </span>
          </div>
        )}

        {/* From */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground">From</label>
            {maxAmount && (
              <button onClick={() => setAmount(maxAmount)} className="rounded-lg bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/20">MAX</button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {mode === 'fiat_to_crypto' ? (
              <div className="flex flex-1 items-center gap-2 rounded-xl bg-secondary px-3 py-3">
                <span className="text-lg font-bold text-muted-foreground">{symbol}</span>
                <input
                  type="number" step="0.01" min="0" max={maxAmount} value={amount}
                  onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                  className="flex-1 bg-transparent text-xl font-bold outline-none"
                />
                <span className="text-sm font-bold text-muted-foreground">{currency}</span>
              </div>
            ) : mode === 'crypto_to_crypto' ? (
              <>
                <select
                  value={sourceToken}
                  onChange={(e) => { setSourceToken(e.target.value); if (e.target.value === destToken) setDestToken(POLYGON_TOKENS.find((t) => t.address !== e.target.value).address); }}
                  className="rounded-xl border border-border bg-secondary px-3 py-3 text-sm font-bold outline-none focus:border-primary"
                >
                  {POLYGON_TOKENS.map((t) => <option key={t.address} value={t.address}>{t.symbol}</option>)}
                </select>
                <input
                  type="number" step="0.000001" min="0" value={amount}
                  onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                  className="flex-1 rounded-xl border border-border bg-secondary px-3 py-3 text-xl font-bold outline-none focus:border-primary"
                />
              </>
            ) : (
              <div className="flex flex-1 items-center gap-2 rounded-xl bg-secondary px-3 py-3">
                <input
                  type="number" step="0.01" min="0" max={maxAmount} value={amount}
                  onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                  className="flex-1 bg-transparent text-xl font-bold outline-none"
                />
                <span className="text-sm font-bold text-muted-foreground">USDC</span>
              </div>
            )}
          </div>
        </div>

        {/* Switch button (crypto_to_crypto only) */}
        {mode === 'crypto_to_crypto' && (
          <div className="flex justify-center">
            <button onClick={switchTokens} className="rounded-full border-2 border-border bg-card p-2 hover:bg-secondary">
              <ArrowDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* To */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <label className="mb-2 block text-xs font-semibold text-muted-foreground">To</label>
          <div className="flex items-center gap-3">
            {mode === 'fiat_to_crypto' && (
              <>
                <select
                  value={targetToken}
                  onChange={(e) => setTargetToken(e.target.value)}
                  className="rounded-xl border border-border bg-secondary px-3 py-3 text-sm font-bold outline-none focus:border-primary"
                >
                  {POLYGON_TOKENS.map((t) => <option key={t.address} value={t.address}>{t.symbol} — {t.name}</option>)}
                </select>
                <div className="flex-1 rounded-xl bg-secondary px-3 py-3 text-right text-xl font-bold text-muted-foreground">
                  {net > 0 ? net.toFixed(6) : '0.00'}
                  <span className="ml-2 text-sm">{targetTok?.symbol}</span>
                </div>
              </>
            )}
            {mode === 'crypto_to_crypto' && (
              <>
                <select
                  value={destToken}
                  onChange={(e) => setDestToken(e.target.value)}
                  className="rounded-xl border border-border bg-secondary px-3 py-3 text-sm font-bold outline-none focus:border-primary"
                >
                  {POLYGON_TOKENS.filter((t) => t.address !== sourceToken).map((t) => <option key={t.address} value={t.address}>{t.symbol}</option>)}
                </select>
                <div className="flex-1 rounded-xl bg-secondary px-3 py-3 text-right text-xl font-bold text-muted-foreground">
                  {net > 0 ? net.toFixed(6) : '0.00'}
                  <span className="ml-2 text-sm">{destTok?.symbol}</span>
                </div>
              </>
            )}
            {mode === 'usdc_to_fiat' && (
              <div className="flex flex-1 items-center gap-2 rounded-xl bg-secondary px-3 py-3">
                <span className="text-lg font-bold text-muted-foreground">{symbol}</span>
                <div className="flex-1 text-right text-xl font-bold text-muted-foreground">
                  {net > 0 ? net.toFixed(2) : '0.00'}
                </div>
                <span className="text-sm font-bold text-muted-foreground">{currency}</span>
              </div>
            )}
          </div>
        </div>

        {/* Rate */}
        {rateLabel && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            {rateLabel}
          </div>
        )}

        {/* Fee breakdown */}
        {numericAmount > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1">
                <Zap className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs font-bold text-accent">2% Platform Fee</span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">You pay</span>
                <span className="font-semibold">
                  {numericAmount.toFixed(mode === 'crypto_to_crypto' ? 6 : 2)}{' '}
                  {mode === 'fiat_to_crypto' ? currency : mode === 'crypto_to_crypto' ? sourceTok?.symbol : 'USDC'}
                </span>
              </div>
              <div className="flex justify-between text-destructive">
                <span className="text-muted-foreground">Fee (2%)</span>
                <span className="font-semibold">
                  −{fee.toFixed(mode === 'crypto_to_crypto' ? 6 : 2)}{' '}
                  {mode === 'fiat_to_crypto' ? currency : mode === 'crypto_to_crypto' ? sourceTok?.symbol : 'USDC'}
                </span>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2">
                <span className="font-bold">You receive</span>
                <span className="font-bold text-primary">
                  {net.toFixed(mode === 'crypto_to_crypto' ? 6 : 2)}{' '}
                  {mode === 'fiat_to_crypto' ? targetTok?.symbol : mode === 'crypto_to_crypto' ? destTok?.symbol : currency}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Execute */}
        <button
          onClick={() => handleExecute(null)}
          disabled={!canExecute}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {executing ? 'Converting…' : 'Convert Now'}
        </button>

        <p className="text-center text-[10px] text-muted-foreground">
          Swaps execute on Polygon via DEX aggregator. 2% fee collected in USDC. Gas sponsored by SwapPulse.
        </p>
      </div>

      {unlockState && (
        <UnlockWalletModal
          open={true}
          unlockState={unlockState}
          onUnlock={handleUnlock}
          onCancel={() => { setUnlockState(null); setExecuting(false); }}
        />
      )}
    </div>
  );
}