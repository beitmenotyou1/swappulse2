import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Users, Loader2, UserPlus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

// Site-wide newcomer welcome card. Fetches the admin-curated StarterPack
// (is_site_wide=true) and offers a one-tap "Follow all & join circles" action
// that bulk-creates follows and circle memberships via follow-starter-pack.
export default function SiteWidePackCard() {
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await base44.entities.StarterPack.filter({ is_site_wide: true }, '-created_date', 1).catch(() => []);
        if (active) setPack(rows[0] || null);
      } catch {
        if (active) setPack(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) return null;
  if (!pack) return null;

  const handleFollowAll = async () => {
    setJoining(true);
    try {
      const res = await base44.functions.invoke('follow-starter-pack', { packId: pack.id });
      const data = res?.data || res;
      toast({
        title: 'Welcome to SwapPulse!',
        description: `You're now following ${data?.followed || 'all'} collectors and joined ${data?.joined || 0} circles.`,
      });
    } catch (e) {
      toast({ title: 'Could not follow pack', description: e.message, variant: 'destructive' });
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="mx-4 my-3 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5">
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-base font-extrabold">{pack.name || 'Welcome to SwapPulse'}</h2>
        </div>
        {pack.description && <p className="text-sm text-muted-foreground">{pack.description}</p>}
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {(pack.member_dids || []).length} collectors</span>
          <span className="inline-flex items-center gap-1"><UserPlus className="h-3 w-3" /> {(pack.circle_ids || []).length} circles</span>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleFollowAll}
            disabled={joining}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Follow all & join circles
          </button>
          <Link
            to={`/starter-packs/${pack.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            View pack
          </Link>
        </div>
      </div>
    </div>
  );
}