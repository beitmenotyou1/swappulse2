import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Wallet2, FileCode2, Hash } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useT } from '@/lib/i18n/I18nProvider';
import useSEO from '@/hooks/useSEO';
import TransactionsTable from '@/components/explorer/TransactionsTable';
import HashLink from '@/components/explorer/HashLink';
import AddressTokens from '@/components/explorer/AddressTokens';
import AddressNfts from '@/components/explorer/AddressNfts';
import BookmarkButton from '@/components/explorer/BookmarkButton';
import { getActiveChain } from '@/lib/explorerChain';
import { getChainMeta } from '@/lib/explorerChains';
import ChainLogo from '@/components/explorer/ChainLogo';
import { formatPls, formatNumber } from '@/lib/explorerFormat';

export default function PulseExplorerAddress() {
  const t = useT();
  const { address } = useParams();
  const [searchParams] = useSearchParams();
  const chainKey = getActiveChain(searchParams);
  const chainMeta = getChainMeta(chainKey);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useSEO({
    title: t('explorer.seo.addressTitle'),
    description: t('explorer.seo.addressDescription', { address }),
    canonicalPath: `/blockchain/address/${address}`,
  });

  useEffect(() => {
    setLoading(true);
    setError('');
    base44.functions.invoke('multi-chain-address', { chain: chainKey, address, page, limit: 25 })
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.error || e?.message || t('explorer.loadFailed')))
      .finally(() => setLoading(false));
  }, [address, page, chainKey, t]);

  const symbol = data?.chain?.symbol || chainMeta.symbol;

  return (
    <div className="space-y-4">
      {/* Breadcrumb + title */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/blockchain" className="hover:text-foreground">{t('explorer.title')}</Link>
        <span>/</span>
        <span className="text-foreground">{t('explorer.address')}</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {data && (
        <>
          {/* Address overview card */}
          <div className="rounded-xl border border-border bg-card shadow-base">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
                <ChainLogo chainKey={chainKey} size={20} /> {t('explorer.addressOverview')}
              </h2>
              <BookmarkButton address={data.address} chain={chainKey} />
            </div>
            <div className="divide-y divide-border">
              <div className="flex items-start justify-between gap-4 px-4 py-3">
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Hash className="h-4 w-4" /> {t('explorer.address')}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs break-all">{data.address}</span>
                  <HashLink hash={data.address} to={`/blockchain/address/${data.address}`} />
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Wallet2 className="h-4 w-4" /> {t('explorer.plsBalance')}</span>
                <span className="font-mono text-sm font-semibold">{formatPls(data.balance_wei)} {symbol}</span>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><FileCode2 className="h-4 w-4" /> {t('explorer.type')}</span>
                <span className={`text-sm font-semibold ${data.is_contract ? 'text-primary' : 'text-foreground'}`}>
                  {data.is_contract ? t('explorer.contract') : t('explorer.eoa')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm text-muted-foreground">{t('explorer.nonce')}</span>
                <span className="font-mono text-sm">{formatNumber(data.nonce)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm text-muted-foreground">{t('explorer.transactions')}</span>
                <span className="font-mono text-sm">{formatNumber(data.total)} ({formatNumber(data.pages)} {data.pages === 1 ? t('explorer.pageSingular') : t('explorer.pagePlural')})</span>
              </div>
            </div>
          </div>

          {/* Token balances */}
          <AddressTokens tokens={data.token_balances || []} />

          {/* NFT collection */}
          <AddressNfts nfts={data.nfts || []} />

          {/* Transaction history */}
          <div className="rounded-xl border border-border bg-card shadow-base">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">{t('explorer.transactionHistory')}</h2>
            </div>
            <TransactionsTable transactions={data.transactions || []} showDirection symbol={symbol} />
            {data.pages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-secondary disabled:opacity-40"
                >
                  ← {t('explorer.prev')}
                </button>
                <span className="text-muted-foreground">{t('explorer.pageOf', { page: data.page, pages: data.pages })}</span>
                <button
                  onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                  disabled={page >= data.pages}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-secondary disabled:opacity-40"
                >
                  {t('explorer.next')} →
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}