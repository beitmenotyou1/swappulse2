import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader2, X, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Circle picker for the starter pack composer. Searches local SwapPulse circles
// by name (the Circle entity is publicly readable). Selecting a circle calls
// onAdd with its id and name.
export default function CircleSearchInput({ onAdd, excludeIds = [] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const debounceRef = useRef(null);
  const cacheRef = useRef(null);

  // Load all circles once (public read), then filter client-side by name.
  useEffect(() => {
    if (cacheRef.current) return;
    (async () => {
      setLoading(true);
      try {
        const list = await base44.entities.Circle.list('-created_date', 200);
        cacheRef.current = list || [];
      } catch {
        cacheRef.current = [];
      } finally {
        setLoading(false);
        applyFilter();
      }
    })();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [query]);

  const applyFilter = () => {
    const all = cacheRef.current || [];
    if (!query.trim()) {
      setResults(all.slice(0, 20));
      return;
    }
    const q = query.toLowerCase();
    setResults(all.filter((c) => (c.name || '').toLowerCase().includes(q)).slice(0, 20));
  };

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const pick = (c) => {
    onAdd?.(c.id, c.name);
    setQuery('');
    setResults(cacheRef.current?.slice(0, 20) || []);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search circles by name…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
        {query && !loading && (
          <button onClick={() => { setQuery(''); applyFilter(); }} aria-label="Clear" className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-elevated">
          {results.map((c) => {
            const excluded = excludeIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                disabled={excluded}
                onClick={() => pick(c)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent"><Sparkles className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  {c.description && <p className="truncate text-xs text-muted-foreground">{c.description}</p>}
                </div>
                {excluded && <span className="shrink-0 text-[10px] text-muted-foreground">added</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}