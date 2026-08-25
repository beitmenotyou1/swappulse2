import React, { useState } from 'react';
import { X, Loader2, RefreshCw, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import UnlockWalletModal from '@/components/blockchain/UnlockWalletModal';

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

export default function ConvertModal({ balance, wallet, onClose }) {
  const { toast } = useToast();
  const [mode, setMode] = useState('fiat_to_crypto');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [unlockState, setUnlockState] = useState(null);
  const [targetToken, setTargetToken] = useState(POLYGON_TOKENS[0].address);
  const [sourceToken, setSourceToken] = useState(POLYGON_TOKENS[0].address);
  const [destToken, setDestToken] = useState(POLYGON_TOKENS[1].address);

  const fiatCents = balance?.fiat_cents || 0;
  const usdcWei = balance?.usdc_wei || '0';
  const usdcAmount = Number(BigInt(usdcWei)) / 1_000_000;
  const currency = balance?.currency || 'GBP';
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';

  const targetTok = getToken(targetToken);
  const sourceTok = getToken(sourceToken);
  const destTok = getToken(destToken);

  const fee = amount ? (parseFloat(amount) * 0.02).toFixed(mode === 'crypto_to_crypto' ? 6 : 2) : '0';
  const net = amount ? (parseFloat(amount) * 0.98).toFixed(mode === 'crypto_to_crypto' ? 6 : 2) : '0';

  const handleConvert = async (unlockCredential) => {
    setLoading(true);
    try {
      if (mode === 'fiat_to_crypto') {
        const cents = Math.round(parseFloat(amount) * 100);
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
      } else if (mode === 'crypto_to_crypto') {
        const amountWei = BigInt(Math.round(parseFloat(amount) * Math.pow(10, sourceTok.decimals))).toString();
        const res = await base44.functions.invoke('execute-conversion', {
          mode: 'crypto_to_crypto',
          source_token: sourceToken,
          target_token: destToken,
          amount: amountWei,
          unlockCredential,
        });
        if (res.data?.requiresUnlock) {
          setUnlockState({ hasPasskey: res.data.hasPasskey, hasPin: res.data.hasPin });
          setLoading(false);
          return;
        }
        if (res.data?.error) {
          toast({ title: 'Swap failed', description: res.data.error, variant: 'destructive' });
          return;
        }
        toast({ title: 'Swapped!', description: `Successfully converted ${sourceTok?.symbol} to ${destTok?.symbol}.` });
      } else {
        const wei = BigInt(Math.round(parseFloat(amount) * 1_000_000)).toString();
        const res = await base44.functions.invoke('execute-usdc-to-fiat', {
          usdc_wei: wei, unlockCredential, currency,
        });
        if (res.data?.requiresUnlock) {
          setUnlockState({ hasPasskey: res.data.hasPasskey, hasPin: res.data.hasPin });
          setLoading(false);
          return;
        }
        if (res.data?.error) {
          toast({ title: 'Conversion failed', description: res.data.error, variant: 'destructive' });
          return;
        }
        toast({ title: 'Converted!', description: `${symbol}${(res.data.fiat_credited_cents / 100).toFixed(2)} credited to your fiat balance.` });
      }
      onClose();
    } catch (e) {
      toast({ title: 'Conversion failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = (credential) => {
    setUnlockState(null);
    handleConvert(credential);
  };

  const maxAmount = mode === 'fiat_to_crypto'
    ? (fiatCents / 100).toFixed(2)
    : mode === 'usdc_to_fiat'
      ? usdcAmount.toFixed(6)
      : '';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Convert</h2>
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
          </div>

          {/* Mode selector */}
          <div className="mb-4 flex gap-1 rounded-full border border-border bg-secondary p-1">
            <button onClick={() => setMode('fiat_to_crypto')} className={`flex-1 rounded-full px-2 py-1.5 text-xs font-bold transition ${mode === 'fiat_to_crypto' ? 'bg-primary text-white' : 'text-muted-foreground'}`}>Buy Crypto</button>
            <button onClick={() => setMode('crypto_to_crypto')} className={`flex-1 rounded-full px-2 py-1.5 text-xs font-bold transition ${mode === 'crypto_to_crypto' ? 'bg-primary text-white' : 'text-muted-foreground'}`}>Swap</button>
            <button onClick={() => setMode('usdc_to_fiat')} className={`flex-1 rounded-full px-2 py-1.5 text-xs font-bold transition ${mode === 'usdc_to_fiat' ? 'bg-primary text-white' : 'text-muted-foreground'}`}>Sell</button>
          </div>

          {mode === 'fiat_to_crypto' && (
            <>
              <div className="mb-2 text-xs text-muted-foreground">Available: {symbol}{maxAmount}</div>
              <div className="mb-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">{symbol}</span>
                  <input type="number" step="0.01" min="0" max={maxAmount} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full rounded-xl border border-border bg-secondary py-3 pl-8 pr-16 text-lg font-semibold outline-none focus:border-primary" />
                  <button onClick={() => setAmount(maxAmount)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary hover:bg-primary/20">MAX</button>
                </div>
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">To</label>
                <select value={targetToken} onChange={(e) => setTargetToken(e.target.value)} className="w-full rounded-xl border border-border bg-secondary px-3 py-3 text-sm font-semibold outline-none focus:border-primary">
                  {POLYGON_TOKENS.map((t) => <option key={t.address} value={t.address}>{t.symbol} — {t.name}</option>)}
                </select>
              </div>
            </>
          )}

          {mode === 'crypto_to_crypto' && (
            <>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">From</label>
                <select value={sourceToken} onChange={(e) => { setSourceToken(e.target.value); if (e.target.value === destToken) setDestToken(POLYGON_TOKENS.find((t) => t.address !== e.target.value).address); }} className="w-full rounded-xl border border-border bg-secondary px-3 py-3 text-sm font-semibold outline-none focus:border-primary">
                  {POLYGON_TOKENS.map((t) => <option key={t.address} value={t.address}>{t.symbol}</option>)}
                </select>
              </div>
              <div className="mb-3">
                <input type="number" step="0.000001" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full rounded-xl border border-border bg-secondary py-3 pl-3 text-lg font-semibold outline-none focus:border-primary" />
              </div>
              <div className="mb-3 flex items-center justify-center"><ArrowRight className="h-5 w-5 text-muted-foreground" /></div>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">To</label>
                <select value={destToken} onChange={(e) => setDestToken(e.target.value)} className="w-full rounded-xl border border-border bg-secondary px-3 py-3 text-sm font-semibold outline-none focus:border-primary">
                  {POLYGON_TOKENS.filter((t) => t.address !== sourceToken).map((t) => <option key={t.address} value={t.address}>{t.symbol}</option>)}
                </select>
              </div>
            </>
          )}

          {mode === 'usdc_to_fiat' && (
            <>
              <div className="mb-2 text-xs text-muted-foreground">Available: {maxAmount} USDC</div>
              <div className="mb-3">
                <div className="relative">
                  <input type="number" step="0.01" min="0" max={maxAmount} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full rounded-xl border border-border bg-secondary py-3 pl-3 pr-16 text-lg font-semibold outline-none focus:border-primary" />
                  <button onClick={() => setAmount(maxAmount)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary hover:bg-primary/20">MAX</button>
                </div>
              </div>
            </>
          )}

          {amount && parseFloat(amount) > 0 && (
            <div className="mb-4 rounded-lg bg-secondary p-3 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{parseFloat(amount).toFixed(mode === 'crypto_to_crypto' ? 6 : 2)} {mode === 'fiat_to_crypto' ? currency : mode === 'crypto_to_crypto' ? sourceTok?.symbol : 'USDC'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Fee (2%)</span><span className="font-semibold">{fee} {mode === 'fiat_to_crypto' ? currency : mode === 'crypto_to_crypto' ? sourceTok?.symbol : 'USDC'}</span></div>
              <div className="mt-1 flex justify-between border-t border-border pt-1"><span className="font-bold">You receive</span><span className="font-bold">{net} {mode === 'fiat_to_crypto' ? targetTok?.symbol : mode === 'crypto_to_crypto' ? destTok?.symbol : currency}</span></div>
            </div>
          )}

          <button onClick={() => handleConvert(null)} disabled={loading || !amount} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loading ? 'Converting…' : 'Convert'}
          </button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">Swaps execute on Polygon via DEX aggregator. 2% fee in USDC.</p>
        </div>
      </div>
      {unlockState && (
        <UnlockWalletModal open={true} unlockState={unlockState} onUnlock={handleUnlock} onCancel={() => { setUnlockState(null); setLoading(false); }} />
      )}
    </>
  );
}