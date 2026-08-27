import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Top search bar — accepts an address, transaction hash, or block number,
// calls the pulse-explorer-search backend function to detect the type, and
// navigates to the matching detail page.
export default function ExplorerSearchBar({ placeholder = 'Search by Address / Txn Hash / Block' }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('pulse-explorer-search', { query: q });
      const data = res.data;
      if (data?.redirect) {
        navigate(data.redirect);
      } else if (data?.message) {
        setError(data.message);
      } else if (data?.error) {
        setError(data.error);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSearch} className="w-full">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-base focus-within:ring-2 focus-within:ring-ring">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setError(''); }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </form>
  );
}