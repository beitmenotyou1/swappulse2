import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader2, X, Rss, Pin } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Feed picker for the starter pack composer. Shows the author's subscribed
// feeds first as tappable chips, with a search box that queries all
// discoverable feed generators. Selecting a feed calls onAdd with its URI
// and display name.
export default function FeedSearchInput({ onAdd, excludeUris = [] }) {
  const [query, setQuery] = useState('');
  const [subscribed, setSubscribed] = useState([]);
  const [discoverable, setDiscoverable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke('search-feeds', { query, limit: 20 });
        setSubscribed(res.data?.subscribed || []);
        setDiscoverable(res.data?.discoverable || []);
        setOpen(true);
      } catch {
        setSubscribed([]);
        setDiscoverable([]);
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

  const pick = (uri, name) => {
    onAdd?.(uri, name);
    setQuery('');
    setSubscribed([]);
    setDiscoverable([]);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => (subscribed.length || discoverable.length) && setOpen(true)}
          placeholder="Search feeds — subscribed or discoverable…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
        {query && !loading && (
          <button onClick={() => { setQuery(''); setSubscribed([]); setDiscoverable([]); }} aria-label="Clear" className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && (subscribed.length > 0 || discoverable.length > 0) && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-elevated">
          {subscribed.length > 0 && (
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Your subscribed feeds</div>
          )}
          {subscribed.map((s) => {
            const excluded = excludeUris.includes(s.feed_uri);
            return (
              <button
                key={s.feed_uri}
                type="button"
                disabled={excluded}
                onClick={() => pick(s.feed_uri, s.feed_name)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Pin className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.feed_name}</span>
                {excluded && <span className="shrink-0 text-[10px] text-muted-foreground">added</span>}
              </button>
            );
          })}
          {discoverable.length > 0 && (
            <div className="border-t border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Discoverable</div>
          )}
          {discoverable.map((f) => {
            const excluded = excludeUris.includes(f.uri);
            return (
              <button
                key={f.uri}
                type="button"
                disabled={excluded}
                onClick={() => pick(f.uri, f.displayName)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground"><Rss className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{f.displayName}</p>
                  {f.description && <p className="truncate text-xs text-muted-foreground">{f.description}</p>}
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