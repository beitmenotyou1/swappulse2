import React, { useState } from 'react';
import { X, Loader2, RefreshCw, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import UnlockWalletModal from '@/components/blockchain/UnlockWalletModal';

export default function ConvertModal({ balance, wallet, onClose }) {
  const { toast } = useToast();
  const [direction, setDirection] = useState('fiat_to_usdc'); // or 'usdc_to_fiat'
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [unlockState, setUnlockState] = useState(null);

  const fiatCents = balance?.fiat_cents || 0;
  const usdcWei = balance?.usdc_wei || '0';
  const usdcAmount = Number(BigInt(usdcWei)) / 1_000_000;
  const currency = balance?.currency || 'GBP';
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';

  const fee = amount ? (parseFloat(amount) * 0.02).toFixed(2) : '0.00';
  const net = amount ? (parseFloat(amount) * 0.98).toFixed(2) : '0.00';

  const handleConvert = async (unlockCredential) => {
    setLoading(true);
    try {
      if (direction === 'fiat_to_usdc') {
        const cents = Math.round(parseFloat(amount) * 100);
        const res = await base44.functions.invoke('execute-fiat-to-usdc', { fiat_cents: cents, currency });
        if (res.data?.error) {
          toast({ title: 'Conversion failed', description: res.data.error, variant: 'destructive' });
          return;
        }
        toast({ title: 'Converted!', description: `${net} USDC credited to your wallet.` });
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

  const maxAmount = direction === 'fiat_to_usdc' ? (fiatCents / 100).toFixed(2) : usdcAmount.toFixed(6);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Convert</h2>
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
          </div>

          {/* Direction toggle */}
          <div className="mb-4 flex gap-2 rounded-full border border-border bg-secondary p-1">
            <button
              onClick={() => setDirection('fiat_to_usdc')}
              className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-colors ${direction === 'fiat_to_usdc' ? 'bg-primary text-white' : 'text-muted-foreground'}`}
            >
              Fiat → USDC
            </button>
            <button
              onClick={() => setDirection('usdc_to_fiat')}
              className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-colors ${direction === 'usdc_to_fiat' ? 'bg-primary text-white' : 'text-muted-foreground'}`}
            >
              USDC → Fiat
            </button>
          </div>

          <div className="mb-3 text-xs text-muted-foreground">
            Available: {direction === 'fiat_to_usdc' ? `${symbol}${maxAmount}` : `${maxAmount} USDC`}
          </div>

          <div className="mb-4">
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                max={maxAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-border bg-secondary py-3 pl-3 pr-16 text-lg font-semibold outline-none focus:border-primary"
              />
              <button
                onClick={() => setAmount(maxAmount)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary hover:bg-primary/20"
              >
                MAX
              </button>
            </div>
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className="mb-4 rounded-lg bg-secondary p-3 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{parseFloat(amount).toFixed(2)} {direction === 'fiat_to_usdc' ? currency : 'USDC'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Fee (2%)</span><span className="font-semibold">{fee} {direction === 'fiat_to_usdc' ? currency : 'USDC'}</span></div>
              <div className="mt-1 flex justify-between border-t border-border pt-1"><span className="font-bold">You receive</span><span className="font-bold">{net} {direction === 'fiat_to_usdc' ? 'USDC' : currency}</span></div>
            </div>
          )}

          <button
            onClick={() => handleConvert(null)}
            disabled={loading || !amount}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loading ? 'Converting…' : `Convert ${direction === 'fiat_to_usdc' ? 'to USDC' : 'to Fiat'}`}
          </button>
        </div>
      </div>
      {unlockState && (
        <UnlockWalletModal
          open={true}
          unlockState={unlockState}
          onUnlock={handleUnlock}
          onCancel={() => { setUnlockState(null); setLoading(false); }}
        />
      )}
    </>
  );
}