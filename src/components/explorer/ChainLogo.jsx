import React, { useState } from 'react';
import { getChainMeta } from '@/lib/explorerChains';

// Official branded network SVG logos are served from the @web3icons/core
// icon set via jsDelivr's GitHub CDN — no npm install needed (the React
// package was too heavy for the platform build optimizer). Each chain's
// logoSlug in explorerChains.js maps to the kebab-case filename.
const LOGO_CDN_BASE =
  'https://cdn.jsdelivr.net/gh/0xa3k5/web3icons@main/packages/core/src/svgs/networks/branded/';

// Pick black or white text for a given hex background for readable contrast.
function getContrastText(hex) {
  const c = (hex || '#64748b').replace('#', '');
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#1e293b' : '#ffffff';
}

// Branded circular letter-mark — used when a chain has no official SVG in
// the @web3icons set (logoSlug is null) or the CDN image fails to load.
function LetterMark({ meta, chainKey, size, className }) {
  const letter = (meta?.name || chainKey).charAt(0).toUpperCase();
  const bg = meta?.brandColor || '#64748b';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${className}`}
      style={{ width: size, height: size, backgroundColor: bg, color: getContrastText(bg), fontSize: size * 0.5 }}
      role="img"
      aria-label={meta?.name}
    >
      {letter}
    </span>
  );
}

// Renders a chain's official branded SVG logo from the @web3icons/core icon
// set (served via jsDelivr CDN). Falls back to a branded circular letter-mark
// if the chain has no official icon (logoSlug is null) or the CDN image
// fails to load, so the UI never breaks.
export default function ChainLogo({ chainKey, size = 20, className = '' }) {
  const meta = getChainMeta(chainKey);
  const [failed, setFailed] = useState(false);
  const slug = meta?.logoSlug;

  if (!slug || failed) {
    return <LetterMark meta={meta} chainKey={chainKey} size={size} className={className} />;
  }

  return (
    <img
      src={`${LOGO_CDN_BASE}${slug}.svg`}
      alt={meta?.name}
      width={size}
      height={size}
      loading="lazy"
      className={`inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}