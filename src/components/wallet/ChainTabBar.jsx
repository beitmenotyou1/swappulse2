import React from 'react';
import { getChain } from '@/lib/chainRegistry';

// Horizontal scrollable chain filter tabs. "All" is always first; each
// subsequent tab is a chain that has at least one asset. Selecting a chain
// filters the parent's asset/NFT list to that chain only.
export default function ChainTabBar({ chains = [], activeChain, onSelectChain }) {
  // Build tab list: "All" + unique chains sorted alphabetically
  const uniqueChains = [...new Set(chains.filter(Boolean))].sort((a, b) => {
    const na = getChain(a)?.name || a;
    const nb = getChain(b)?.name || b;
    return na.localeCompare(nb);
  });

  const tabs = ['all', ...uniqueChains];

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {tabs.map((key) => {
        const chainDef = key === 'all' ? null : getChain(key);
        const label = key === 'all' ? 'All' : (chainDef?.name || key);
        const isActive = activeChain === key;
        return (
          <button
            key={key}
            onClick={() => onSelectChain(key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
              isActive
                ? 'bg-primary text-white'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
            }`}
          >
            {key !== 'all' && chainDef?.symbol && (
              <span className="text-[10px] opacity-70">{chainDef.symbol}</span>
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}