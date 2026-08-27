import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Blocks, Clock, Fuel, Hash, ArrowRight, FileCode2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useT } from '@/lib/i18n/I18nProvider';
import useSEO from '@/hooks/useSEO';
import TransactionsTable from '@/components/explorer/TransactionsTable';
import HashLink from '@/components/explorer/HashLink';
import ExplainBox from '@/components/explorer/ExplainBox';
import { explainBlock } from '@/lib/explorerExplain';
import { getActiveChain } from '@/lib/explorerChain';
import { getChainMeta } from '@/lib/explorerChains';
import { formatNumber, formatTimestamp, formatAge } from '@/lib/explorerFormat';

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="inline-flex items-center gap-2 shrink-0 text-sm text-muted-foreground">
        {Icon && <Icon className="h-4 w-4" />} {label}
      </span>
      <span className="text-right text-sm">{children}</span>
    </div>
  );
}

export default function PulseExplorerBlock() {
  const t = useT();
  const { blockNumber } = useParams();
  const [searchParams] = useSearchParams();
  const chainKey = getActiveChain(searchParams);
  const chainMeta = getChainMeta(chainKey);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useSEO({
    title: t('explorer.seo.blockTitle'),
    description: t('explorer.seo.blockDescription', { number: blockNumber }),
    canonicalPath: `/blockchain/block/${blockNumber}`,
  });

  useEffect(() => {
    setLoading(true);
    setError('');
    base44.functions.invoke('multi-chain-block', { chain: chainKey, block_number: parseInt(blockNumber, 10) })
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.error || e?.message || t('explorer.loadFailed')))
      .finally(() => setLoading(false));
  }, [blockNumber, chainKey, t]);

  const symbol = data?.chain?.symbol || chainMeta.symbol;

  const block = data?.block;
  const explanation = block ? explainBlock(block, t) : '';

  return (
    <div className="space-y-4">
      {/* Breadcrumb + title */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/blockchain" className="hover:text-foreground">{t('explorer.title')}</Link>
        <span>/</span>
        <span className="text-foreground">{t('explorer.block')} #{blockNumber}</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {data && block && (
        <>
          {/* Plain-language explanation */}
          {explanation && <ExplainBox title={t('explorer.whatHappenedInBlock')}>{explanation}</ExplainBox>}

          <div className="rounded-xl border border-border bg-card shadow-base">
            <div className="border-b border-border px-4 py-3">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold"><Blocks className="h-4 w-4 text-primary" /> {t('explorer.block')} #{block.block_number}</h2>
            </div>
            <div className="divide-y divide-border">
              <Row label={t('explorer.blockHeight')}><span className="font-mono font-medium">#{formatNumber(block.block_number)}</span></Row>
              <Row icon={Hash} label={t('explorer.blockHash')}>
                <span className="flex items-center gap-2"><span className="font-mono text-xs break-all">{block.hash}</span><HashLink hash={block.hash} to={`/blockchain/block/${block.block_number}`} /></span>
              </Row>
              <Row icon={Hash} label={t('explorer.parentHash')}>
                <HashLink hash={block.parent_hash} to={`/blockchain/block/${Math.max(0, block.block_number - 1)}`} />
              </Row>
              <Row icon={Clock} label={t('explorer.timestamp')}>
                <span>{formatTimestamp(block.timestamp)} <span className="text-muted-foreground">({formatAge(block.timestamp)})</span></span>
              </Row>
              <Row icon={ArrowRight} label={t('explorer.miner')}>
                <HashLink hash={block.miner} to={`/blockchain/address/${block.miner}`} />
              </Row>
              <Row icon={Fuel} label={t('explorer.gasUsed')}><span className="font-mono">{formatNumber(block.gas_used)}</span></Row>
              <Row label={t('explorer.size')}><span className="font-mono">{formatNumber(block.size)} {t('explorer.bytes')}</span></Row>
              <Row label={t('explorer.transactions')}><span className="font-mono">{formatNumber(block.tx_count)}</span></Row>
              {block.extra_data && (
                <div className="px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-2"><FileCode2 className="h-4 w-4" /> {t('explorer.extraData')}</span>
                  <pre className="max-h-24 overflow-auto rounded-lg border border-border bg-secondary/30 p-3 font-mono text-xs break-all whitespace-pre-wrap">
                    {block.extra_data}
                  </pre>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-base">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">{t('explorer.transactionsInBlock', { number: block.block_number })}</h2>
            </div>
            <TransactionsTable transactions={data.transactions || []} symbol={symbol} />
          </div>
        </>
      )}
    </div>
  );
}