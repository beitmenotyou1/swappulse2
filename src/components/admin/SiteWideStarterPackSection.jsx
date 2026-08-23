import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2, Check, Star } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

// Admin section to designate the site-wide newcomer welcome StarterPack.
// Only one pack may be site-wide at a time; setting a new one clears the rest.
export default function SiteWideStarterPackSection() {
  const { toast } = useToast();
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [setting, setSetting] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.StarterPack.filter({}, '-created_date', 50).catch(() => []);
      setPacks(rows);
    } catch {
      setPacks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSet = async (packId) => {
    setSetting(packId);
    try {
      await base44.functions.invoke('set-site-wide-starter-pack', { starterPackId: packId });
      toast({ title: packId ? 'Site-wide pack updated' : 'Site-wide pack removed' });
      load();
    } catch (e) {
      toast({ title: 'Could not update', description: e.message, variant: 'destructive' });
    } finally {
      setSetting(null);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Site-wide Starter Pack</h3>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        The selected pack is shown to newcomers on their Home feed with a one-tap "Follow all" action. Only one pack can be site-wide at a time.
      </p>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : packs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No starter packs exist yet.</p>
      ) : (
        <div className="space-y-2">
          {packs.map((pack) => (
            <div key={pack.id} className="flex items-center justify-between rounded-xl border border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{pack.name}</p>
                <p className="text-xs text-muted-foreground">{pack.category} · {(pack.member_dids || []).length} members</p>
              </div>
              {pack.is_site_wide ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                  <Star className="h-3 w-3" /> Site-wide
                </span>
              ) : (
                <button
                  onClick={() => handleSet(pack.id)}
                  disabled={setting === pack.id}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                >
                  {setting === pack.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Set as site-wide
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}