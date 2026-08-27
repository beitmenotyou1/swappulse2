import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle2, XCircle, HelpCircle, ArrowRight, Coins,
  Fuel, Hash, Blocks, Clock, ArrowDownLeft, ArrowUpRight, FileCode2,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useT } from '@/lib/i18n/I18nProvider';
import useSEO from '@/hooks/useSEO';
import HashLink from '@/components/explorer/HashLink';
import TxActionLinks from '@/components/explorer/TxActionLinks';
import ExplainBox from '@/components/explorer/ExplainBox';
import { explainTransaction } from '@/lib/explorerExplain';
import {
  formatPls, formatGwei, formatNumber, formatTimestamp, formatAge, formatTokenAmount,
} from '@/lib/explorerFormat';

function StatusBadge({ status, t }) {
  if (status === 'success') return <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success"><CheckCircle2 className="h-3.5 w-3.5" /> {t('explorer.success')}</span>;
  if (status === 'failed') return <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive"><XCircle className="h-3.5 w-3.5" /> {t('explorer.failed')}</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground"><HelpCircle className="h-3.5 w-3.5" /> {t('explorer.unknown')}</span>;
}

function Row({ icon: Icon, label, children, t }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="inline-flex items-center gap-2 shrink-0 text-sm text-muted-foreground">
        {Icon && <Icon className="h-4 w-4" />} {label}
      </span>
      <span className="text-right text-sm">{children}</span>
    </div>
  );
}

export default function PulseExplorerTx() {
  const t = useT();
  const { txHash } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useSEO({
    title: t('explorer.seo.txTitle'),
    description: t('explorer.seo.txDescription', { hash: txHash }),
    canonicalPath: `/blockchain/tx/${txHash}`,
  });

  useEffect(() => {
    setLoading(true);
    setError('');
    base44.functions.invoke('pulse-explorer-tx', { hash: txHash })
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.error || e?.message || t('explorer.loadFailed')))
      .finally(() => setLoading(false));
  }, [txHash, t]);

  const explanation = data ? explainTransaction(data, t) : '';

  return (
    <div className="space-y-4">
      {/* Breadcrumb + title */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/blockchain" className="hover:text-foreground">{t('explorer.title')}</Link>
        <span>/</span>
        <span className="text-foreground">{t('explorer.transaction')}</span>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="font-mono text-sm break-all text-muted-foreground">{data.tx_hash}</h1>
            <TxActionLinks txHash={data.tx_hash} walletUrl={data.wallet_url || '/wallet'} />
          </div>

          {/* Plain-language explanation */}
          {explanation && <ExplainBox>{explanation}</ExplainBox>}

          {/* Transaction detail card */}
          <div className="rounded-xl border border-border bg-card shadow-base">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">{t('explorer.transactionDetails')}</h2>
              <StatusBadge status={data.status} t={t} />
            </div>
            <div className="divide-y divide-border">
              <Row icon={Hash} label={t('explorer.txnHash')} t={t}>
                <span className="flex items-center gap-2"><span className="font-mono text-xs break-all">{data.tx_hash}</span><HashLink hash={data.tx_hash} to={`/blockchain/tx/${data.tx_hash}`} /></span>
              </Row>
              <Row icon={Blocks} label={t('explorer.block')} t={t}>
                {data.block_number != null
                  ? <Link to={`/blockchain/block/${data.block_number}`} className="text-primary hover:underline">#{data.block_number}</Link>
                  : <span className="text-muted-foreground">{t('explorer.pending')}</span>}
              </Row>
              <Row icon={Clock} label={t('explorer.timestamp')} t={t}>
                <span>{formatTimestamp(data.timestamp)} <span className="text-muted-foreground">({formatAge(data.timestamp)})</span></span>
              </Row>
              <Row icon={ArrowRight} label={t('explorer.from')} t={t}>
                <HashLink hash={data.from_address} to={`/blockchain/address/${data.from_address}`} />
              </Row>
              <Row icon={ArrowRight} label={t('explorer.to')} t={t}>
                {data.to_address
                  ? <HashLink hash={data.to_address} to={`/blockchain/address/${data.to_address}`} />
                  : <span className="inline-flex items-center gap-1 text-xs italic text-primary"><FileCode2 className="h-3.5 w-3.5" /> {t('explorer.contractCreation')}</span>}
              </Row>
              {data.created_contract && (
                <Row icon={FileCode2} label={t('explorer.createdContract')} t={t}>
                  <HashLink hash={data.created_contract} to={`/blockchain/address/${data.created_contract}`} />
                </Row>
              )}
              <Row icon={Coins} label={t('explorer.value')} t={t}>
                <span className="font-mono">{formatPls(data.value_wei)} PLS</span>
              </Row>
              <Row icon={Fuel} label={t('explorer.gasUsed')} t={t}>
                <span className="font-mono">{formatNumber(data.gas_used)} <span className="text-muted-foreground">({formatGwei(data.gas_price)} Gwei)</span></span>
              </Row>
              <Row label={t('explorer.gasLimit')} t={t}>
                <span className="font-mono">{formatNumber(data.gas_limit)}</span>
              </Row>
              <Row label={t('explorer.nonce')} t={t}>
                <span className="font-mono">{formatNumber(data.nonce)}</span>
              </Row>
              <div className="px-4 py-3">
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-2"><FileCode2 className="h-4 w-4" /> {t('explorer.inputData')}</span>
                <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-secondary/30 p-3 font-mono text-xs break-all whitespace-pre-wrap">
                  {data.input_data || '0x'}
                </pre>
              </div>
            </div>
          </div>

          {/* Token transfers */}
          {data.token_transfers?.length > 0 && (
            <div className="rounded-xl border border-border bg-card shadow-base">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">{t('explorer.tokenTransfersCount', { count: data.token_transfers.length })}</h2>
              </div>
              <div className="divide-y divide-border">
                {data.token_transfers.map((tr, i) => (
                  <div key={i} className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowDownLeft className="h-3.5 w-3.5 text-success" />
                      <span className="text-muted-foreground">{t('explorer.from')}</span>
                      <HashLink hash={tr.from_address} to={`/blockchain/address/${tr.from_address}`} />
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowUpRight className="h-3.5 w-3.5 text-warning" />
                      <span className="text-muted-foreground">{t('explorer.to')}</span>
                      <HashLink hash={tr.to_address} to={`/blockchain/address/${tr.to_address}`} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{t('explorer.for')}</span>
                      <span className="font-mono font-medium">{formatTokenAmount(tr.value, tr.token_decimals)} {tr.token_symbol}</span>
                      <span className="text-muted-foreground">·</span>
                      <HashLink hash={tr.token_contract} to={`/blockchain/address/${tr.token_contract}`} prefixLen={8} suffixLen={6} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}