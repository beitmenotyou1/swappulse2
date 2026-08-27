import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatAge, formatPls } from '@/lib/explorerFormat';
import HashLink from './HashLink';
import TxActionLinks from './TxActionLinks';

// Compact table of transactions — Etherscan-style. Each row includes the
// two action chips (wallet + explorer deep-links). When showDirection is on
// (address page), an IN/OUT badge column is shown.
export default function TransactionsTable({ transactions = [], showDirection = false }) {
  if (!transactions.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No transactions found.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            {showDirection && <th className="px-3 py-2 font-medium">Dir</th>}
            <th className="px-3 py-2 font-medium">Txn Hash</th>
            <th className="px-3 py-2 font-medium">Block</th>
            <th className="px-3 py-2 font-medium">Age</th>
            <th className="px-3 py-2 font-medium">From</th>
            <th className="px-3 py-2 font-medium">To</th>
            <th className="px-3 py-2 font-medium text-right">Value</th>
            <th className="px-3 py-2 font-medium text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id || tx.tx_hash} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
              {showDirection && (
                <td className="px-3 py-2.5">
                  {tx.direction === 'in' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><ArrowDownLeft className="w-3.5 h-3.5" /> IN</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-warning"><ArrowUpRight className="w-3.5 h-3.5" /> OUT</span>
                  )}
                </td>
              )}
              <td className="px-3 py-2.5"><HashLink hash={tx.tx_hash} to={`/pulse-explorer/tx/${tx.tx_hash}`} /></td>
              <td className="px-3 py-2.5">
                <Link to={`/pulse-explorer/block/${tx.block_number}`} className="text-primary hover:underline">#{tx.block_number}</Link>
              </td>
              <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{formatAge(tx.timestamp)}</td>
              <td className="px-3 py-2.5"><HashLink hash={tx.from_address} to={`/pulse-explorer/address/${tx.from_address}`} /></td>
              <td className="px-3 py-2.5">
                {tx.to_address
                  ? <HashLink hash={tx.to_address} to={`/pulse-explorer/address/${tx.to_address}`} />
                  : <span className="text-xs italic text-muted-foreground">Contract Creation</span>}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{formatPls(tx.value_wei)} PLS</td>
              <td className="px-3 py-2.5"><TxActionLinks txHash={tx.tx_hash} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}