import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';
import { Image } from '@/components/ui/image';
import HashLink from './HashLink';

// ERC-721 NFT holdings gallery for an address. Shows each NFT's image,
// name, token ID, and contract address.
export default function AddressNfts({ nfts = [] }) {
  const t = useT();
  if (!nfts.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-base">
      <div className="border-b border-border px-4 py-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <ImageIcon className="h-4 w-4 text-primary" /> {t('explorer.nftCollection')} ({nfts.length})
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
        {nfts.map((nft, i) => (
          <div key={i} className="rounded-lg border border-border bg-secondary/30 p-2">
            <div className="mb-2 aspect-square overflow-hidden rounded-lg border border-border bg-secondary">
              {nft.image ? (
                <Image src={nft.image} alt={nft.name || `NFT #${nft.token_id}`} fittingType="fill" className="h-full w-full" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <p className="truncate text-xs font-semibold">{nft.name || `NFT #${nft.token_id}`}</p>
            <p className="text-[10px] text-muted-foreground">#{nft.token_id}</p>
            <div className="mt-1">
              <HashLink hash={nft.contract} to={`/blockchain/address/${nft.contract}`} prefixLen={6} suffixLen={4} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}