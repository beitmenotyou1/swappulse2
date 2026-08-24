import React from 'react';
import { SUPPORTED_CHAINS } from '@/lib/chains';

// MetaMask/Brave-style horizontal chain switcher. "All" shows every chain;
// selecting a chain filters the asset list to that chain only.
export default function ChainSwitcher({ selected, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      <button
        onClick={() => onSelect('all')}
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
          selected === 'all'
            ? 'bg-primary text-white'
            : 'border border-border bg-card text-muted-foreground hover:bg-secondary'
        }`}
      >
        All Chains
      </button>
      {SUPPORTED_CHAINS.map((chain) => (
        <button
          key={chain.key}
          onClick={() => onSelect(chain.key)}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
            selected === chain.key
              ? 'bg-primary text-white'
              : 'border border-border bg-card text-muted-foreground hover:bg-secondary'
          }`}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: chain.color }}
          />
          {chain.name}
        </button>
      ))}
    </div>
  );
}