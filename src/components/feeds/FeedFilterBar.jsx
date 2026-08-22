import React, { useState, useEffect } from 'react';
import { Filter, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// FeedFilterBar — granular controls for custom feeds. Lets users filter feed
// content by card series (set name text search) and community-created labels
// (chips populated from approved CommunityLabelers). Calls onChange with
// { set, labels } whenever the filters change.
export default function FeedFilterBar({ onChange }) {
  const [setLabelers, setSetLabelers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [setQuery, setSetQuery] = useState('');
  const [activeLabels, setActiveLabels] = useState([]);

  // Fetch approved community labelers so the label chips are populated.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const labelers = await base44.entities.CommunityLabeler.filter(
          { approval_status: 'approved' },
          '-created_date',
          50,
        );
        if (!alive) return;
        // Flatten all label_values across labelers, dedup
        const all = new Set();
        (labelers || []).forEach((l) => {
          (l.label_values || []).forEach((v) => all.add(v));
        });
        setSetLabelers(Array.from(all).sort());
      } catch {
        /* ignore */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Notify parent on filter changes
  useEffect(() => {
    onChange?.({ set: setQuery.trim(), labels: activeLabels });
  }, [setQuery, activeLabels, onChange]);

  const toggleLabel = (v) => {
    setActiveLabels((prev) =>
      prev.includes(v) ? prev.filter((l) => l !== v) : [...prev, v],
    );
  };

  const clearAll = () => {
    setSetQuery('');
    setActiveLabels([]);
  };

  const hasFilters = setQuery.trim() || activeLabels.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Filter className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Feed Filters</h3>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="ml-auto flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground hover:bg-secondary/80"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Card series / set name</label>
          <input
            value={setQuery}
            onChange={(e) => setSetQuery(e.target.value)}
            placeholder="e.g. Base Set, Scarlet & Violet, Celebrations…"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Community labels</label>
          {loading ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading labels…</div>
          ) : setLabelers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No approved community labels yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {setLabelers.map((v) => (
                <button
                  key={v}
                  onClick={() => toggleLabel(v)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                    activeLabels.includes(v)
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-secondary text-muted-foreground hover:bg-secondary/80'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}