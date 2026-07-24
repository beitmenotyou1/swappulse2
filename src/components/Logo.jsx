import React from 'react';

export default function Logo({ size = 32, withText = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="relative grid place-items-center rounded-xl font-extrabold text-white shadow-lg shadow-primary/30"
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, hsl(215 90% 58%), hsl(276 75% 62%))',
          fontSize: size * 0.42,
        }}
      >
        SP
        <span
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent"
          style={{ boxShadow: '0 0 8px hsl(45 96% 54%)' }}
        />
      </div>
      {withText && (
        <span className="text-xl font-extrabold tracking-tight">
          Swap<span className="text-gradient-pulse">Pulse</span>
        </span>
      )}
    </div>
  );
}