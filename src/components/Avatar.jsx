import React from 'react';
import { initials } from '@/lib/format';

export default function Avatar({ name, src, size = 40, className = '' }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (src) {
    return (
      <img
        src={src}
        alt={name || 'avatar'}
        style={style}
        className={`rounded-full object-cover ring-1 ring-border ${className}`}
      />
    );
  }
  return (
    <div
      style={{
        ...style,
        background: 'linear-gradient(135deg, hsl(215 60% 40%), hsl(276 55% 45%))',
      }}
      className={`grid place-items-center rounded-full font-bold text-white ring-1 ring-border ${className}`}
    >
      {initials(name)}
    </div>
  );
}