import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import CreateCircleModal from '@/components/circles/CreateCircleModal';
import useSEO from '@/hooks/useSEO';

const THEME_LABEL = {
  general: 'General', vintage: 'Vintage', competitive: 'Competitive', shiny: 'Shiny',
  investment: 'Investment', local_region: 'Local', artist: 'Artist',
};

function CircleCard({ c, membership }) {
  return (
    <Link to={`/circles/${c.id}`} className="block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-raised">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{c.name}</p>
          <p className="text-xs text-muted-foreground">
            {THEME_LABEL[c.theme] || c.theme} · {c.member_count || 1} member{(c.member_count || 1) === 1 ? '' : 's'}
          </p>
        </div>
        {membership === 'curator' && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">Curator</span>
        )}
        {membership === 'member' && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">Member</span>
        )}
      </div>
      {c.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
    </Link>
  );
}

export default function Circles() {
  useSEO({
    title: 'Circles',
    description: 'Join themed Pokémon TCG collector circles on SwapPulse, vintage, competitive, shiny, regional, and more.',
    canonicalPath: '/circles',
  });
  const [mine, setMine] = useState([]);
  const [discover, setDiscover] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [myRes, publicCircles] = await Promise.all([
        base44.functions.invoke('getMyCircles', {}),
        base44.entities.Circle.filter({ visibility: 'public' }, '-created_date', 50),
      ]);
      const myCircles = myRes.data?.circles || [];
      setMine(myCircles);
      const myIds = new Set(myCircles.map((c) => c.id));
      setDiscover(publicCircles.filter((c) => !myIds.has(c.id)));
    } catch {
      setMine([]);
      setDiscover([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader title="Circles" subtitle="Curated member groups with scoped trades">
        <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New circle
        </button>
      </PageHeader>

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-4 pb-24 md:pb-8">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            {mine.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Your circles</h2>
                <div className="space-y-3">
                  {mine.map((c) => (
                    <CircleCard key={c.id} c={c} membership={c.isCurator ? 'curator' : 'member'} />
                  ))}
                </div>
              </section>
            )}
            {discover.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Discover</h2>
                <div className="space-y-3">
                  {discover.map((c) => (
                    <CircleCard key={c.id} c={c} />
                  ))}
                </div>
              </section>
            )}
            {mine.length === 0 && discover.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <Users className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No circles yet. Create the first one.</p>
              </div>
            )}
          </>
        )}
      </div>

      <CreateCircleModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </div>
  );
}