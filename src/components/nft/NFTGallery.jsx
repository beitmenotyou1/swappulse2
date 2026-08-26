import React, { useState, useMemo } from 'react';
import { PackageOpen } from 'lucide-react';
import { NFTCard } from './NFTCard';

/**
 * NFTGallery — displays a grid of NFTs with filtering by chain.
 *
 * Features: chain filter tabs (All, Polygon, PulseChain, Dual-Chain),
 * responsive grid (2 cols mobile, 3 tablet, 4 desktop), loading skeletons, empty state.
 *
 * Accessibility: tab navigation with keyboard support, aria-selected on active tab,
 * minimum 44px touch targets on tabs.
 */
const CHAIN_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'pulse', label: 'PulseChain' },
  { id: 'dual', label: 'Dual-Chain' },
];

export function NFTGallery({ assets = [], loading = false, onSelectNFT }) {
  const [activeFilter, setActiveFilter] = useState('all');

  const filteredAssets = useMemo(() => {
    if (activeFilter === 'all') return assets;
    if (activeFilter === 'polygon') return assets.filter((a) => (a.source_chain || 'polygon') === 'polygon');
    if (activeFilter === 'pulse') return assets.filter((a) => a.source_chain === 'pulse');
    if (activeFilter === 'dual') return assets.filter((a) => a.dual_chain && a.bridge_status === 'confirmed');
    return assets;
  }, [assets, activeFilter]);

  const counts = useMemo(() => ({
    all: assets.length,
    polygon: assets.filter((a) => (a.source_chain || 'polygon') === 'polygon').length,
    pulse: assets.filter((a) => a.source_chain === 'pulse').length,
    dual: assets.filter((a) => a.dual_chain && a.bridge_status === 'confirmed').length,
  }), [assets]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl p-4 bg-card animate-pulse" style={{ minHeight: '300px' }}>
            <div className="w-full aspect-[3/4] rounded-lg bg-secondary mb-3" />
            <div className="h-4 w-3/4 rounded bg-secondary mb-2" />
            <div className="h-6 w-20 rounded-full bg-secondary" />
          </div>
        ))}
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <PackageOpen className="w-16 h-16 mb-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-muted-foreground mb-2">No NFTs Yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Mint your first Username NFT or Card NFT to see it here. Your NFTs will appear on both Polygon and PulseChain.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div role="tablist" aria-label="Filter NFTs by blockchain" className="flex items-center gap-1 mb-6 p-1 rounded-lg bg-card w-fit">
        {CHAIN_FILTERS.map((filter) => (
          <button
            key={filter.id}
            role="tab"
            aria-selected={activeFilter === filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] ${
              activeFilter === filter.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            {filter.label}
            <span className="ml-1.5 text-xs opacity-60">({counts[filter.id]})</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredAssets.map((asset) => (
          <NFTCard key={asset.id} asset={asset} onClick={onSelectNFT} />
        ))}
      </div>

      {filteredAssets.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No NFTs on this chain yet. NFTs minted on Polygon are automatically bridged to PulseChain.</p>
        </div>
      )}
    </div>
  );
}

export default NFTGallery;