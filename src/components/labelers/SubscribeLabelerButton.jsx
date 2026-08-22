import React, { useState } from 'react';
import { Loader2, Check, Bell } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export default function SubscribeLabelerButton({ labeler, subscribed, onToggle }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const isSubscribed = !!subscribed;

  const toggle = async () => {
    if (!user?.id) return;
    setBusy(true);
    try {
      if (isSubscribed) {
        await base44.entities.LabelerSubscription.delete(subscribed.id);
        onToggle?.(labeler, false);
        toast({ title: 'Unsubscribed' });
      } else {
        const created = await base44.entities.LabelerSubscription.create({
          did: user.data?.did || '',
          labeler_id: labeler.id,
          labeler_ref: labeler.at_uri || '',
        });
        onToggle?.(labeler, true, created);
        toast({ title: 'Subscribed to labeler' });
      }
    } catch (err) {
      toast({ title: 'Could not update', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy || !user?.id || labeler.approval_status !== 'approved'}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${isSubscribed ? 'bg-secondary text-muted-foreground' : 'bg-primary text-white hover:bg-primary/90'}`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isSubscribed ? <Check className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
      {isSubscribed ? 'Subscribed' : 'Subscribe'}
    </button>
  );
}