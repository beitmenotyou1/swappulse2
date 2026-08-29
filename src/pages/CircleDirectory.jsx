import React, { useEffect, useState, useCallback } from 'react';
import { Link, Loader2, Users, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import useSEO from '@/hooks/useSEO';

const THEMES = ['all', 'general', 'vintage', 'competitive', 'shiny', 'investment', 'local_region', 'artist'];

const THEME_LABELS = {
  general: 'General', vintage: 'Vintage', competitive: 'Competitive', shiny: 'Shiny',
  investment: 'Investment', local_region: 'Local / Regional', artist: 'Artist',
};

export default function CircleDirectory() {
  useSEO({
    title: 'Circle Directory',
    description: 'Browse and join Pokémon TCG collector circles by theme, era, and region on SwapPulse.',
    canonicalPath: '/circles-directory',
  });
  const [circles, setCircles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filter = theme === 'all' ? { visibility: 'public' } : { visibility: 'public', theme };
      const res = await base44.entities.Circle.filter(filter, '-created_date', 100);
      let list = res || [];
      if (query.trim()) {
        const q = query.toLowerCase();
        list = list.filter((c) => (c.name || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q));
      }
      setCircles(list);
    } catch { setCircles([]); } finally { setLoading(false); }
  }, [theme, query]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader title="Circle Directory" subtitle="Find your community. Filter by theme, era, or region." />
      <div className="mx-auto max-w-2xl px-4 py-4 pb-24 md:pb-8">
        <div className="mb-3 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search circles…"
            className="flex-1 bg-transparent text-sm outline-none"
           aria-label="Search circles…"/>
        </div>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {THEMES.map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${theme === t ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
            >
              {t === 'all' ? 'All' : THEME_LABELS[t] || t}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : circles.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No circles match.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {circles.map((c) => (
              <Link key={c.id} to={`/circles/${c.id}`} className="block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-raised">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"><Users className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{THEME_LABELS[c.theme] || c.theme} · {c.member_count || 1} members</p>
                  </div>
                </div>
                {c.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}