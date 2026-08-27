import React from 'react';
import { Link } from 'react-router-dom';
import { formatAge, formatNumber } from '@/lib/explorerFormat';
import HashLink from './HashLink';

// Compact table of latest blocks — Etherscan-style.
export default function BlocksTable({ blocks = [] }) {
  if (!blocks.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No blocks indexed yet. Run the indexer to populate.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-medium">Block</th>
            <th className="px-3 py-2 font-medium">Age</th>
            <th className="px-3 py-2 font-medium">Miner</th>
            <th className="px-3 py-2 font-medium text-right">Txs</th>
            <th className="px-3 py-2 font-medium text-right">Gas Used</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((b) => (
            <tr key={b.id || b.block_number} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
              <td className="px-3 py-2.5">
                <Link to={`/pulse-explorer/block/${b.block_number}`} className="font-medium text-primary hover:underline">
                  #{b.block_number}
                </Link>
              </td>
              <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{formatAge(b.timestamp)}</td>
              <td className="px-3 py-2.5"><HashLink hash={b.miner} to={`/pulse-explorer/address/${b.miner}`} /></td>
              <td className="px-3 py-2.5 text-right tabular-nums">{b.tx_count ?? 0}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatNumber(b.gas_used)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}