import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { EXPLORER_CHAINS } from '@/lib/explorerChains';
import { getActiveChain, setActiveChain } from '@/lib/explorerChain';
import ChainLogo from './ChainLogo';

// Horizontal scrollable chain selector — pills for each supported chain.
// PulseChain is first (main chain). Persists selection to URL + localStorage.
export default function ChainSelector() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = getActiveChain(searchParams);

  const handleSelect = (key) => {
    setActiveChain(key, searchParams, setSearchParams);
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
      {EXPLORER_CHAINS.map((chain) => {
        const isActive = selected === chain.key;
        return (
          <button
            key={chain.key}
            onClick={() => handleSelect(chain.key)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              isActive
                ? 'border-primary bg-primary text-primary-foreground shadow-raised'
                : 'border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground'
            }`}
          >
            {chain.isMain && <Check className="h-3 w-3" />}
            <ChainLogo chainKey={chain.key} size={16} />
            {chain.name}
            <span className={`text-[10px] ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground/60'}`}>
              {chain.symbol}
            </span>
          </button>
        );
      })}
    </div>
  );
}