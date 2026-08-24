import React from 'react';
import { Image as ImageIcon, Sparkles } from 'lucide-react';
import { Image } from '@/components/ui/image';

// Renders the user's profile avatar as a dynamic NFT card. The @username
// appears at the top in gold, the avatar fills the center, and the display
// name + member-since date appear at the bottom. Because the underlying
// username-nft-metadata backend function reads live profile data on every
// request, the NFT visual updates automatically whenever the collector
// edits their profile details or avatar.
export default function DynamicNftAvatar({
  handle,
  displayName,
  avatar,
  memberSince,
  did,
  size = 'md',
}) {
  const name = displayName || handle;
  const since = memberSince
    ? new Date(memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  const sizeClass = size === 'lg' ? 'max-w-[280px]' : size === 'sm' ? 'max-w-[160px]' : 'max-w-[220px]';

  return (
    <div className={`relative ${sizeClass} w-full overflow-hidden rounded-2xl bg-black shadow-elevated ring-2 ring-primary/40 rarity-glow-ex`}>
      {/* Avatar as full-bleed background */}
      {avatar ? (
        <Image
          src={avatar}
          fittingType="fill"
          className="absolute inset-0 h-full w-full"
          alt={`${name}'s avatar`}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary/30 to-accent/20">
          <ImageIcon className="h-8 w-8 text-white/40" />
        </div>
      )}

      {/* Top gradient strip with @username */}
      <div className="absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-black/90 to-transparent" />
      <p className="absolute top-3 left-0 right-0 truncate px-2 text-center text-base font-extrabold text-amber-400 drop-shadow-lg">
        @{handle}
      </p>

      {/* Bottom gradient strip with display name + member since */}
      <div className="absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-t from-black/95 via-black/70 to-transparent" />
      <p className="absolute bottom-7 left-0 right-0 truncate px-2 text-center text-sm font-semibold text-white drop-shadow">
        {name}
      </p>
      {since && (
        <p className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-gray-400">
          Member since {since}
        </p>
      )}

      {/* Dynamic NFT badge */}
      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-primary/80 px-2 py-0.5 backdrop-blur-sm">
        <Sparkles className="h-2.5 w-2.5 text-white" />
        <span className="text-[9px] font-bold uppercase text-white">NFT</span>
      </div>
    </div>
  );
}