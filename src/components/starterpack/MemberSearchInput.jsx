import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader2, X, UserCheck, Globe } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Avatar from '@/components/Avatar';

// Friends-first collector search for the starter pack composer. Typing a
// username queries search-pack-members; results show friends first, then
// SwapPulse members, then the wider fediverse. Selecting a collector calls
// onAdd with their identity.
export default function MemberSearchInput({ onAdd, excludeDids = [] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke('search-pack-members', { query, limit: 20 });
        setResults(res.data?.results || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const pick = (r) => {
    onAdd?.(r);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search a username to add…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
        {query && !loading && (
          <button onClick={() => { setQuery(''); setResults([]); }} aria-label="Clear" className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-elevated">
          {results.map((r) => {
            const excluded = excludeDids.includes(r.did);
            return (
              <button
                key={r.did}
                type="button"
                disabled={excluded}
                onClick={() => pick(r)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Avatar name={r.displayName} src={r.avatar} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">@{r.handle}</p>
                </div>
                {r.isFriend ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    <UserCheck className="h-3 w-3" /> Friend
                  </span>
                ) : r.isMember ? (
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Member</span>
                ) : (
                  <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    <Globe className="h-2.5 w-2.5" /> Bluesky
                  </span>
                )}
                {excluded && <span className="shrink-0 text-[10px] text-muted-foreground">added</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}