import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight, Loader2, AlertCircle, CheckCircle2, Fuel } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import UnlockWalletModal from '@/components/blockchain/UnlockWalletModal';

const CHAINS = [
  { id: 'pulse', label: 'PulseChain', symbol: 'PULSE', color: '#6d4aff' },
  { id: 'polygon', label: 'Polygon', symbol: 'MATIC', color: '#8247e5' },
];

export default function CrossChainBridge({ walletAddress, onClose }) {
  const { toast } = useToast();
  const [fromChain, setFromChain] = useState('pulse');
  const [toChain, setToChain] = useState('polygon');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState(walletAddress || '');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState(null);

  const fetchQuote = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setQuote(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const weiAmount = BigInt(Math.floor(parseFloat(amount) * 1e18)).toString();
      const res = await base44.functions.invoke('cross-chain-transfer', {
        action: 'quote',
        fromChain,
        toChain,
        toAddress: recipient,
        amount: weiAmount,
      });
      setQuote(res.data);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to get quote');
    } finally {
      setLoading(false);
    }
  }, [amount, fromChain, toChain, recipient]);

  // Debounced quote fetch
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (amount && parseFloat(amount) > 0) fetchQuote();
    }, 500);
    return () => clearTimeout(timeout);
  }, [amount, fromChain, toChain, fetchQuote]);

  const handleSwapChains = () => {
    setFromChain(toChain);
    setToChain(fromChain);
    setQuote(null);
  };

  const handleTransfer = async () => {
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (!amount || parseFloat(amount) <= 0) {
        throw new Error('Enter a valid amount');
      }
      if (!recipient || !recipient.startsWith('0x')) {
        throw new Error('Enter a valid recipient address');
      }

      const weiAmount = BigInt(Math.floor(parseFloat(amount) * 1e18)).toString();
      const res = await base44.functions.invoke('cross-chain-transfer', {
        action: 'transfer',
        fromChain,
        toChain,
        toAddress: recipient,
        amount: weiAmount,
      });

      // Check if wallet unlock is required
      if (res.data?.requiresUnlock) {
        setPendingTransfer({ fromChain, toChain, toAddress: recipient, amount: weiAmount });
        setShowUnlock(true);
        setLoading(false);
        return;
      }

      // Check if client-side signing is required (MetaMask)
      if (res.data?.requiresClientSign) {
        if (!window.ethereum) {
          throw new Error('No browser wallet found. Please install MetaMask.');
        }

        const txData = res.data.transaction;
        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: txData.from,
            to: txData.to,
            data: txData.data,
            value: txData.value,
          }],
        });

        toast({ title: 'Transaction submitted', description: `Hash: ${txHash.substring(0, 10)}...` });
      }

      setSuccess(true);
      setAmount('');
      setQuote(null);
      toast({ title: 'Transfer submitted', description: 'Tokens will arrive within 1-5 minutes.' });
    } catch (e) {
      setError(e?.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockComplete = async (credential) => {
    setShowUnlock(false);
    if (!pendingTransfer) return;

    setLoading(true);
    try {
      const res = await base44.functions.invoke('cross-chain-transfer', {
        action: 'transfer',
        fromChain: pendingTransfer.fromChain,
        toChain: pendingTransfer.toChain,
        toAddress: pendingTransfer.toAddress,
        amount: pendingTransfer.amount,
        unlockCredential: credential,
      });

      if (res.data?.status === 'submitted') {
        setSuccess(true);
        setAmount('');
        setQuote(null);
        toast({ title: 'Transfer submitted', description: 'Tokens will arrive within 1-5 minutes.' });
      }
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Transfer failed');
    } finally {
      setLoading(false);
      setPendingTransfer(null);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <ArrowLeftRight className="h-5 w-5 text-primary" />
          Cross-Chain Bridge
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Send $PULSE between PulseChain and Polygon instantly via LayerZero.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chain Selection */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Select value={fromChain} onValueChange={(v) => { setFromChain(v); setQuote(null); }}>
              <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHAINS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={handleSwapChains}
            className="mb-0 shrink-0 rounded-full"
            aria-label="Swap chains"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>

          <div className="flex-1 space-y-1.5">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Select value={toChain} onValueChange={(v) => { setToChain(v); setQuote(null); }}>
              <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHAINS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-1.5">
          <Label htmlFor="bridge-amount" className="text-xs text-muted-foreground">Amount ($PULSE)</Label>
          <Input
            id="bridge-amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.0001"
            className="min-h-[44px] text-lg font-mono"
          />
        </div>

        {/* Recipient Address */}
        <div className="space-y-1.5">
          <Label htmlFor="bridge-recipient" className="text-xs text-muted-foreground">Recipient Address</Label>
          <Input
            id="bridge-recipient"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="min-h-[44px] font-mono text-sm"
          />
        </div>

        {/* Quote Display */}
        {loading && !quote && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Calculating fees...
          </div>
        )}

        {quote && (
          <div className="rounded-lg p-4 bg-muted border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Fuel className="h-3.5 w-3.5" /> Network Fee (LayerZero)
              </span>
              <span className="text-sm font-mono">{quote.fees.lzGasCostHuman}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">SwapPulse Fee</span>
              <span className="text-sm font-mono text-primary">{quote.fees.swapPulseFeeHuman}</span>
            </div>
            <div className="border-t border-border pt-2 flex items-center justify-between">
              <span className="text-sm font-semibold">Total Cost</span>
              <span className="text-sm font-mono font-bold">{quote.fees.totalHuman}</span>
            </div>
            <p className="text-xs text-muted-foreground">Estimated delivery: {quote.estimatedDelivery}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div role="alert" aria-live="polite" className="flex items-start gap-2 rounded-lg p-3 bg-destructive/10 border border-destructive/30">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div role="alert" aria-live="polite" className="flex items-start gap-2 rounded-lg p-3 bg-success/10 border border-success/30">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
            <p className="text-sm text-success">Transfer submitted! Tokens will arrive within 1-5 minutes.</p>
          </div>
        )}

        {/* Send Button */}
        <Button
          onClick={handleTransfer}
          disabled={!amount || parseFloat(amount) <= 0 || !recipient || loading}
          className="w-full min-h-[44px] text-base"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Sending...
            </>
          ) : (
            'Send $PULSE'
          )}
        </Button>

        {/* Wallet Unlock Modal */}
        {showUnlock && (
          <UnlockWalletModal
            onClose={() => setShowUnlock(false)}
            onSuccess={handleUnlockComplete}
          />
        )}
      </CardContent>
    </Card>
  );
}