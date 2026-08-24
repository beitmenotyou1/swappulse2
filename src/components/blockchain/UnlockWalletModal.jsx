import React, { useState, useEffect } from 'react';
import { Fingerprint, Lock, Loader2, KeyRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { startAuthentication } from '@simplewebauthn/browser';

// Modal that handles wallet unlock via passkey (WebAuthn) or PIN.
// The caller passes `unlockState` ({ hasPasskey, hasPin }) to determine which
// unlock method(s) to offer. On success, calls onUnlock with the credential.
export default function UnlockWalletModal({ open, unlockState, onUnlock, onCancel }) {
  const { toast } = useToast();
  const [mode, setMode] = useState('passkey'); // 'passkey' | 'pin'
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const hasPasskey = unlockState?.hasPasskey;
  const hasPin = unlockState?.hasPin;

  useEffect(() => {
    if (open) {
      setMode(hasPasskey ? 'passkey' : 'pin');
      setPin('');
      setBusy(false);
      // Auto-trigger passkey auth if that's the only method
      if (hasPasskey && !hasPin) {
        doPasskeyAuth();
      }
    }
  }, [open]);

  const doPasskeyAuth = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('get-wallet-unlock-options', {});
      const { options, challenge, challenge_signature } = res.data;
      const assertion = await startAuthentication(options);
      onUnlock({ type: 'passkey', assertion, challenge, challenge_signature });
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        // User cancelled the passkey prompt
        onCancel();
      } else {
        toast({ title: 'Passkey failed', description: e.message || 'Authentication error', variant: 'destructive' });
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePinSubmit = () => {
    if (pin.length < 4) return;
    onUnlock({ type: 'pin', pin });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Unlock Wallet
          </DialogTitle>
          <DialogDescription>
            Authenticate to authorize this on-chain action.
          </DialogDescription>
        </DialogHeader>

        {busy ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {mode === 'passkey' ? 'Waiting for passkey...' : 'Verifying...'}
            </p>
          </div>
        ) : mode === 'passkey' ? (
          <div className="space-y-4">
            <button
              onClick={doPasskeyAuth}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90"
            >
              <Fingerprint className="h-5 w-5" />
              Authenticate with Passkey
            </button>
            {hasPin && (
              <button
                onClick={() => setMode('pin')}
                className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Use PIN instead
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <Lock className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-semibold">Enter your wallet PIN</p>
              <InputOTP
                maxLength={6}
                value={pin}
                onChange={(v) => setPin(v)}
                onComplete={handlePinSubmit}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <button
              onClick={handlePinSubmit}
              disabled={pin.length < 4}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              Unlock
            </button>
            {hasPasskey && (
              <button
                onClick={() => setMode('passkey')}
                className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <Fingerprint className="h-3.5 w-3.5" />
                Use passkey instead
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}