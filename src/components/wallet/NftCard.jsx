import React from 'react';
import { ShieldCheck, Award, AlertTriangle, ArrowDownLeft } from 'lucide-react';
import { Image } from '@/components/ui/image';

const LEVEL_CONFIG = {
  0: { label: 'Self-attested', icon: AlertTriangle, className: 'bg-muted text-muted-foreground' },
  1: { label: 'Scanned', icon: ShieldCheck, className: 'bg-primary/10 text-primary' },
  2: { label: 'AI-Verified', icon: ShieldCheck, className: 'bg-primary/10 text-primary' },
  3: { label: 'Graded', icon: Award, className: 'bg-accent/15 text-accent' },
};

export default function NftCard({ nft, priceFormatted, onClick }) {
  const { asset, isReceived } = nft;
  const level = LEVEL_CONFIG[asset.verification_level || 0] || LEVEL_CONFIG[0];
  const LevelIcon = level.icon;
  const isUsername = asset.asset_type === 'username';

  return (
    <button
      onClick={onClick}
      className="group overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:border-primary/30 hover:shadow-raised"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
        {asset.linked_card_image ? (
          <Image
            src={asset.linked_card_image}
            alt={asset.linked_card_name || asset.handle || 'NFT'}
            fittingType="fill"
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            {isUsername ? (
              <div className="text-center">
                <div className="text-2xl font-bold">@{asset.handle}</div>
                <div className="mt-1 text-[10px]">Identity NFT</div>
              </div>
            ) : (
              <span className="text-xs">No image</span>
            )}
          </div>
        )}
        <div className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${level.className}`}>
          <LevelIcon className="h-3 w-3" />
          {level.label}
        </div>
        {isReceived && (
          <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
            <ArrowDownLeft className="h-3 w-3" />
            Received
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-bold">{asset.linked_card_name || asset.handle || 'NFT'}</p>
        {!isUsername && asset.minter_username && (
          <p className="truncate text-[10px] text-muted-foreground">@{asset.minter_username}</p>
        )}
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {isUsername ? 'Identity' : `#${asset.token_id}`}
          </span>
          {!isUsername && priceFormatted && (
            <span className="text-sm font-bold text-primary">{priceFormatted}</span>
          )}
        </div>
      </div>
    </button>
  );
}