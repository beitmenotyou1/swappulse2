import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';

const CONFIRM_WORD = 'DELETE';

export default function DeleteAccountSection() {
  const [step, setStep] = useState(0); // 0 = closed, 1-3 = modals, 4 = loading
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');

  const reset = () => {
    setStep(0);
    setConfirmText('');
    setError('');
  };

  const handleFinalConfirm = async () => {
    setStep(4);
    setError('');
    try {
      const res = await base44.functions.invoke('delete-account', {});
      if (res?.data?.ok) {
        // Clear all local cached state
        try { localStorage.clear(); } catch {}
        try { sessionStorage.clear(); } catch {}
        // Destroy the session and redirect to the goodbye page
        await base44.auth.logout('/account-deleted');
      } else {
        setError(res?.data?.error || 'Deletion failed. Please try again or contact support.');
        setStep(3);
      }
    } catch (e) {
      setError(e?.message || 'Deletion failed. Please try again or contact support.');
      setStep(3);
    }
  };

  return (
    <>
      {/* Danger Zone card */}
      <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-destructive/10 p-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-destructive">Danger zone</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Permanently delete your account and all associated data. This action is irreversible;
              your collection, trades, posts, binders, and reputation will be erased forever.
            </p>
            <Button
              variant="destructive"
              size="sm"
              className="mt-3"
              onClick={() => setStep(1)}
            >
              <AlertTriangle className="h-4 w-4" /> Delete account
            </Button>
          </div>
        </div>
      </div>

      {/* Step 1, first confirmation */}
      <Dialog open={step === 1} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 rounded-full bg-destructive/10 p-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">Permanently delete your account?</DialogTitle>
            <DialogDescription className="text-center text-sm">
              Are you sure you want to permanently delete your account? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={reset}>Cancel</Button>
            <Button variant="destructive" onClick={() => setStep(2)}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2, second confirmation */}
      <Dialog open={step === 2} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 rounded-full bg-destructive/10 p-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">All data will be lost</DialogTitle>
            <DialogDescription className="text-center text-sm">
              Once your account is deleted, all your data will be lost forever. Do you wish to continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={reset}>Cancel</Button>
            <Button variant="destructive" onClick={() => setStep(3)}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 3, final confirmation with type-to-confirm */}
      <Dialog open={step === 3} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 rounded-full bg-destructive/10 p-3">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">Final confirmation</DialogTitle>
            <DialogDescription className="text-center text-sm">
              Please confirm again: Do you really want to delete your account permanently?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Type <span className="font-mono font-bold text-destructive">{CONFIRM_WORD}</span> to confirm:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_WORD}
              className="font-mono"
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={reset}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={confirmText !== CONFIRM_WORD}
              onClick={handleFinalConfirm}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading overlay */}
      <Dialog open={step === 4}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 className="h-10 w-10 animate-spin text-destructive" />
            <p className="text-sm font-semibold">Deleting your account…</p>
            <p className="text-center text-xs text-muted-foreground">
              Erasing your collection, trades, posts, and federated data. This may take a few seconds.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}