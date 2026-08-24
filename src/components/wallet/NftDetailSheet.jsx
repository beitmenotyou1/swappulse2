import React from 'react';
import { X, ShieldCheck, ExternalLink, ArrowDownLeft, Copy, Clock, CheckCircle2 } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';

const LEVEL_LABELS = {
  0: 'Level 0 — Self-attested',
  1: 'Level 1 — Scanned',
  2: 'Level 2 — AI-Verified',
  3: 'Level 3 — Graded Cert',
};

export default function NftDetailSheet({ nft, priceFormatted, onClose }) {
  const { toast } = useToast();
  if (!nft) return null;
  const { asset, isReceived, receivedFrom } = nft;
  const isUsername = asset.asset_type === 'username';

  const copyAddress = (addr) => {
    navigator.clipboard.writeText(addr);
    toast({ title: 'Copied!' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-card sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <h2 className="text-lg font-bold">NFT Details</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-4">
          <div className="mx-auto max-w-xs overflow-hidden rounded-2xl border border-border bg-secondary">
            {asset.linked_card_image ? (
              <Image src={asset.linked_card_image} alt={asset.linked_card_name || 'NFT'} fittingType="fill" className="aspect-[3/4] w-full" />
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center text-muted-foreground">
                {isUsername ? <span className="text-2xl font-bold">@{asset.handle}</span> : <span>No image</span>}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xl font-extrabold">{asset.linked_card_name || asset.handle || 'NFT'}</h3>
            {!isUsername && asset.minter_username && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Minted by <span className="font-semibold">@{asset.minter_username}</span>
              </p>
            )}
            {!isUsername && priceFormatted && (
              <p className="mt-1 text-2xl font-bold text-primary">{priceFormatted}</p>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary p-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold">{LEVEL_LABELS[asset.verification_level || 0]}</p>
              <p className="text-xs text-muted-foreground">Trust level embedded in NFT metadata</p>
            </div>
          </div>

          {isReceived && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
              <ArrowDownLeft className="h-5 w-5 shrink-0 text-emerald-500" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">Received NFT</p>
                {receivedFrom && (
                  <button onClick={() => copyAddress(receivedFrom)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <span className="truncate font-mono">{receivedFrom}</span>
                    <Copy className="h-3 w-3 shrink-0" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Contract</span>
              <button onClick={() => copyAddress(asset.contract_address)} className="flex items-center gap-1 font-mono text-xs hover:text-primary">
                {asset.contract_address?.slice(0, 8)}…{asset.contract_address?.slice(-6)}
                <Copy className="h-3 w-3" />
              </button>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Token ID</span>
              <span className="font-mono text-xs">{asset.token_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Chain</span>
              <span className="font-medium">Polygon</span>
            </div>
            {asset.mint_tx_hash && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mint Tx</span>
                <a href={`https://polygonscan.com/tx/${asset.mint_tx_hash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                  View <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>

          {asset.transfer_history && asset.transfer_history.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-bold">Transfer History</h4>
              <div className="space-y-1.5">
                {asset.transfer_history.map((t, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{t.to_wallet?.slice(0, 8)}…{t.to_wallet?.slice(-4)}</span>
                      {t.verified === false && (
                        <span className="flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">
                          <Clock className="h-2.5 w-2.5" /> Pending
                        </span>
                      )}
                      {t.verified === true && (
                        <span className="flex items-center gap-0.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-bold text-success">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Verified
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground">{new Date(t.at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
              {asset.transfer_history.some(t => t.verified === false) && (
                <p className="mt-2 text-[10px] text-amber-600">
                  Pending transfers complete only when the physical card receipt is confirmed.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}