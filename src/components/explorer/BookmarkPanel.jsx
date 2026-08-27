import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bookmark, Trash2, ExternalLink, Wallet } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';
import { useExplorerBookmarks } from '@/hooks/useExplorerBookmarks';
import { truncateHash } from '@/lib/explorerFormat';
import { getChainMeta } from '@/lib/explorerChains';
import { chainQuery } from '@/lib/explorerChain';

// Sidebar panel listing bookmarked wallet addresses. Each row shows the
// label, truncated address, chain badge, and a link to jump to the address
// detail page. Bookmarks can be removed from the panel.
export default function BookmarkPanel() {
  const t = useT();
  const [searchParams] = useSearchParams();
  const activeChain = searchParams.get('chain') || 'pulse';
  const { bookmarks, loading, removeBookmark } = useExplorerBookmarks();

  return (
    <div className="rounded-xl border border-border bg-card shadow-base">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Bookmark className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{t('explorer.bookmarkedAddresses')}</h2>
        <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {bookmarks.length}
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-3 border-secondary border-t-primary" />
        </div>
      )}

      {!loading && bookmarks.length === 0 && (
        <div className="px-4 py-8 text-center">
          <Bookmark className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-2 text-sm font-medium text-muted-foreground">{t('explorer.noBookmarks')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">{t('explorer.noBookmarksDesc')}</p>
        </div>
      )}

      {!loading && bookmarks.length > 0 && (
        <div className="max-h-96 divide-y divide-border overflow-y-auto">
          {bookmarks.map((bm, i) => {
            const meta = getChainMeta(bm.chain);
            const to = `/blockchain/address/${bm.address}${chainQuery(bm.chain)}`;
            return (
              <div key={`${bm.address}-${bm.chain}-${i}`} className="group px-3 py-2.5 transition-colors hover:bg-secondary/30">
                <div className="flex items-start justify-between gap-2">
                  <Link to={to} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {bm.label || truncateHash(bm.address, 8, 6)}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{bm.address}</p>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <Wallet className="h-2.5 w-2.5" /> {meta.symbol} · {meta.name}
                    </span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    <Link
                      to={to}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      title={t('explorer.view')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      onClick={() => removeBookmark(bm.address, bm.chain)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title={t('explorer.removeBookmark')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}