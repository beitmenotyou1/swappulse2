import React from 'react';

// Shared profile header for both the logged-in collector's profile and other
// collectors' profiles. Rationalizes identity, metrics, reputation and actions
// into a balanced, breathable block with clear visual hierarchy, and reflows
// cleanly on mobile (avatar above actions, each info row on its own line).
export default function ProfileHeader({
  banner,
  bannerHeight = 'h-32 sm:h-40',
  avatarOverlap = '-mt-10 sm:-mt-12',
  avatar,
  avatarBadge,
  backLink,
  externalBanner,
  name,
  badges,
  handleNode,
  metricsNode,
  description,
  reputationNode,
  actions,
  extra,
}) {
  return (
    <div>
      <div className={`w-full overflow-hidden bg-gradient-to-r from-primary/40 via-rarity-holo/30 to-accent/30 ${bannerHeight}`}>
        {banner ? (
          <img src={banner} alt="Profile header" className="h-full w-full object-cover" />
        ) : null}
      </div>
      {externalBanner}
      <div className="px-4">
        {backLink && <div className="mt-2 mb-2">{backLink}</div>}
        <div className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${avatarOverlap}`}>
          <span className="relative inline-block w-fit">
            {avatar}
            {avatarBadge}
          </span>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <div className="mt-4 space-y-2.5 pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold">{name}</h1>
            {badges}
          </div>
          {handleNode}
          {metricsNode}
          {description}
          {reputationNode}
          {extra}
        </div>
      </div>
    </div>
  );
}