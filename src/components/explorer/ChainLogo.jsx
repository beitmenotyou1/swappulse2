import React from 'react';
import { getChainMeta } from '@/lib/explorerChains';

// Pick black or white text for a given hex background for readable contrast.
function getContrastText(hex) {
  const c = (hex || '#64748b').replace('#', '');
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#1e293b' : '#ffffff';
}

// Renders a chain's logo as a branded circular letter-mark in the chain's
// official brand colour. 100% local (no external fetch, no npm icon pack) so
// it never breaks. The chain name is always shown alongside in the UI, so the
// letter + brand colour is enough to distinguish chains at a glance.
export default function ChainLogo({ chainKey, size = 20, className = '' }) {
  const meta = getChainMeta(chainKey);
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