import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Image as ImageIcon } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';
import { formatAge, formatPls } from '@/lib/explorerFormat';
import HashLink from './HashLink';
import TxActionLinks from './TxActionLinks';
import StatusBadge from './StatusBadge';
import { Image } from '@/components/ui/image';

// Find the first NFT transfer with an image in a transaction's token_transfers.
function getNftImage(tx) {
  if (!tx.token_transfers?.length) return null;
  for (const tr of tx.token_transfers) {
    if (tr.is_nft && tr.nft_image) {
      return { image: tr.nft_image, name: tr.nft_name || `NFT #${tr.token_id}`, contract: tr.token_contract };
    }
  }
  return null;
}

// Compact table of transactions — Etherscan-style. Responsive: on mobile,
// collapses to stacked cards. Shows status badge (success/failed/pending)
// and NFT image thumbnail for NFT transactions.
export default function TransactionsTable({ transactions = [], showDirection = false, symbol = 'PLS' }) {
  const t = useT();
  if (!transactions.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('explorer.noTxs')}</p>;
  }
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              {showDirection && <th className="px-4 py-2.5 font-semibold">{t('explorer.direction')}</th>}
              <th className="px-4 py-2.5 font-semibold">{t('explorer.status')}</th>
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
            {transactions.map((tx) => {
              const nft = getNftImage(tx);
              return (
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
                  <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                  <td className="px-4 py-3"><HashLink hash={tx.tx_hash} to={`/blockchain/tx/${tx.tx_hash}`} /></td>
                  <td className="px-4 py-3">
                    {tx.block_number != null
                      ? <Link to={`/blockchain/block/${tx.block_number}`} className="text-primary hover:underline">#{tx.block_number}</Link>
                      : <span className="text-xs italic text-muted-foreground">{t('explorer.pending')}</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatAge(tx.timestamp)}</td>
                  <td className="px-4 py-3"><HashLink hash={tx.from_address} to={`/blockchain/address/${tx.from_address}`} /></td>
                  <td className="px-4 py-3">
                    {tx.to_address
                      ? <HashLink hash={tx.to_address} to={`/blockchain/address/${tx.to_address}`} />
                      : <span className="text-xs italic text-muted-foreground">{t('explorer.contractCreation')}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {nft ? (
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-10 w-10 overflow-hidden rounded-lg border border-border bg-secondary">
                          <Image src={nft.image} alt={nft.name} fittingType="fill" className="h-full w-full" />
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-xs font-semibold">{nft.name}</p>
                          <p className="text-[10px] text-muted-foreground">NFT</p>
                        </div>
                      </div>
                    ) : (
                      <span className="font-mono tabular-nums whitespace-nowrap">{formatPls(tx.value_wei)} {symbol}</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><TxActionLinks txHash={tx.tx_hash} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {transactions.map((tx) => {
          const nft = getNftImage(tx);
          return (
            <div key={tx.id || tx.tx_hash} className="rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-center justify-between gap-2">
                <HashLink hash={tx.tx_hash} to={`/blockchain/tx/${tx.tx_hash}`} />
                <StatusBadge status={tx.status} />
              </div>
              {showDirection && (
                <div className="mt-1.5">
                  {tx.direction === 'in' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success"><ArrowDownLeft className="h-3 w-3" /> {t('explorer.in')}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning"><ArrowUpRight className="h-3 w-3" /> {t('explorer.out')}</span>
                  )}
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                {tx.block_number != null
                  ? <Link to={`/blockchain/block/${tx.block_number}`} className="text-primary hover:underline">#{tx.block_number}</Link>
                  : <span className="italic">{t('explorer.pending')}</span>}
                <span>{formatAge(tx.timestamp)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t('explorer.from')}: <HashLink hash={tx.from_address} to={`/blockchain/address/${tx.from_address}`} /></span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t('explorer.to')}: {tx.to_address ? <HashLink hash={tx.to_address} to={`/blockchain/address/${tx.to_address}`} /> : <span className="italic">{t('explorer.contractCreation')}</span>}</span>
              </div>
              {nft ? (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-secondary/30 p-2">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
                    {nft.image
                      ? <Image src={nft.image} alt={nft.name} fittingType="fill" className="h-full w-full" />
                      : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{nft.name}</p>
                    <p className="text-xs text-muted-foreground">NFT Transfer</p>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold">{formatPls(tx.value_wei)} {symbol}</span>
                  <TxActionLinks txHash={tx.tx_hash} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}