import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Activity, Zap, Database, Bookmark, X } from 'lucide-react';
import { Image } from '@/components/ui/image';

const LOGO_URL = 'https://media.base44.com/images/public/6a63d9d64a4d65d370c70892/32ce16a82_a_transparent_version_of_the_socialpulse_logo_a_digital_pulse_line_forming_an_s1.png';
import { base44 } from '@/api/base44Client';
import { useT } from '@/lib/i18n/I18nProvider';
import { formatNumber } from '@/lib/explorerFormat';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ExplorerSearchBar from './ExplorerSearchBar';
import ExplorerChainDropdown from './ExplorerChainDropdown';
import BookmarkPanel from './BookmarkPanel';
import { getActiveChain } from '@/lib/explorerChain';

// Standalone full-screen layout for the blockchain explorer. Escapes the
// main app shell entirely — own top nav (logo, global search, language
// switcher, back-to-SwapPulse link) and a live chain stat strip. All child
// explorer routes render via <Outlet />.
export default function ExplorerLayout() {
  const t = useT();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const chainKey = getActiveChain(searchParams);
  const [stats, setStats] = useState(null);
  const [showBookmarks, setShowBookmarks] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('multi-chain-explorer', { chain: chainKey, stats_only: true });
      setStats(res.data);
    } catch {
      /* non-fatal — strip just stays empty */
    }
  }, [chainKey]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Refetch stats when navigating between explorer pages so the strip stays fresh
  useEffect(() => { fetchStats(); /* light refresh on route change */ }, [location.pathname, fetchStats]);

  const cursor = stats?.cursor;
  const chainHead = stats?.chain_head;
  const chainInfo = stats?.chain;
  const blocksBehind = cursor && chainHead != null ? chainHead - cursor.last_indexed_block : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          {/* Logo */}
          <Link to="/blockchain" className="flex shrink-0 items-center gap-2">
            <Image
              src={LOGO_URL}
              alt="SwapPulse"
              fittingType="fit"
              className="h-8 w-8 rounded-lg sm:h-9 sm:w-9"
            />
            <span className="hidden text-lg font-extrabold tracking-tight md:inline">
              <span className="text-gradient-pulse">PulseChain</span> Explorer
            </span>
          </Link>

          {/* Global search — center, grows */}
          <div className="min-w-0 flex-1">
            <ExplorerSearchBar />
          </div>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <ExplorerChainDropdown />
            <button
              onClick={() => setShowBookmarks(true)}
              className="inline-flex items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
              title={t('explorer.bookmarkedAddresses')}
              aria-label={t('explorer.bookmarkedAddresses')}
            >
              <Bookmark className="h-4 w-4" />
            </button>
            <LanguageSwitcher compact />
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full p-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title={t('explorer.backToApp')}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden lg:inline">{t('explorer.backToApp')}</span>
            </Link>
          </div>
        </div>

        {/* Chain stat strip */}
        {stats && (
          <div className="border-t border-border bg-secondary/30">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 text-xs sm:gap-x-6 sm:px-4">
              {chainInfo && (
                <span className="inline-flex items-center gap-1.5 font-bold text-foreground">
                  {chainInfo.isMain && <span className="text-primary">★</span>}
                  {chainInfo.name}
                </span>
              )}
              {chainHead != null && (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Activity className="h-3.5 w-3.5 text-success" />
                  {t('explorer.chainHead')}:
                  <span className="font-bold text-foreground">#{formatNumber(chainHead)}</span>
                </span>
              )}
              {chainInfo && !cursor && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  {t('explorer.chainId')}: <span className="font-semibold text-foreground">{chainInfo.chainId}</span>
                  · {chainInfo.symbol}
                </span>
              )}
              {cursor && (
                <>
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Database className="h-3.5 w-3.5 text-primary" />
                    {t('explorer.indexedTo')}:
                    <span className="font-semibold text-foreground">#{formatNumber(cursor.last_indexed_block)}</span>
                  </span>
                  {blocksBehind != null && (
                    <span className={`inline-flex items-center gap-1.5 font-medium ${blocksBehind > 5 ? 'text-warning' : 'text-success'}`}>
                      <Zap className="h-3.5 w-3.5" />
                      {blocksBehind > 0 ? t('explorer.blocksBehind', { count: formatNumber(blocksBehind) }) : t('explorer.upToDate')}
                    </span>
                  )}
                  <span className="ml-auto text-muted-foreground">
                    {formatNumber(cursor.blocks_indexed_total || 0)} {t('explorer.stat.blocks')} · {formatNumber(cursor.txs_indexed_total || 0)} {t('explorer.stat.txs')}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex gap-6">
          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
          <aside className="hidden w-72 shrink-0 lg:block">
            <div className="sticky top-24 space-y-4">
              <BookmarkPanel />
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile bookmark slide-in panel */}
      {showBookmarks && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowBookmarks(false)} />
          <div className="absolute right-0 top-0 h-full w-80 max-w-[85vw] overflow-y-auto bg-background p-4 shadow-elevated">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t('explorer.bookmarkedAddresses')}</h2>
              <button onClick={() => setShowBookmarks(false)} className="rounded-lg p-1.5 hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <BookmarkPanel />
          </div>
        </div>
      )}
    </div>
  );
}