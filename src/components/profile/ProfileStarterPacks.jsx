import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Renders a collector's authored Starter Packs on their profile. Clicking a
// pack opens the pack detail page where a visitor can follow all members.
export default function ProfileStarterPacks({ did }) {
  const [packs, setPacks] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!did) { setPacks([]); setLoading(false); return; }
    (async () => {
      try {
        const rows = await base44.entities.StarterPack.filter({ did }, '-created_date', 10).catch(() => []);
        if (active) setPacks(rows);
      } catch {
        if (active) setPacks([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [did]);

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!packs || !packs.length) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Starter Packs</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {packs.map((pack) => (
          <Link
            key={pack.id}
            to={`/starter-packs/${pack.id}`}
            className="group rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-secondary"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold group-hover:text-primary">{pack.name}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{pack.description || pack.category}</p>
              </div>
              {pack.is_site_wide && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">SITE-WIDE</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {(pack.member_dids || []).length} collectors
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}