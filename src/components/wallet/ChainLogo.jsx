import React from 'react';

/**
 * ChainLogo — renders a simple SVG icon for each blockchain.
 * PulseChain uses the SwapPulse "heartbeat" logo.
 *
 * @param {Object} chain — Chain configuration object
 * @param {number} size — Icon size in pixels
 */
export function ChainLogo({ chain, size = 20 }) {
  if (!chain) return null;

  if (chain.isNative || chain.symbol === 'PULSE') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="11" stroke="#6d4aff" strokeWidth="2" />
        <path d="M3 12h3l2-5 4 10 2-5h7" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (chain.type === 'evm') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2L2 12l10 10 10-10L12 2z" stroke="#8247e5" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }

  if (chain.symbol === 'SOL') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 8h12l3 3v5H8l-3-3V8z" stroke="#9945ff" strokeWidth="2" strokeLinejoin="round" />
        <path d="M5 13h12l3 3M5 8l3 3" stroke="#14f195" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (chain.type === 'bitcoin') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="11" stroke="#f7931a" strokeWidth="2" />
        <text x="12" y="16" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#f7931a" fontFamily="sans-serif">B</text>
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="11" stroke="hsl(var(--muted-foreground))" strokeWidth="2" />
    </svg>
  );
}

export default ChainLogo;