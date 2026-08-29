import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Target, ChevronDown, ChevronRight, CheckCircle2, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSets, getSet, cardImageUrl, rarityClasses } from '@/lib/tcgdex';
import ChecklistDownloads from '@/components/collection/ChecklistDownloads';

// §4.1 Set Completion dashboard - per-set progress with milestone badges
// (25 / 50 / 75 / 100, matching Achievement set_completion_* types) and a
// missing-cards breakdown fetched from TCGDex.

const MILESTONES = [
  { pct: 25, label: '25%', key: 'set_completion_25' },
  { pct: 50, label: '50%', key: 'set_completion_50' },
  { pct: 75, label: '75%', key: 'set_completion_75' },
  { pct: 100, label: '100%', key: 'set_completion_100' },
];

function milestoneTier(pct) {
  if (pct >= 100) return 'gold';
  if (pct >= 75) return 'ex';
  if (pct >= 50) return 'rare';
  if (pct >= 25) return 'uncommon';
  return null;
}

const TIER_STYLES = {
  uncommon: 'border-rarity-uncommon text-rarity-uncommon',
  rare: 'border-rarity-rare text-rarity-rare',
  ex: 'border-rarity-ex text-rarity-ex',
  gold: 'border-accent text-accent',
};

export default function SetCompletionDashboard({ items }) {
  const [sets, setSets] = useState({});
  const [loadingSets, setLoadingSets] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [setCards, setSetCards] = useState({});
  const [loadingCards, setLoadingCards] = useState({});
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    getSets()
      .then((all) => {
        const map = {};
        for (const s of all) {
          const cc = s.cardCount;
          map[s.id] = {
            name: s.name,
            total: cc && typeof cc === 'object' ? (cc.total ?? cc.official ?? null) : (typeof cc === 'number' ? cc : null),
          };
        }
        if (active) { setSets(map); setLoadingSets(false); }
      })
      .catch(() => active && setLoadingSets(false));
    return () => { active = false; };
  }, []);

  // Group owned cards by set
  const bySet = useMemo(() => {
    const map = {};
    for (const it of items) {
      if (!it.set_id) continue;
      if (!map[it.set_id]) map[it.set_id] = { name: it.set_name || it.set_id, owned: new Map() };
      map[it.set_id].owned.set(it.local_id, it);
    }
    return map;
  }, [items]);

  const completionData = useMemo(() => {
    return Object.entries(bySet).map(([id, v]) => {
      const total = sets[id]?.total ?? null;
      const owned = v.owned.size;
      const pct = total ? Math.min(100, Math.round((owned / total) * 100)) : null;
      return { id, name: v.name, owned, total, pct, tier: milestoneTier(pct ?? 0) };
    }).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  }, [bySet, sets]);

  const filtered = useMemo(() => {
    if (!query.trim()) return completionData;
    const q = query.toLowerCase();
    return completionData.filter((s) => s.name.toLowerCase().includes(q));
  }, [completionData, query]);

  const summary = useMemo(() => {
    let completed = 0, tracked = completionData.length;
    let nearest = null;
    for (const s of completionData) {
      if (s.pct != null && s.pct >= 100) completed++;
      if (s.pct != null && s.pct < 100) {
        if (!nearest || (s.pct > (nearest.pct ?? 0))) nearest = s;
      }
    }
    return { completed, tracked, nearest };
  }, [completionData]);

  const toggle = async (setId) => {
    if (expanded === setId) { setExpanded(null); return; }
    setExpanded(setId);
    if (!setCards[setId] && !loadingCards[setId]) {
      setLoadingCards((p) => ({ ...p, [setId]: true }));
      try {
        const s = await getSet(setId);
        const cards = s?.cards || [];
        const cleaned = cards.map((c) => ({
          localId: c.localId ?? c.id,
          name: c.name,
          image: c.image,
          rarity: c.rarity,
          id: c.id,
        }));
        setSetCards((p) => ({ ...p, [setId]: cleaned }));
      } catch {
        setSetCards((p) => ({ ...p, [setId]: [] }));
      } finally {
        setLoadingCards((p) => ({ ...p, [setId]: false }));
      }
    }
  };

  const renderMissing = (setId) => {
    const all = setCards[setId];
    if (loadingCards[setId]) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>;
    if (!all || !all.length) return <p className="py-2 text-center text-xs text-muted-foreground">No card list available for this set.</p>;
    const owned = bySet[setId]?.owned;
    const missing = all.filter((c) => !owned?.has(c.localId));
    if (missing.length === 0) {
      return (
        <div className="flex items-center gap-1.5 py-3 text-sm font-semibold text-accent">
          <CheckCircle2 className="h-4 w-4" /> Set complete! Every card owned.
        </div>
      );
    }
    return (
      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">{missing.length} card{missing.length === 1 ? '' : 's'} missing</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {missing.slice(0, 30).map((c) => {
            const { text } = rarityClasses(c.rarity);
            return (
              <Link key={c.id} to={`/card/${c.id}`} className="flex items-center gap-2 rounded-lg border border-border bg-secondary p-1.5 hover:border-primary/50">
                {cardImageUrl(c.image) ? (
                  <img src={cardImageUrl(c.image)} alt="" className="h-12 w-9 rounded object-cover" />
                ) : (
                  <div className="h-12 w-9 rounded bg-background" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{c.name}</p>
                  <p className={`text-[10px] ${text}`}>{c.rarity || '-'} · #{c.localId}</p>
                </div>
              </Link>
            );
          })}
        </div>
        {missing.length > 30 && <p className="mt-2 text-center text-[10px] text-muted-foreground">+ {missing.length - 30} more</p>}
      </div>
    );
  };

  if (loadingSets) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (items.length === 0 || completionData.length === 0) {
    return (
      <div className="px-4 py-20 text-center">
        <Target className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-bold">No sets in progress</p>
        <p className="mt-1 text-sm text-muted-foreground">Add cards to your collection to track set completion and unlock milestones.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Sets Tracked</p>
          <p className="text-lg font-extrabold">{summary.tracked}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-lg font-extrabold text-accent">{summary.completed}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Nearest Milestone</p>
          <p className="truncate text-sm font-extrabold">{summary.nearest ? `${summary.nearest.name} · ${summary.nearest.pct}%` : '-'}</p>
        </div>
      </div>

      {/* Milestone legend */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Milestones:</span>
        {MILESTONES.map((m) => (
          <span key={m.pct} className="rounded-full border border-border bg-secondary px-2 py-0.5">{m.label}</span>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter sets…"
          className="flex-1 bg-transparent text-sm outline-none"
         aria-label="Filter sets…"/>
      </div>

      {/* Set list */}
      <div className="space-y-2">
        {filtered.map((s) => {
          const open = expanded === s.id;
          return (
            <div key={s.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <button onClick={() => toggle(s.id)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-secondary/40">
                {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.owned}{s.total ? `/${s.total}` : ''} owned{s.pct != null ? ` · ${s.pct}%` : ''}
                  </p>
                </div>
                {/* milestone badges */}
                <div className="flex gap-1">
                  {MILESTONES.map((m) => {
                    const reached = (s.pct ?? 0) >= m.pct;
                    return (
                      <span
                        key={m.pct}
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          reached && s.tier
                            ? `${TIER_STYLES[s.tier]} bg-secondary`
                            : 'border-border text-muted-foreground/40'
                        }`}
                      >
                        {m.label}
                      </span>
                    );
                  })}
                </div>
              </button>
              {/* progress bar */}
              <div className="h-1 bg-secondary">
                <div className="h-full bg-primary" style={{ width: `${s.pct ?? 0}%` }} />
              </div>
              {open && (
                <div className="border-t border-border p-3">
                  {renderMissing(s.id)}
                  {setCards[s.id] && setCards[s.id].length > 0 && (
                    <ChecklistDownloads
                      setName={s.name}
                      setId={s.id}
                      totalCards={s.total}
                      allCards={setCards[s.id]}
                      ownedLocalIds={Array.from(bySet[s.id]?.owned?.keys() || [])}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}