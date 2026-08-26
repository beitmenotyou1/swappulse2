import React from 'react';
import { DualChainBadge } from './DualChainBadge';
import { Image } from '@/components/ui/image';

const PULSE_EXPLORER = 'https://explorer.pulsechain.com';
const POLYGON_EXPLORER = 'https://polygonscan.com';

/**
 * NFTCard — displays a single NFT (username or card) in a grid.
 * Shows dual-chain status badges and verification level.
 *
 * Accessibility: 44x44px minimum touch target, keyboard navigable,
 * alt text on images, focus ring visible.
 */
export function NFTCard({ asset, onClick }) {
  const isUsername = asset.asset_type === 'username';
  const cardImage = isUsername ? asset.metadata_uri : asset.linked_card_image;
  const cardName = isUsername ? `@${asset.handle}` : asset.linked_card_name;
  const rarityGlowClass = isUsername ? '' : 'rarity-glow-holo';

  return (
    <button
      type="button"
      onClick={() => onClick(asset)}
      className={`group relative flex flex-col items-center rounded-xl p-4 text-left w-full min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors hover:bg-secondary ${rarityGlowClass}`}
      aria-label={`${isUsername ? 'Username NFT' : 'Card NFT'}: ${cardName}`}
    >
      <div className="relative w-full aspect-[3/4] mb-3 rounded-lg overflow-hidden bg-secondary">
        {cardImage ? (
          <Image
            src={cardImage}
            alt={isUsername ? `SwapPulse Username NFT for ${cardName}` : `Pokemon TCG card: ${cardName}`}
            className="w-full h-full"
            fittingType="fill"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No image</div>
        )}

        {!isUsername && asset.verification_level > 0 && (
          <span
            className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold backdrop-blur-sm"
            style={{
              backgroundColor: 'rgba(15, 17, 23, 0.8)',
              color: asset.verification_level === 3 ? '#fbbf24' : '#10B981',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            aria-label={`Verification level ${asset.verification_level} of 3`}
          >
            {asset.verification_level === 3 && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            Lv{asset.verification_level}
          </span>
        )}
      </div>

      <h3 className="text-sm font-semibold text-foreground truncate w-full mb-2" title={cardName}>{cardName}</h3>

      <div className="flex items-center gap-2 w-full">
        <DualChainBadge
          bridgeStatus={asset.bridge_status || 'none'}
          sourceChain={asset.source_chain || 'polygon'}
          dualChain={asset.dual_chain || false}
          size="sm"
        />
      </div>

      {asset.mint_tx_hash && (
        <a
          href={asset.source_chain === 'pulse' ? `${PULSE_EXPLORER}/tx/${asset.mint_tx_hash}` : `${POLYGON_EXPLORER}/tx/${asset.mint_tx_hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 min-h-[44px] py-2"
          aria-label="View transaction on blockchain explorer"
          onClick={(e) => e.stopPropagation()}
        >
          {asset.source_chain === 'pulse' ? 'PulseScan' : 'PolygonScan'}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 17L17 7M17 7H7m10 0v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      )}
    </button>
  );
}

export default NFTCard;