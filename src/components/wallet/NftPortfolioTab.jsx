import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Package, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { useSettings } from '@/hooks/useSettings';
import NftCard from '@/components/wallet/NftCard';
import NftDetailSheet from '@/components/wallet/NftDetailSheet';

function convertUsdToDisplay(usdAmount, displayCurrency, prices) {
  switch (displayCurrency) {
    case 'USD':
      return `$${usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'GBP': {
      const rate = prices?.usdc?.gbp || 0;
      return rate > 0 ? `£${(usdAmount * rate).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '£—';
    }
    case 'EUR': {
      const rate = prices?.usdc?.eur || 0;
      return rate > 0 ? `€${(usdAmount * rate).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '€—';
    }
    case 'USDC':
      return `${usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
    case 'POL': {
      const polPrice = prices?.pol?.usd || 0;
      return polPrice > 0 ? `${(usdAmount / polPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} POL` : '— POL';
    }
    default:
      return `$${usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export default function NftPortfolioTab() {
  const [nfts, setNfts] = useState([]);
  const [totalValueUsd, setTotalValueUsd] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedNft, setSelectedNft] = useState(null);
  const { prices } = useCryptoPrices();
  const { settings } = useSettings();
  const displayCurrency = settings?.crypto?.display_currency || 'USD';

  const loadNfts = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('get-wallet-nfts', {});
      setNfts(res.data?.nfts || []);
      setTotalValueUsd(res.data?.totalValueUsd || 0);
    } catch (e) {
      console.error('NFT load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNfts(); }, [loadNfts]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalFormatted = convertUsdToDisplay(totalValueUsd, displayCurrency, prices);
  const cardNfts = nfts.filter(n => n.asset.asset_type === 'card');
  const usernameNfts = nfts.filter(n => n.asset.asset_type === 'username');

  return (
    <div className="space-y-4">
      {/* Total value header */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-accent/5 p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase">Total NFT Portfolio Value</span>
        </div>
        <p className="mt-1 text-3xl font-extrabold">{totalFormatted}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {cardNfts.length} card NFT{cardNfts.length !== 1 ? 's' : ''}
          {usernameNfts.length > 0 && ` · ${usernameNfts.length} identity NFT${usernameNfts.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* NFT grid */}
      {nfts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="mb-3 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-bold">No NFTs yet</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Mint your Pokémon cards as NFTs on Polygon to prove ownership and build your on-chain collection.
          </p>
          <Link to="/explore" className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90">
            Explore Cards to Mint
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {nfts.map((nft) => (
            <NftCard
              key={nft.asset.id}
              nft={nft}
              priceFormatted={
                nft.asset.asset_type === 'card' && nft.marketPrice > 0
                  ? convertUsdToDisplay(nft.marketPrice, displayCurrency, prices)
                  : null
              }
              onClick={() => setSelectedNft(nft)}
            />
          ))}
        </div>
      )}

      {selectedNft && (
        <NftDetailSheet
          nft={selectedNft}
          priceFormatted={
            selectedNft.asset.asset_type === 'card' && selectedNft.marketPrice > 0
              ? convertUsdToDisplay(selectedNft.marketPrice, displayCurrency, prices)
              : null
          }
          onClose={() => setSelectedNft(null)}
        />
      )}
    </div>
  );
}