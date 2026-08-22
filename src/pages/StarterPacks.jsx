import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Loader2, Package } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import StarterPackCard from '@/components/starterpack/StarterPackCard';
import StarterPackComposer from '@/components/starterpack/StarterPackComposer';
import useSEO from '@/hooks/useSEO';
import { useAuth } from '@/lib/AuthContext';

const CATEGORIES = ['all', 'vintage', 'modern', 'competitive', 'investment', 'sealed', 'japanese', 'trading', 'general'];

export default function StarterPacks() {
  useSEO({
    title: 'Starter Packs',
    description: 'Onboarding bundles of collectors, circles, and feeds for every Pokémon TCG niche on SwapPulse.',
    canonicalPath: '/starter-packs',
  });
  const { user } = useAuth();
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [composerOpen, setComposerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filter = category === 'all' ? {} : { category };
      const res = await base44.entities.StarterPack.filter(filter, '-created_date', 50);
      setPacks(res || []);
    } catch {
      setPacks([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader title="Starter Packs" subtitle="Bundles of collectors, circles, and feeds to onboard you into any niche.">
        {user?.id && (
          <button onClick={() => setComposerOpen(true)} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New Pack
          </button>
        )}
      </PageHeader>

      <div className="mx-auto max-w-2xl px-4 py-4 pb-24 md:pb-8">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${category === c ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
            >
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : packs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No starter packs yet. Create the first one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {packs.map((p) => <StarterPackCard key={p.id} pack={p} />)}
          </div>
        )}
      </div>

      <StarterPackComposer open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={load} />
    </div>
  );
}