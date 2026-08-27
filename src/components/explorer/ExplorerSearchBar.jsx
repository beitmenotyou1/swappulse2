import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useT } from '@/lib/i18n/I18nProvider';

// Top search bar — accepts an address, transaction hash, or block number,
// calls the pulse-explorer-search backend function to detect the type, and
// navigates to the matching detail page.
export default function ExplorerSearchBar() {
  const t = useT();
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
      setError(err?.response?.data?.message || err?.response?.data?.error || t('explorer.searchFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSearch} className="w-full">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-base transition-shadow focus-within:ring-2 focus-within:ring-ring focus-within:shadow-raised sm:px-3.5 sm:py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setError(''); }}
          placeholder={t('explorer.searchPlaceholder')}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50 sm:px-3.5"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('explorer.search')}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </form>
  );
}