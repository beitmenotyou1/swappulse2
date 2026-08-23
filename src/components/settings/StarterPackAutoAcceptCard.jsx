import React, { useState } from 'react';
import { PackageCheck, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';

// Auto-accept toggle for starter pack inclusion requests. When enabled, any
// collector who adds you to their starter pack bypasses the accept/deny step —
// you're added to the pack's confirmed members immediately. Stored on the
// user's profile data (data.auto_accept_starter_pack).
export default function StarterPackAutoAcceptCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(!!user?.data?.auto_accept_starter_pack);
  const [saving, setSaving] = useState(false);

  const toggle = async (value) => {
    setEnabled(value);
    setSaving(true);
    try {
      await base44.auth.updateMe({ auto_accept_starter_pack: value });
    } catch (e) {
      setEnabled(!value);
      toast({ title: 'Could not save preference', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><PackageCheck className="h-3.5 w-3.5 text-primary" /> Auto-accept starter pack requests</p>
          <p className="text-xs text-muted-foreground">When someone adds you to a starter pack, join automatically without being asked.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <Switch checked={enabled} onCheckedChange={toggle} />
        </div>
      </div>
    </div>
  );
}