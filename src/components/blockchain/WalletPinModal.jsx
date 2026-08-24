import React, { useState } from 'react';
import { KeyRound, Loader2, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

// Modal for setting or changing the wallet PIN.
// If a PIN is already set, the current PIN must be provided for verification.
export default function WalletPinModal({ open, hasExistingPin, onClose, onSuccess }) {
  const { toast } = useToast();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setBusy(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (hasExistingPin && currentPin.length < 4) {
      toast({ title: 'Enter your current PIN', variant: 'destructive' });
      return;
    }
    if (newPin.length < 4) {
      toast({ title: 'PIN must be at least 4 digits', variant: 'destructive' });
      return;
    }
    if (newPin !== confirmPin) {
      toast({ title: 'PINs do not match', variant: 'destructive' });
      return;
    }

    setBusy(true);
    try {
      await base44.functions.invoke('set-wallet-pin', {
        action: 'set',
        pin: newPin,
        currentPin: hasExistingPin ? currentPin : undefined,
      });
      toast({ title: 'PIN set', description: 'Your wallet is now protected with a PIN.' });
      reset();
      onSuccess();
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      toast({ title: 'Could not set PIN', description: msg, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (currentPin.length < 4) {
      toast({ title: 'Enter your current PIN', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await base44.functions.invoke('set-wallet-pin', {
        action: 'remove',
        currentPin,
      });
      toast({ title: 'PIN removed', description: 'Your wallet now uses passkey-only protection.' });
      reset();
      onSuccess();
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      toast({ title: 'Could not remove PIN', description: msg, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            {hasExistingPin ? 'Change Wallet PIN' : 'Set Wallet PIN'}
          </DialogTitle>
          <DialogDescription>
            A PIN is an alternative unlock method. Use it when your passkey isn't available.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hasExistingPin && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Current PIN</label>
              <InputOTP maxLength={6} value={currentPin} onChange={setCurrentPin}>
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
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">New PIN (4-6 digits)</label>
            <InputOTP maxLength={6} value={newPin} onChange={setNewPin}>
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

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Confirm PIN</label>
            <InputOTP maxLength={6} value={confirmPin} onChange={setConfirmPin}>
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

          <Button onClick={handleSubmit} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            {hasExistingPin ? 'Update PIN' : 'Set PIN'}
          </Button>

          {hasExistingPin && (
            <button
              onClick={handleRemove}
              disabled={busy}
              className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-destructive hover:underline"
            >
              <X className="h-3.5 w-3.5" /> Remove PIN
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}