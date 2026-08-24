import React, { useState } from 'react';
import { X, Loader2, Send, Copy, AtSign, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import UnlockWalletModal from '@/components/blockchain/UnlockWalletModal';

export default function SendCryptoModal({ wallet, onClose }) {
  const { toast } = useToast();
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [unlockState, setUnlockState] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [resolving, setResolving] = useState(false);

  const resolveUsername = async () => {
    if (!usernameInput.trim()) return;
    setResolving(true);
    try {
      const res = await base44.functions.invoke('resolve-username-address', {
        username: usernameInput.replace(/^@/, ''),
        chain: 'polygon',
      });
      if (res.data?.error) {
        toast({ title: 'Resolution failed', description: res.data.error, variant: 'destructive' });
      } else if (res.data?.address) {
        setToAddress(res.data.address);
        toast({ title: `Resolved @${res.data.handle}`, description: `${res.data.address.slice(0, 8)}…${res.data.address.slice(-4)}` });
      }
    } catch (e) {
      toast({ title: 'Resolution failed', description: e.message, variant: 'destructive' });
    } finally {
      setResolving(false);
    }
  };

  const usdcBalance = 0; // will be passed from parent or fetched
  const fee = amount ? (parseFloat(amount) * 0.02).toFixed(2) : '0.00';
  const total = amount ? (parseFloat(amount) * 1.02).toFixed(2) : '0.00';

  const handleSend = async (unlockCredential) => {
    const usdcWei = BigInt(Math.round(parseFloat(amount) * 1_000_000)).toString();
    if (!usdcWei || BigInt(usdcWei) <= 0n) return;

    setLoading(true);
    try {
      const res = await base44.functions.invoke('send-crypto', {
        to_address: toAddress,
        usdc_wei: usdcWei,
        unlockCredential,
      });
      if (res.data?.requiresUnlock) {
        setUnlockState({ hasPasskey: res.data.hasPasskey, hasPin: res.data.hasPin });
        setLoading(false);
        return;
      }
      if (res.data?.error) {
        toast({ title: 'Send failed', description: res.data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'USDC sent!', description: 'Transaction confirmed on Polygon.' });
      onClose();
    } catch (e) {
      toast({ title: 'Send failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = (credential) => {
    setUnlockState(null);
    handleSend(credential);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Send USDC</h2>
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
          </div>

          <div className="space-y-4">
            {/* Username resolution */}
            <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                <AtSign className="mr-1 inline h-3 w-3" />Send to Username
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && resolveUsername()}
                  placeholder="@username"
                  className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-mono outline-none focus:border-primary"
                />
                <button
                  onClick={resolveUsername}
                  disabled={resolving || !usernameInput.trim()}
                  className="flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
                >
                  {resolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Resolve
                </button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Minted usernames are immutable address aliases across all chains.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Recipient Address</label>
              <input
                type="text"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder="0x… or resolve a @username above"
                className="w-full rounded-xl border border-border bg-secondary px-3 py-3 text-sm font-mono outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Amount (USDC)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-border bg-secondary px-3 py-3 text-lg font-semibold outline-none focus:border-primary"
              />
            </div>
            {amount && parseFloat(amount) > 0 && (
              <div className="rounded-lg bg-secondary p-3 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{parseFloat(amount).toFixed(2)} USDC</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Fee (2%)</span><span className="font-semibold">{fee} USDC</span></div>
                <div className="mt-1 flex justify-between border-t border-border pt-1"><span className="font-bold">Total</span><span className="font-bold">{total} USDC</span></div>
              </div>
            )}
            <button
              onClick={() => handleSend(null)}
              disabled={loading || !toAddress || !amount}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {loading ? 'Sending…' : 'Send USDC'}
            </button>
          </div>
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