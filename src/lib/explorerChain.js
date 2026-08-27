// Shared helper for chain selection persistence in the explorer.
// URL param takes priority, then localStorage, then 'pulse' (default).
// Writes to both URL and localStorage on change.

const STORAGE_KEY = 'explorer-chain';

export function getActiveChain(searchParams) {
  const urlChain = searchParams?.get('chain');
  if (urlChain) return urlChain;
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  }
  return 'pulse';
}

export function setActiveChain(chain, searchParams, setSearchParams) {
  if (typeof localStorage !== 'undefined') {
    if (chain === 'pulse') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, chain);
  }
  if (chain === 'pulse') {
    searchParams.delete('chain');
  } else {
    searchParams.set('chain', chain);
  }
  setSearchParams(searchParams, { replace: true });
}

// Build a ?chain= query string suffix for the given chain (empty for pulse).
export function chainQuery(chain) {
  return chain && chain !== 'pulse' ? `?chain=${chain}` : '';
}