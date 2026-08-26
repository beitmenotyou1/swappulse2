import React, { useState, useRef, useEffect } from 'react';

/**
 * ChainSelector — dropdown for selecting the active blockchain in the wallet view.
 * PulseChain appears first with a "Native" badge.
 *
 * Accessibility: keyboard navigable (arrow keys, Enter, Escape),
 * aria-expanded, aria-controls, 44x44px minimum touch target.
 */
const PULSE_BADGE = { label: 'SWAP', color: '#6d4aff' };

export function ChainSelector({ chains = [], selectedChain, onSelect, balances = {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  const sortedChains = [...chains].sort((a, b) => {
    if (a.isNative && !b.isNative) return -1;
    if (!a.isNative && b.isNative) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  const selected = sortedChains.find((c) => c.chainId === selectedChain) || sortedChains[0];

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleKeyDown(e) {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(sortedChains.findIndex((c) => c.chainId === selectedChain));
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, sortedChains.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        onSelect(sortedChains[focusedIndex]);
        setIsOpen(false);
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
    }
  }

  function formatBalance(balance) {
    if (!balance || balance === '0') return '0.00';
    const num = parseFloat(balance) / Math.pow(10, 18);
    if (num < 0.0001) return '<0.0001';
    return num.toFixed(4);
  }

  const ChainLogo = React.lazy(() => import('./ChainLogo'));

  return (
    <div ref={dropdownRef} className="relative w-full">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select blockchain, currently ${selected?.name || 'none'}`}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="flex items-center justify-between w-full min-h-[44px] px-4 py-3 rounded-xl bg-card border border-border hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <React.Suspense fallback={<div className="w-6 h-6" />}>
            <ChainLogo chain={selected} size={24} />
          </React.Suspense>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">{selected?.name || 'Select Chain'}</span>
            <span className="text-xs text-muted-foreground">{selected?.symbol} {formatBalance(balances[selected?.chainId]?.native)}</span>
          </div>
          {selected?.isNative && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: `${PULSE_BADGE.color}20`, color: PULSE_BADGE.color, border: `1px solid ${PULSE_BADGE.color}40` }}>Native</span>
          )}
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div role="listbox" aria-label="Available blockchains" className="absolute z-30 mt-2 w-full max-h-80 overflow-y-auto rounded-xl bg-card border border-border shadow-elevated">
          <div className="sticky top-0 px-4 py-2 bg-card border-b border-border text-xs text-muted-foreground">{sortedChains.length} chains available</div>
          {sortedChains.map((chain, index) => {
            const isSelected = chain.chainId === selectedChain;
            const isFocused = index === focusedIndex;
            const balance = balances[chain.chainId];
            return (
              <button
                key={chain.chainId}
                role="option"
                aria-selected={isSelected}
                onClick={() => { onSelect(chain); setIsOpen(false); }}
                onMouseEnter={() => setFocusedIndex(index)}
                className={`flex items-center justify-between w-full min-h-[44px] px-4 py-2.5 text-left transition-colors ${isFocused ? 'bg-secondary' : 'bg-transparent'}`}
              >
                <div className="flex items-center gap-3">
                  <React.Suspense fallback={<div className="w-5 h-5" />}>
                    <ChainLogo chain={chain} size={20} />
                  </React.Suspense>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {chain.name}
                      {chain.isNative && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide align-middle" style={{ backgroundColor: `${PULSE_BADGE.color}20`, color: PULSE_BADGE.color, border: `1px solid ${PULSE_BADGE.color}40` }}>Native</span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">{chain.symbol} {formatBalance(balance?.native)}</span>
                  </div>
                </div>
                {isSelected && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-primary" aria-hidden="true">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ChainSelector;