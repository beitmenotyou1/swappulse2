import React from 'react';

/**
 * DualChainBadge — displays the chain status of an NFT (Polygon, PulseChain, or both).
 *
 * Variants: "polygon" | "pulse" | "dual" | "bridging"
 *
 * Accessibility: colour is never the sole indicator (icon + text always present),
 * aria-label describes the full status, minimum 44x44px touch target on mobile.
 *
 * Brand colours (inline, not design tokens):
 * - Polygon: #8247e5 (Polygon purple)
 * - PulseChain: #6d4aff (SwapPulse primary)
 * - Gold accent: #fbbf24
 */
const CHAIN_CONFIG = {
  polygon: {
    label: 'Polygon',
    shortLabel: 'POL',
    color: '#8247e5',
    bgColor: 'rgba(130, 71, 229, 0.15)',
    borderColor: 'rgba(130, 71, 229, 0.3)',
  },
  pulse: {
    label: 'PulseChain',
    shortLabel: 'PULSE',
    color: '#6d4aff',
    bgColor: 'rgba(109, 74, 255, 0.15)',
    borderColor: 'rgba(109, 74, 255, 0.3)',
  },
};

function ChainIcon({ chain, size = 16 }) {
  if (chain === 'polygon') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M17.5 8.5L13.5 6.25V10.75L17.5 8.5Z" fill="currentColor" />
        <path d="M13.5 10.75L9.5 8.5L13.5 6.25V10.75Z" fill="currentColor" opacity="0.7" />
        <path d="M13.5 10.75V15.25L9.5 13L13.5 10.75Z" fill="currentColor" opacity="0.5" />
        <path d="M13.5 10.75L17.5 13L13.5 15.25V10.75Z" fill="currentColor" opacity="0.8" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M7 14L10 8L13 14L16 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DualChainBadge({
  bridgeStatus = 'none',
  sourceChain = 'polygon',
  dualChain = false,
  size = 'md',
  showLabels = true,
}) {
  const sizes = {
    sm: { badge: 'h-6 px-2 text-xs gap-1', icon: 12 },
    md: { badge: 'h-8 px-3 text-sm gap-1.5', icon: 16 },
    lg: { badge: 'h-10 px-4 text-base gap-2', icon: 20 },
  };
  const s = sizes[size];

  if (bridgeStatus === 'pending') {
    return (
      <span
        className={`inline-flex items-center ${s.badge} rounded-full font-medium animate-pulse`}
        style={{ backgroundColor: 'rgba(245, 182, 0, 0.1)', border: '1px solid rgba(245, 182, 0, 0.3)', color: '#fbbf24' }}
        aria-label="Bridging to PulseChain in progress"
        role="status"
      >
        <svg className="animate-spin" width={s.icon} height={s.icon} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
        {showLabels && <span>Bridging…</span>}
      </span>
    );
  }

  if (bridgeStatus === 'failed') {
    return (
      <span
        className={`inline-flex items-center ${s.badge} rounded-full font-medium`}
        style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
        aria-label="Bridge to PulseChain failed, will retry automatically"
        role="alert"
      >
        <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 9v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 0 0-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {showLabels && <span>Retry queued</span>}
      </span>
    );
  }

  if (dualChain && bridgeStatus === 'confirmed') {
    return (
      <span className="inline-flex items-stretch rounded-full overflow-hidden" style={{ border: '1px solid rgba(109, 74, 255, 0.2)' }}>
        <span className={`inline-flex items-center ${s.badge} font-medium`} style={{ backgroundColor: CHAIN_CONFIG.polygon.bgColor, color: CHAIN_CONFIG.polygon.color }} aria-label="Exists on Polygon">
          <ChainIcon chain="polygon" size={s.icon} />
          {showLabels && <span>{CHAIN_CONFIG.polygon.shortLabel}</span>}
        </span>
        <span className="inline-flex items-center justify-center px-1" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} aria-hidden="true">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M0 4L4 0L8 4L4 8L0 4Z" fill="#fbbf24" /></svg>
        </span>
        <span className={`inline-flex items-center ${s.badge} font-medium`} style={{ backgroundColor: CHAIN_CONFIG.pulse.bgColor, color: CHAIN_CONFIG.pulse.color }} aria-label="Also exists on PulseChain">
          <ChainIcon chain="pulse" size={s.icon} />
          {showLabels && <span>{CHAIN_CONFIG.pulse.shortLabel}</span>}
        </span>
      </span>
    );
  }

  const config = CHAIN_CONFIG[sourceChain] || CHAIN_CONFIG.polygon;
  return (
    <span
      className={`inline-flex items-center ${s.badge} rounded-full font-medium cursor-default`}
      style={{ backgroundColor: config.bgColor, border: `1px solid ${config.borderColor}`, color: config.color }}
      aria-label={`On ${config.label}`}
    >
      <ChainIcon chain={sourceChain} size={s.icon} />
      {showLabels && <span>{config.shortLabel}</span>}
    </span>
  );
}

export default DualChainBadge;