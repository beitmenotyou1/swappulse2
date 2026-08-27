import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';
import { formatAge, formatPls } from '@/lib/explorerFormat';
import HashLink from './HashLink';
import TxActionLinks from './TxActionLinks';

// Compact table of transactions — Etherscan-style. Responsive: on mobile,
// collapses to stacked cards. When showDirection is on (address page), an
// IN/OUT badge column is shown.
export default function TransactionsTable({ transactions = [], showDirection = false }) {
  const t = useT();
  if (!transactions.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('explorer.noTxs')}</p>;
  }
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              {showDirection && <th className="px-4 py-2.5 font-semibold">{t('explorer.direction')}</th>}
              <th className="px-4 py-2.5 font-semibold">{t('explorer.txnHash')}</th>
              <th className="px-4 py-2.5 font-semibold">{t('explorer.block')}</th>
              <th className="px-4 py-2.5 font-semibold">{t('explorer.age')}</th>
              <th className="px-4 py-2.5 font-semibold">{t('explorer.from')}</th>
              <th className="px-4 py-2.5 font-semibold">{t('explorer.to')}</th>
              <th className="px-4 py-2.5 text-right font-semibold">{t('explorer.value')}</th>
              <th className="px-4 py-2.5 text-center font-semibold">{t('explorer.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id || tx.tx_hash} className="border-b border-border last:border-0 transition-colors hover:bg-secondary/30">
                {showDirection && (
                  <td className="px-4 py-3">
                    {tx.direction === 'in' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success"><ArrowDownLeft className="h-3 w-3" /> {t('explorer.in')}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning"><ArrowUpRight className="h-3 w-3" /> {t('explorer.out')}</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3"><HashLink hash={tx.tx_hash} to={`/blockchain/tx/${tx.tx_hash}`} /></td>
                <td className="px-4 py-3">
                  <Link to={`/blockchain/block/${tx.block_number}`} className="text-primary hover:underline">#{tx.block_number}</Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatAge(tx.timestamp)}</td>
                <td className="px-4 py-3"><HashLink hash={tx.from_address} to={`/blockchain/address/${tx.from_address}`} /></td>
                <td className="px-4 py-3">
                  {tx.to_address
                    ? <HashLink hash={tx.to_address} to={`/blockchain/address/${tx.to_address}`} />
                    : <span className="text-xs italic text-muted-foreground">{t('explorer.contractCreation')}</span>}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">{formatPls(tx.value_wei)} PLS</td>
                <td className="px-4 py-3"><TxActionLinks txHash={tx.tx_hash} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {transactions.map((tx) => (
          <div key={tx.id || tx.tx_hash} className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center justify-between gap-2">
              <HashLink hash={tx.tx_hash} to={`/blockchain/tx/${tx.tx_hash}`} />
              {showDirection && (
                tx.direction === 'in' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success"><ArrowDownLeft className="h-3 w-3" /> {t('explorer.in')}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning"><ArrowUpRight className="h-3 w-3" /> {t('explorer.out')}</span>
                )
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <Link to={`/blockchain/block/${tx.block_number}`} className="text-primary hover:underline">#{tx.block_number}</Link>
              <span>{formatAge(tx.timestamp)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('explorer.from')}: <HashLink hash={tx.from_address} to={`/blockchain/address/${tx.from_address}`} /></span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('explorer.to')}: {tx.to_address ? <HashLink hash={tx.to_address} to={`/blockchain/address/${tx.to_address}`} /> : <span className="italic">{t('explorer.contractCreation')}</span>}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-sm font-semibold">{formatPls(tx.value_wei)} PLS</span>
              <TxActionLinks txHash={tx.tx_hash} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}