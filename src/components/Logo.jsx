import React from 'react';

export default function Logo({ size = 32, withText = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative shrink-0 overflow-hidden rounded-xl" style={{ width: size, height: size }}>
        <img src="/brand-logo.svg" alt="SwapPulse logo" className="h-full w-full object-contain" />
      </div>
      {withText && (
        <span className="hidden text-xl font-extrabold tracking-tight xl:inline">
          Swap<span className="text-gradient-pulse">Pulse</span>
        </span>
      )}
    </div>
  );
}