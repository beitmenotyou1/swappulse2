import React from 'react';
import { initials } from '@/lib/format';

export default function Avatar({ name, src, size = 40, className = '', online = false }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  const inner = src ? (
    <img
      src={src}
      alt={name || 'avatar'}
      style={style}
      className={`rounded-full object-cover ring-1 ring-border ${className}`}
    />
  ) : (
    <div
      style={{ ...style, background: 'linear-gradient(135deg, hsl(215 60% 40%), hsl(276 55% 45%))' }}
      className={`grid place-items-center rounded-full font-bold text-white ring-1 ring-border ${className}`}
    >
      {initials(name)}
    </div>
  );
  if (!online) return inner;
  const dot = Math.max(8, Math.round(size * 0.28));
  return (
    <span className="relative inline-block">
      {inner}
      <span
        className="absolute bottom-0 right-0 rounded-full bg-success ring-2 ring-background"
        style={{ width: dot, height: dot }}
      />
    </span>
  );
}