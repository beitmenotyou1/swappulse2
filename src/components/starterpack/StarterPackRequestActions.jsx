import React, { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

// Accept / Deny buttons shown on a starter_pack inclusion-request notification
// card. Calls respond-starter-pack-request and dismisses the notification on
// success. Only rendered for 'request' kind notifications (not for the
// accepted/denied receipts sent back to the author).
export default function StarterPackRequestActions({ n, onResponded }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(null);
  const requestId = n.metadata?.requestId;
  if (!requestId) return null;

  const respond = async (accept) => {
    setBusy(accept ? 'accept' : 'deny');
    try {
      const res = await base44.functions.invoke('respond-starter-pack-request', { requestId, accept });
      if (res.data?.ok) {
        toast({ title: accept ? 'You joined the starter pack' : 'Request declined' });
        onResponded?.(n.id);
      } else {
        toast({ title: 'Could not respond', description: res.data?.error, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Could not respond', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => respond(true)}
        disabled={!!busy}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition hover:bg-primary/90 disabled:opacity-60"
      >
        {busy === 'accept' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Accept
      </button>
      <button
        onClick={() => respond(false)}
        disabled={!!busy}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted-foreground transition hover:bg-secondary disabled:opacity-60"
      >
        {busy === 'deny' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
        Deny
      </button>
    </div>
  );
}