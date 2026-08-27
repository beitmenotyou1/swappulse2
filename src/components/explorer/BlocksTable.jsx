import React from 'react';
import { Link } from 'react-router-dom';
import { useT } from '@/lib/i18n/I18nProvider';
import { formatAge, formatNumber } from '@/lib/explorerFormat';
import HashLink from './HashLink';

// Compact table of latest blocks — Etherscan-style. Responsive: on mobile,
// collapses to stacked cards.
export default function BlocksTable({ blocks = [] }) {
  const t = useT();
  if (!blocks.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('explorer.noBlocks')}</p>;
  }
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">{t('explorer.block')}</th>
              <th className="px-4 py-2.5 font-semibold">{t('explorer.age')}</th>
              <th className="px-4 py-2.5 font-semibold">{t('explorer.miner')}</th>
              <th className="px-4 py-2.5 text-right font-semibold">{t('explorer.txs')}</th>
              <th className="px-4 py-2.5 text-right font-semibold">{t('explorer.gasUsed')}</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => (
              <tr key={b.id || b.block_number} className="border-b border-border last:border-0 transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <Link to={`/blockchain/block/${b.block_number}`} className="font-semibold text-primary hover:underline">
                    #{b.block_number}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatAge(b.timestamp)}</td>
                <td className="px-4 py-3"><HashLink hash={b.miner} to={`/blockchain/address/${b.miner}`} /></td>
                <td className="px-4 py-3 text-right tabular-nums">{b.tx_count ?? 0}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatNumber(b.gas_used)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {blocks.map((b) => (
          <Link
            key={b.id || b.block_number}
            to={`/blockchain/block/${b.block_number}`}
            className="block rounded-xl border border-border bg-card p-3.5 transition-colors hover:bg-secondary/30"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-primary">#{b.block_number}</span>
              <span className="text-xs text-muted-foreground">{formatAge(b.timestamp)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">{b.miner?.slice(0, 10)}…{b.miner?.slice(-6)}</span>
              <span>{b.tx_count ?? 0} {t('explorer.txs').toLowerCase()}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}