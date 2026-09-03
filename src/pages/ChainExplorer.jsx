import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Blocks, Check, Copy, Github, RefreshCw, Search, Wallet as WalletIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/lib/i18n/I18nProvider';
import Logo from '@/components/Logo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';
import useSEO from '@/hooks/useSEO';

function shortHex(value, head = 10, tail = 8) {
  const raw = String(value || '');
  if (!raw || raw.length <= head + tail + 3) return raw;
  return `${raw.slice(0, head)}…${raw.slice(-tail)}`;
}

function normaliseStatusKey(value) {
  const status = String(value || '').toUpperCase();
  const keys = {
    SUCCEEDED: 'explorer.status.succeeded',
    REVERTED: 'explorer.status.reverted',
    ACCEPTED_ON_L2: 'explorer.status.acceptedL2',
    ACCEPTED_ON_L1: 'explorer.status.acceptedL1',
    PENDING: 'explorer.status.pending',
    RECEIVED: 'explorer.status.received',
    REJECTED: 'explorer.status.rejected',
  };
  return keys[status] || '';
}

function transactionTypeKey(value) {
  const type = String(value || '').toUpperCase();
  const keys = {
    INVOKE: 'explorer.type.invoke',
    DECLARE: 'explorer.type.declare',
    DEPLOY_ACCOUNT: 'explorer.type.deployAccount',
    L1_HANDLER: 'explorer.type.l1Handler',
  };
  return keys[type] || 'explorer.type.unknown';
}

function extractExplorerTarget(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const parts = url.pathname.split('/').filter(Boolean);
    const chainIndex = parts.indexOf('chain');
    if (chainIndex >= 0) {
      const rest = parts.slice(chainIndex + 1);
      if (rest[0] === 'tx' && rest[1]) return `/chain/tx/${rest[1]}`;
      if (rest[0] === 'block' && rest[1]) return `/chain/block/${rest[1]}`;
      if (rest[0] === 'address' && rest[1]) return `/chain/address/${rest[1]}`;
      if (rest[0]) return `/chain/${rest[0]}`;
      return '/chain/';
    }
  } catch {}
  if (/^\d+$/.test(raw) || /^0x[0-9a-fA-F]+$/.test(raw)) return `/chain/${raw}`;
  return null;
}

function CopyValue({ value, label, t }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span>{t('explorer.unknown')}</span>;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <code className="min-w-0 break-all font-mono text-xs" dir="ltr">{String(value)}</code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? t('explorer.copied') : t('explorer.copy', { label })}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      </button>
    </span>
  );
}

