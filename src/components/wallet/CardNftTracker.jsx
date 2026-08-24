import React, { useState, useEffect } from 'react';
import { Loader2, ShieldCheck, ExternalLink, Users, ArrowRightLeft, Clock, CheckCircle2, AlertCircle, Package } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { useCryptoEnabled } from '@/hooks/useCryptoEnabled';

// Card NFT Tracker — shown on each card's individual page. Documents all
// mints of that specific card NFT, displays current ownership status,
// and tracks transfer history. Transfers are only marked complete once
// the physical card has been verified as received.
// Visible even when crypto features are disabled (with appropriate settings).
export default function CardNftTracker({ cardId, cardName, cardImage }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { cryptoEnabled } = useCryptoEnabled();

  useEffect(() => {
    if (!cardId) { setLoading(false); return; }
    (async () => {
      try {
        const res = await base44.functions.invoke('get-card-nft-history', { cardId });
        setData(res.data);
      } catch (e) {
        console.error('Card NFT history error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [cardId]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.totalMints === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold">On-Chain NFT Tracking</h3>
        </div>
        <div className="flex flex-col items-center py-4 text-center">
          <Package className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold text-muted-foreground">No NFTs minted for this card yet</p>
          {cryptoEnabled && (
            <p className="mt-1 text-xs text-muted-foreground">Add this card to your collection and mint it on Polygon to start tracking.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-bold">On-Chain NFT Tracking</h3>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-xl bg-secondary p-2.5 text-center">
          <p className="text-lg font-extrabold text-primary">{data.totalMints}</p>
          <p className="text-[10px] font-semibold text-muted-foreground">Total Mints</p>
        </div>
        <div className="rounded-xl bg-secondary p-2.5 text-center">
          <p className="text-lg font-extrabold text-primary">{data.totalTransfers}</p>
          <p className="text-[10px] font-semibold text-muted-foreground">Transfers</p>
        </div>
        <div className="rounded-xl bg-secondary p-2.5 text-center">
          <p className={`text-lg font-extrabold ${data.pendingTransfers > 0 ? 'text-amber-500' : 'text-success'}`}>
            {data.pendingTransfers}
          </p>
          <p className="text-[10px] font-semibold text-muted-foreground">Pending</p>
        </div>
      </div>

      {/* NFT list */}
      <div className="space-y-3">
        {data.assets.map((asset) => (
          <NftMintEntry key={asset.id} asset={asset} cardName={cardName} cardImage={cardImage} />
        ))}
      </div>

      {!cryptoEnabled && (
        <p className="mt-3 text-xs text-muted-foreground">
          You're viewing the NFT version of this card. Enable crypto features in Settings to mint and trade.
        </p>
      )}
    </div>
  );
}

function NftMintEntry({ asset, cardName, cardImage }) {
  const [expanded, setExpanded] = useState(false);
  const level = asset.verificationLevel || 0;
  const levelLabels = ['Self-attested', 'Scanned', 'AI-Verified', 'Graded'];
  const levelColors = ['text-muted-foreground', 'text-primary', 'text-primary', 'text-accent'];

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Mint entry header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-3 hover:bg-secondary/50"
      >
        <div className="h-14 w-10 shrink-0 overflow-hidden rounded border border-border bg-secondary">
          {cardImage ? (
            <Image src={cardImage} alt={cardName} fittingType="fill" className="h-full w-full" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-semibold">NFT #{asset.tokenId}</p>
          <p className="text-xs text-muted-foreground">
            Minted by @{asset.minterUsername}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold ${levelColors[level]}`}>
            {levelLabels[level]}
          </span>
          {asset.transferCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <ArrowRightLeft className="h-3 w-3" /> {asset.transferCount}
            </span>
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border p-3 space-y-3 bg-muted/30">
          {/* Current owner */}
          <div className="flex items-center gap-2 text-xs">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Current Owner</p>
              <p className="font-mono text-muted-foreground truncate">{asset.ownerWallet?.slice(0, 10)}…{asset.ownerWallet?.slice(-6)}</p>
            </div>
          </div>

          {/* Mint info */}
          <div className="flex items-center gap-2 text-xs">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="font-semibold">Minted</p>
              <p className="text-muted-foreground">{new Date(asset.mintedAt).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Mint tx */}
          {asset.mintTxHash && (
            <a
              href={`https://polygonscan.com/tx/${asset.mintTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View mint transaction
            </a>
          )}

          {/* Transfer history */}
          {asset.transfers.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold">Transfer History</p>
              <div className="space-y-1.5">
                {asset.transfers.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-secondary p-2 text-xs">
                    <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${t.verified ? 'bg-success/15 text-success' : 'bg-amber-500/15 text-amber-500'}`}>
                      {t.verified ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono truncate">{t.toWallet?.slice(0, 10)}…{t.toWallet?.slice(-4)}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(t.at).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-[10px] font-bold ${t.verified ? 'text-success' : 'text-amber-500'}`}>
                      {t.verified ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
              {asset.transfers.some(t => !t.verified) && (
                <p className="mt-2 flex items-start gap-1.5 text-[10px] text-amber-600">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Pending transfers complete only when the physical card receipt is confirmed via escrow.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}