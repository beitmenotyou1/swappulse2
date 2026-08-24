import React, { useState } from 'react';
import { AlertTriangle, Copy, Check, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

// Full-screen modal that displays the 24-word seed phrase with a warning.
// The user must check "I've written it down" before they can dismiss.
// Used during wallet creation and when viewing the seed phrase from settings.
export default function SeedPhraseModal({ open, mnemonic, title = 'Your Recovery Phrase', onClose }) {
  const { toast } = useToast();
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  const words = mnemonic ? mnemonic.split(' ') : [];

  const handleCopy = () => {
    navigator.clipboard.writeText(mnemonic || '');
    setCopied(true);
    toast({ title: 'Copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Write down these 24 words and store them somewhere safe. Anyone with this phrase can access your wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Never share your recovery phrase. SwapPulse will never ask for it.
        </div>

        {words.length > 0 && (
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-secondary/50 p-4 sm:grid-cols-4">
            {words.map((word, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-md bg-card px-2 py-1.5">
                <span className="text-[10px] font-bold text-muted-foreground">{i + 1}.</span>
                <span className="font-mono text-xs font-semibold">{word}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy phrase'}
          </button>
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="h-4 w-4 rounded accent-primary"
          />
          <span className="text-xs text-muted-foreground">
            I've written down my recovery phrase and understand it cannot be recovered if lost.
          </span>
        </label>

        <Button
          onClick={onClose}
          disabled={!confirmed}
          className="w-full"
        >
          {confirmed ? "I've stored it safely" : 'Confirm to continue'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}