function DataRow({ label, children }) {
  return (
    <div className="grid gap-1 border-b border-border/70 py-3 last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function TechnicalDetails({ data, t }) {
  return (
    <details className="rounded-xl border border-border bg-secondary/20 p-4">
      <summary className="cursor-pointer font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {t('explorer.technicalDetails')}
      </summary>
      <p className="mt-2 text-sm text-muted-foreground">{t('explorer.technicalDetailsHelp')}</p>
      <pre
        tabIndex={0}
        className="mt-3 max-h-[32rem] overflow-auto rounded-lg bg-background p-3 text-xs leading-relaxed"
        dir="ltr"
      >{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}

function StatusText({ value, t }) {
  const key = normaliseStatusKey(value);
  return <span>{key ? t(key) : (value || t('explorer.unknown'))}</span>;
}

function ExplorerSearch({ initialValue = '', onInvalid }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialValue);

  useEffect(() => setQuery(initialValue), [initialValue]);

  const submit = (event) => {
    event.preventDefault();
    const target = extractExplorerTarget(query);
    if (!target) {
      onInvalid?.();
      return;
    }
    navigate(target);
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-4 shadow-base" role="search">
      <label htmlFor="chain-explorer-search" className="block text-sm font-bold">
        {t('explorer.searchLabel')}
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="chain-explorer-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('explorer.searchPlaceholder')}
          aria-describedby="chain-explorer-search-help"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          {t('explorer.searchButton')}
        </button>
      </div>
      <p id="chain-explorer-search-help" className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {t('explorer.searchHelp')}
      </p>
    </form>
  );
}

export default function ChainExplorer() {
  const { t, locale } = useI18n();
  const location = useLocation();
  const params = useParams();
  const resultHeadingRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState('');

  useSEO({
    title: t('explorer.seoTitle'),
    description: t('explorer.seoDescription'),
    canonicalPath: location.pathname,
  });

  const request = useMemo(() => {
    if (params.txHash) return { action: 'transaction', hash: params.txHash };
    if (params.blockId) return { action: 'block', id: params.blockId };
    if (params.address) return { action: 'address', address: params.address };
    if (params.identifier) return { action: 'resolve', identifier: params.identifier };
    return { action: 'summary' };
  }, [params.txHash, params.blockId, params.address, params.identifier]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorCode('');
    try {
      const response = await base44.functions.invoke('chain-explorer', request);
      const payload = response?.data || response;
      if (!payload?.ok) throw Object.assign(new Error('EXPLORER_ERROR'), { code: payload?.error_code });
      setData(payload);
      window.requestAnimationFrame(() => resultHeadingRef.current?.focus());
    } catch (error) {
      setData(null);
      setErrorCode(error?.response?.data?.error_code || error?.code || 'EXPLORER_UNAVAILABLE');
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { load(); }, [load]);

  const errorMessage = useMemo(() => {
    const keys = {
      INVALID_IDENTIFIER: 'explorer.error.invalid',
      LOOKUP_NOT_FOUND: 'explorer.error.notFound',
      TRANSACTION_NOT_FOUND: 'explorer.error.transactionNotFound',
      BLOCK_NOT_FOUND: 'explorer.error.blockNotFound',
      ADDRESS_NOT_FOUND: 'explorer.error.addressNotFound',
      NETWORK_CONFIGURATION_UNSAFE: 'explorer.error.unavailable',
      EXPLORER_UNAVAILABLE: 'explorer.error.unavailable',
    };
    return t(keys[errorCode] || 'explorer.error.unavailable');
  }, [errorCode, t]);

  const formatTime = (seconds) => {
    if (seconds == null || !Number.isFinite(Number(seconds))) return t('explorer.unknown');
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(Number(seconds) * 1000));
  };

  const transaction = data?.transaction || null;
  const receipt = data?.receipt || null;
  const block = data?.block || null;
  const address = data?.address || null;

  const sender = transaction?.sender_address || transaction?.contract_address || '';
  const actualFee = receipt?.actual_fee?.amount
    ? `${receipt.actual_fee.amount}${receipt.actual_fee.unit ? ` ${receipt.actual_fee.unit}` : ''}`
    : '';

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
      <header className="mb-5">
        <div className="flex items-start gap-3">
          <div className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
            <Blocks className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{t('explorer.title')}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">{t('explorer.subtitle')}</p>
          </div>
        </div>
        <p className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm leading-relaxed">
          {t('explorer.readOnlyNotice')}
        </p>
      </header>

      <ExplorerSearch
        initialValue={params.identifier || params.txHash || params.blockId || params.address || ''}
        onInvalid={() => setErrorCode('INVALID_IDENTIFIER')}
      />

      <div className="mt-5" aria-live="polite" aria-busy={loading}>
        {loading && (
          <div className="flex min-h-40 items-center justify-center gap-3 rounded-2xl border border-border bg-card p-8 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span>{t('explorer.loading')}</span>
          </div>
        )}

        {!loading && errorCode && (
          <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5">
            <h2 ref={resultHeadingRef} tabIndex={-1} className="font-bold focus:outline-none">{t('explorer.error.title')}</h2>
            <p className="mt-2 text-sm leading-relaxed">{errorMessage}</p>
            {location.pathname !== '/chain/' && location.pathname !== '/chain' && (
              <Link to="/chain/" className="mt-4 inline-flex items-center gap-2 font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('explorer.backHome')}
              </Link>
            )}
          </div>
        )}

        {!loading && data?.kind === 'summary' && (
          <section aria-labelledby="chain-summary-title" className="space-y-5">
            <h2 id="chain-summary-title" ref={resultHeadingRef} tabIndex={-1} className="sr-only focus:not-sr-only">{t('explorer.latestBlocks')}</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('explorer.latestBlock')}</p>
                <p className="mt-2 text-2xl font-black tabular-nums">{data.latest_block_number ?? t('explorer.unknown')}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('explorer.chainId')}</p>
                <p className="mt-2 break-all font-mono text-xs" dir="ltr">{data.chain_id || t('explorer.unknown')}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('explorer.rpcVersion')}</p>
                <p className="mt-2 text-2xl font-black">{data.rpc_spec_version || t('explorer.unknown')}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black">{t('explorer.latestBlocks')}</h2>
                <button
                  type="button"
                  onClick={load}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> {t('explorer.refresh')}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <caption className="sr-only">{t('explorer.latestBlocks')}</caption>
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th scope="col" className="px-2 py-2 font-semibold">{t('explorer.blockNumber')}</th>
                      <th scope="col" className="px-2 py-2 font-semibold">{t('explorer.timestamp')}</th>
                      <th scope="col" className="px-2 py-2 font-semibold">{t('explorer.transactionCount')}</th>
                      <th scope="col" className="px-2 py-2 font-semibold">{t('explorer.blockHash')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.latest_blocks || []).map((item) => (
                      <tr key={item.block_hash || item.block_number} className="border-b border-border/60 last:border-0">
                        <td className="px-2 py-3">
                          <Link to={`/chain/block/${item.block_number}`} className="font-bold text-primary hover:underline">
                            {item.block_number}
                          </Link>
                        </td>
                        <td className="px-2 py-3 whitespace-nowrap">{formatTime(item.timestamp)}</td>
                        <td className="px-2 py-3 tabular-nums">{item.transaction_count}</td>
                        <td className="px-2 py-3 font-mono text-xs" dir="ltr">{shortHex(item.block_hash)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {!loading && data?.kind === 'block' && block && (
          <article className="space-y-5" aria-labelledby="block-result-title">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-primary">{t('explorer.block')}</p>
                  <h2 id="block-result-title" ref={resultHeadingRef} tabIndex={-1} className="mt-1 text-2xl font-black focus:outline-none">
                    {block.block_number ?? t('explorer.unknown')}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">{t('explorer.blockSummary')}</p>
                </div>
                <Link to="/chain/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('explorer.backHome')}
                </Link>
              </div>
              <dl className="mt-4">
                <DataRow label={t('explorer.blockNumber')}>{block.block_number ?? t('explorer.unknown')}</DataRow>
                <DataRow label={t('explorer.blockHash')}><CopyValue value={block.block_hash} label={t('explorer.blockHash')} t={t} /></DataRow>
                <DataRow label={t('explorer.parentHash')}><CopyValue value={block.parent_hash} label={t('explorer.parentHash')} t={t} /></DataRow>
                <DataRow label={t('explorer.timestamp')}>{formatTime(block.timestamp)}</DataRow>
                <DataRow label={t('explorer.status')}><StatusText value={block.status} t={t} /></DataRow>
                <DataRow label={t('explorer.sequencer')}><CopyValue value={block.sequencer_address} label={t('explorer.sequencer')} t={t} /></DataRow>
                <DataRow label={t('explorer.transactionCount')}>{Array.isArray(block.transactions) ? block.transactions.length : 0}</DataRow>
              </dl>
            </div>

            <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="block-transactions-title">
              <h3 id="block-transactions-title" className="text-lg font-black">{t('explorer.transactions')}</h3>
              {Array.isArray(block.transactions) && block.transactions.length > 0 ? (
                <ol className="mt-3 divide-y divide-border">
                  {block.transactions.map((hash, index) => (
                    <li key={`${hash}-${index}`} className="py-3">
                      <Link to={`/chain/tx/${hash}`} className="flex min-w-0 items-center justify-between gap-3 rounded-lg p-2 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        <span className="min-w-0 break-all font-mono text-xs" dir="ltr">{hash}</span>
                        <span className="shrink-0 text-xs font-semibold text-primary">{t('explorer.viewTransaction')}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : <p className="mt-3 text-sm text-muted-foreground">{t('explorer.noTransactions')}</p>}
            </section>
            <TechnicalDetails data={block} t={t} />
          </article>
        )}

        {!loading && data?.kind === 'transaction' && transaction && (
          <article className="space-y-5" aria-labelledby="transaction-result-title">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary">{t('explorer.transaction')}</p>
                  <h2 id="transaction-result-title" ref={resultHeadingRef} tabIndex={-1} className="mt-1 break-all font-mono text-base font-black focus:outline-none sm:text-lg" dir="ltr">
                    {transaction.transaction_hash || t('explorer.unknown')}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">{t('explorer.transactionSummary')}</p>
                </div>
                <Link to="/chain/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('explorer.backHome')}
                </Link>
              </div>
              <dl className="mt-4">
                <DataRow label={t('explorer.transactionHash')}><CopyValue value={transaction.transaction_hash} label={t('explorer.transactionHash')} t={t} /></DataRow>
                <DataRow label={t('explorer.transactionType')}>{t(transactionTypeKey(transaction.type))}</DataRow>
                <DataRow label={t('explorer.sender')}><CopyValue value={sender} label={t('explorer.sender')} t={t} /></DataRow>
                <DataRow label={t('explorer.nonce')}><span className="font-mono text-xs" dir="ltr">{transaction.nonce ?? t('explorer.unknown')}</span></DataRow>
                <DataRow label={t('explorer.execution')}><StatusText value={receipt?.execution_status} t={t} /></DataRow>
                <DataRow label={t('explorer.finality')}><StatusText value={receipt?.finality_status} t={t} /></DataRow>
                <DataRow label={t('explorer.fee')}><span className="font-mono text-xs" dir="ltr">{actualFee || t('explorer.unknown')}</span></DataRow>
                {receipt?.revert_reason && <DataRow label={t('explorer.revertReason')}>{receipt.revert_reason}</DataRow>}
                {receipt?.block_number != null && (
                  <DataRow label={t('explorer.blockNumber')}>
                    <Link to={`/chain/block/${receipt.block_number}`} className="font-bold text-primary hover:underline">
                      {t('explorer.viewBlock', { number: receipt.block_number })}
                    </Link>
                  </DataRow>
                )}
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">{t('explorer.directLinkHint')}</p>
            </div>
            <TechnicalDetails data={{ transaction, receipt }} t={t} />
          </article>
        )}

        {!loading && data?.kind === 'address' && address && (
          <article className="space-y-5" aria-labelledby="address-result-title">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary">{t('explorer.address')}</p>
                  <h2 id="address-result-title" ref={resultHeadingRef} tabIndex={-1} className="mt-1 break-all font-mono text-base font-black focus:outline-none sm:text-lg" dir="ltr">
                    {address.address}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">{t('explorer.addressSummary')}</p>
                </div>
                <Link to="/chain/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('explorer.backHome')}
                </Link>
              </div>
              <dl className="mt-4">
                <DataRow label={t('explorer.address')}><CopyValue value={address.address} label={t('explorer.address')} t={t} /></DataRow>
                <DataRow label={t('explorer.contractClass')}><CopyValue value={address.class_hash} label={t('explorer.contractClass')} t={t} /></DataRow>
                <DataRow label={t('explorer.accountNonce')}><span className="font-mono text-xs" dir="ltr">{address.nonce ?? t('explorer.unknown')}</span></DataRow>
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">{t('explorer.directLinkHint')}</p>
            </div>
            <TechnicalDetails data={address} t={t} />
          </article>
        )}
      </div>
    </div>
  );
}
