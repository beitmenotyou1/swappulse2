import React, { useState, useEffect } from 'react';
import { Loader2, Fingerprint, ShieldCheck, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import CardImage from '@/components/cards/CardImage';
import { useT } from '@/lib/i18n/I18nProvider';
import { useCryptoEnabled } from '@/hooks/useCryptoEnabled';
import OnChainBadge from './OnChainBadge';

// Profile tab showing a collector's minted on-chain assets: their soulbound
// username NFT and any card NFTs they've minted as proof of ownership.
// Shown for both the profile owner and visitors (public read).
// Hidden when crypto features are disabled.
export default function OnChainActivityTab({ did }) {
  const t = useT();
  const { cryptoEnabled, loading: cryptoLoading } = useCryptoEnabled();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!did || !cryptoEnabled) { setLoading(false); return; }
    (async () => {
      try {
        const res = await base44.functions.invoke('get-on-chain-assets', { did });
        setAssets(res.data.assets || []);
      } catch { setAssets([]); }
      finally { setLoading(false); }
    })();
  }, [did, cryptoEnabled]);

  if (cryptoLoading || loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!cryptoEnabled) return null;

  if (!assets.length) {
    return (
      <div className="px-4 py-16 text-center">
        <Fingerprint className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-semibold text-muted-foreground">No on-chain assets yet</p>
        <p className="mt-1 text-xs text-muted-foreground/60">Mint a username or card NFT to see it here.</p>
      </div>
    );
  }

  const usernameAsset = assets.find((a) => a.asset_type === 'username');
  const cardAssets = assets.filter((a) => a.asset_type === 'card');

  return (
    <div className="space-y-4 p-4">
      {usernameAsset && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-sm font-bold">Soulbound Username</h3>
              <p className="text-xs text-muted-foreground">Permanent on-chain identity · non-transferable</p>
            </div>
          </div>
          <div className="mt-2 text-sm">
            <span className="font-semibold">@{usernameAsset.handle}</span>
            <span className="ml-2 text-xs font-mono text-muted-foreground">Token #{usernameAsset.token_id}</span>
          </div>
          {usernameAsset.mint_tx_hash && (
            <a
              href={`https://polygonscan.com/tx/${usernameAsset.mint_tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              View mint transaction <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {cardAssets.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Card NFTs ({cardAssets.length})
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cardAssets.map((asset) => (
              <div key={asset.id} className="rounded-xl border border-border bg-card p-2">
                <div className="aspect-[3/4] overflow-hidden rounded-lg bg-secondary">
                  {asset.linked_card_image ? (
                    <CardImage src={asset.linked_card_image} alt={asset.linked_card_name} quality="low" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground/30">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <p className="mt-1.5 truncate text-xs font-semibold">{asset.linked_card_name}</p>
                <div className="mt-0.5 mb-1">
                  <OnChainBadge verificationLevel={asset.verification_level} size="sm" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-muted-foreground">#{asset.token_id}</span>
                  {asset.mint_tx_hash && (
                    <a
                      href={`https://polygonscan.com/tx/${asset.mint_tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}