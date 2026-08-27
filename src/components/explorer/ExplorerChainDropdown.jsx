import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Check } from 'lucide-react';
import { EXPLORER_CHAINS, getChainMeta } from '@/lib/explorerChains';
import { getActiveChain, setActiveChain } from '@/lib/explorerChain';
import ChainLogo from './ChainLogo';

// Compact chain selector dropdown for the explorer top navigation.
// Shows the current chain name + symbol; opens a dropdown to switch.
// Persists selection to URL param + localStorage.
export default function ExplorerChainDropdown() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = getActiveChain(searchParams);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  const meta = getChainMeta(selected);

  const handleSelect = (key) => {
    setActiveChain(key, searchParams, setSearchParams);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-semibold transition-colors hover:border-border-strong"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {meta.isMain && <Check className="h-3 w-3 text-primary" />}
        <ChainLogo chainKey={selected} size={16} />
        <span className="max-w-[80px] truncate sm:max-w-none">{meta.name}</span>
        <span className="hidden text-[10px] text-muted-foreground sm:inline">{meta.symbol}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-1.5 max-h-80 w-56 overflow-y-auto rounded-xl border border-border bg-popover shadow-elevated"
          role="listbox"
        >
          {EXPLORER_CHAINS.map((chain) => {
            const isActive = selected === chain.key;
            return (
              <button
                key={chain.key}
                onClick={() => handleSelect(chain.key)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-secondary ${
                  isActive ? 'font-semibold text-primary' : 'text-foreground'
                }`}
                role="option"
                aria-selected={isActive}
              >
                <span className="flex items-center gap-2">
                  {chain.isMain && <span className="text-primary">★</span>}
                  <ChainLogo chainKey={chain.key} size={16} />
                  {chain.name}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">{chain.symbol}</span>
                  {isActive && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}