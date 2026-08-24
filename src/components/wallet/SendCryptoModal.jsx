import React, { useState } from 'react';
import { X, Loader2, Send, Copy, Check, Shield, AlertCircle, KeyRound } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import UnlockWalletModal from '@/components/blockchain/UnlockWalletModal';
import { SUPPORTED_CHAINS, getChain, formatNative } from '@/lib/chains';

// Multi-chain send with three-layer security:
// 1. Receive-allowlist check (recipient must be a traded contact or allowlisted)
// 2. Passkey/PIN unlock
// 3. One-time 6-digit code
// Includes Ledger-style clear-signing preview before any action.
export default function SendCryptoModal({ wallet, chainAddresses, onClose }) {
  const { toast } = useToast();
  const [step, setStep] = useState('form'); // form → review → unlock → code → sending
  const [chain, setChain] = useState('polygon');
  const [asset, setAsset] = useState('USDC'); // 'USDC' or 'native'
  const [toAddress, setToAddress] = useState('');
  const [username, setUsername] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [gasEstimate, setGasEstimate] = useState(null);
  const [clearSigning, setClearSigning] = useState(null);
  const [unlockState, setUnlockState] = useState(null);
  const [oneTimeCode, setOneTimeCode] = useState('');
  const [issuedCode, setIssuedCode] = useState('');
  const [needsAllowlist, setNeedsAllowlist] = useState(false);

  const chainConfig = getChain(chain);
  const isUsdc = asset === 'USDC';

  // Convert display amount to base units
  const getAmountWei = () => {
    if (isUsdc) return BigInt(Math.round(parseFloat(amount) * 1_000_000)).toString();
    if (chainConfig) return BigInt(Math.round(parseFloat(amount) * Math.pow(10, chainConfig.nativeDecimals))).toString();
    return '0';
  };

  const handleReview = async () => {
    setLoading(true);
    setNeedsAllowlist(false);
    try {
      const res = await base44.functions.invoke('send-crypto', {
        chain,
        asset: isUsdc ? 'USDC' : 'native',
        to_address: toAddress || undefined,
        username: username || undefined,
        amount_wei: getAmountWei(),
      });
      const data = res.data || res;

      if (data.needsAllowlist) {
        setNeedsAllowlist(true);
        toast({
          title: 'Address not allowlisted',
          description: 'Add this address to your allowlist in Settings before sending.',
          variant: 'destructive',
        });
        return;
      }
      if (data.error) {
        toast({ title: 'Cannot send', description: data.error, variant: 'destructive' });
        return;
      }
      if (data.requiresUnlock) {
        setGasEstimate(data.gasEstimate);
        setClearSigning(data.clearSigning);
        setUnlockState({ hasPasskey: data.hasPasskey, hasPin: data.hasPin });
        setStep('review');
      }
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    setStep('unlock');
  };

  const handleUnlock = async (credential) => {
    setUnlockState(null);
    setLoading(true);
    try {
      const res = await base44.functions.invoke('send-crypto', {
        chain,
        asset: isUsdc ? 'USDC' : 'native',
        to_address: toAddress || undefined,
        username: username || undefined,
        amount_wei: getAmountWei(),
        unlockCredential: credential,
      });
      const data = res.data || res;
      if (data.error) {
        toast({ title: 'Unlock failed', description: data.error, variant: 'destructive' });
        setStep('review');
        return;
      }
      if (data.requiresCode) {
        setIssuedCode(data.code);
        setStep('code');
      }
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
      setStep('review');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    setStep('sending');
    setLoading(true);
    try {
      const res = await base44.functions.invoke('send-crypto', {
        chain,
        asset: isUsdc ? 'USDC' : 'native',
        to_address: toAddress || undefined,
        username: username || undefined,
        amount_wei: getAmountWei(),
        send_code: oneTimeCode,
      });
      const data = res.data || res;
      if (data.error) {
        toast({ title: 'Send failed', description: data.error, variant: 'destructive' });
        setStep('code');
        return;
      }
      toast({
        title: 'Sent successfully!',
        description: `Transaction confirmed on ${chainConfig?.name}.`,
      });
      onClose();
    } catch (e) {
      toast({ title: 'Send failed', description: e.message, variant: 'destructive' });
      setStep('code');
    } finally {
      setLoading(false);
    }
  };

  const fee = isUsdc && amount ? (parseFloat(amount) * 0.02).toFixed(2) : '0';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Send</h2>
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
          </div>

          {step === 'form' && (
            <div className="space-y-4">
              {/* Chain selector */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Chain</label>
                <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {SUPPORTED_CHAINS.filter((c) => c.type === 'evm').map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setChain(c.key)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                        chain === c.key ? 'bg-primary text-white' : 'border border-border text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Asset selector */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Asset</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAsset('USDC')}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      isUsdc ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary'
                    }`}
                  >
                    USDC
                  </button>
                  <button
                    onClick={() => setAsset('native')}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      !isUsdc ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary'
                    }`}
                  >
                    {chainConfig?.nativeSymbol}
                  </button>
                </div>
              </div>

              {/* Recipient */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Recipient</label>
                <input
                  type="text"
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                  placeholder="0x… address or @username"
                  className="w-full rounded-xl border border-border bg-secondary px-3 py-3 text-sm font-mono outline-none focus:border-primary"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Amount ({isUsdc ? 'USDC' : chainConfig?.nativeSymbol})
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-border bg-secondary px-3 py-3 text-lg font-semibold outline-none focus:border-primary"
                />
              </div>

              {isUsdc && amount && parseFloat(amount) > 0 && (
                <div className="rounded-lg bg-secondary p-3 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{parseFloat(amount).toFixed(2)} USDC</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fee (2%)</span><span className="font-semibold">{fee} USDC</span></div>
                  <div className="mt-1 flex justify-between border-t border-border pt-1"><span className="font-bold">Total</span><span className="font-bold">{(parseFloat(amount) + parseFloat(fee)).toFixed(2)} USDC</span></div>
                </div>
              )}

              {needsAllowlist && (
                <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <p className="text-muted-foreground">
                    This address isn't on your allowlist. Add it in Settings → Wallet → Allowlist, or send to a traded contact.
                  </p>
                </div>
              )}

              <button
                onClick={handleReview}
                disabled={loading || (!toAddress && !username) || !amount}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {loading ? 'Checking…' : 'Review Send'}
              </button>
            </div>
          )}

          {step === 'review' && clearSigning && (
            <div className="space-y-4">
              {/* Ledger-style clear-signing summary */}
              <div className="rounded-xl border border-border bg-secondary p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-bold">Transaction Preview</h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Action</span>
                    <span className="font-semibold text-right">{clearSigning.action}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chain</span>
                    <span className="font-semibold">{clearSigning.chain}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recipient</span>
                    <span className="font-mono text-xs">{clearSigning.recipient?.slice(0, 10)}…{clearSigning.recipient?.slice(-8)}</span>
                  </div>
                  {clearSigning.contract && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{clearSigning.contractLabel || 'Contract'}</span>
                      <span className="font-mono text-xs">{clearSigning.contract?.slice(0, 10)}…{clearSigning.contract?.slice(-8)}</span>
                    </div>
                  )}
                  {clearSigning.gasCostFormatted && (
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="text-muted-foreground">Est. Gas</span>
                      <span className="font-semibold">{clearSigning.gasCostFormatted}</span>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                You'll unlock with your passkey/PIN, then enter a one-time code to confirm.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('form')}
                  className="flex-1 rounded-full border border-border bg-secondary px-4 py-3 text-sm font-bold hover:bg-secondary/80"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90"
                >
                  <KeyRound className="h-4 w-4" />
                  Confirm & Unlock
                </button>
              </div>
            </div>
          )}

          {step === 'code' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
                <p className="text-xs text-muted-foreground">Your one-time code</p>
                <p className="my-2 text-3xl font-extrabold tracking-[0.3em] text-primary">{issuedCode}</p>
                <p className="text-xs text-muted-foreground">Enter this code to confirm the send (expires in 60s)</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Enter Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength="6"
                  value={oneTimeCode}
                  onChange={(e) => setOneTimeCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full rounded-xl border border-border bg-secondary px-3 py-3 text-center text-2xl font-bold tracking-[0.3em] outline-none focus:border-primary"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={loading || oneTimeCode.length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {loading ? 'Sending…' : 'Confirm Send'}
              </button>
            </div>
          )}

          {step === 'sending' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-semibold">Broadcasting transaction…</p>
              <p className="text-xs text-muted-foreground">Confirming on {chainConfig?.name}</p>
            </div>
          )}
        </div>
      </div>

      {step === 'unlock' && unlockState && (
        <UnlockWalletModal
          open={true}
          unlockState={unlockState}
          onUnlock={handleUnlock}
          onCancel={() => { setUnlockState(null); setStep('review'); }}
        />
      )}
    </>
  );
}