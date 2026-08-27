import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useT } from '@/lib/i18n/I18nProvider';
import { getActiveChain } from '@/lib/explorerChain';

// Top search bar — accepts an address, transaction hash, or block number,
// calls the pulse-explorer-search backend function to detect the type, and
// navigates to the matching detail page.
export default function ExplorerSearchBar() {
  const t = useT();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chain = getActiveChain(searchParams);

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('pulse-explorer-search', { query: q, chain });
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
      <div className="flex items-center gap-2 rounded-xl border border-border-strong bg-card px-3.5 py-2.5 shadow-base transition-shadow focus-within:ring-2 focus-within:ring-ring focus-within:shadow-raised sm:px-4 sm:py-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground sm:h-5 sm:w-5" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setError(''); }}
          placeholder={t('explorer.searchAddressPlaceholder')}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground sm:text-base"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50 sm:px-4"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('explorer.search')}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </form>
  );
}