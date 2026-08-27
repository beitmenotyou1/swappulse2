// Frontend chain list for the multi-chain explorer. Mirrors the backend
// chainRegistry.ts but only includes display-relevant fields (no RPC secrets).
// PulseChain is the main/default chain (isMain: true).

export const EXPLORER_CHAINS = [
  { key: 'pulse', name: 'PulseChain', chainId: 369, symbol: 'PLS', isMain: true },
  { key: 'ethereum', name: 'Ethereum', chainId: 1, symbol: 'ETH' },
  { key: 'polygon', name: 'Polygon', chainId: 137, symbol: 'POL' },
  { key: 'base', name: 'Base', chainId: 8453, symbol: 'ETH' },
  { key: 'arbitrum', name: 'Arbitrum One', chainId: 42161, symbol: 'ETH' },
  { key: 'optimism', name: 'Optimism', chainId: 10, symbol: 'ETH' },
  { key: 'bnb', name: 'BNB Smart Chain', chainId: 56, symbol: 'BNB' },
  { key: 'avalanche', name: 'Avalanche', chainId: 43114, symbol: 'AVAX' },
  { key: 'gnosis', name: 'Gnosis', chainId: 100, symbol: 'xDAI' },
  { key: 'linea', name: 'Linea', chainId: 59144, symbol: 'ETH' },
  { key: 'zksync', name: 'zkSync Era', chainId: 324, symbol: 'ETH' },
  { key: 'scroll', name: 'Scroll', chainId: 534352, symbol: 'ETH' },
  { key: 'metis', name: 'Metis', chainId: 1088, symbol: 'METIS' },
  { key: 'celo', name: 'Celo', chainId: 42220, symbol: 'CELO' },
  { key: 'moonbeam', name: 'Moonbeam', chainId: 1284, symbol: 'GLMR' },
  { key: 'mode', name: 'Mode', chainId: 34443, symbol: 'ETH' },
  { key: 'unichain', name: 'Uniswap Chain', chainId: 84532, symbol: 'ETH' },
  { key: 'xlayer', name: 'X Layer', chainId: 196, symbol: 'OKX' },
  { key: 'boba', name: 'Boba', chainId: 288, symbol: 'ETH' },
  { key: 'zora', name: 'Zora', chainId: 7777777, symbol: 'ETH' },
  { key: 'blast', name: 'Blast', chainId: 81457, symbol: 'ETH' },
  { key: 'flowevm', name: 'Flow EVM', chainId: 747, symbol: 'FLOW' },
  { key: 'kaia', name: 'Kaia', chainId: 8217, symbol: 'KAIA' },
  { key: 'opbnb', name: 'opBNB', chainId: 204, symbol: 'BNB' },
  { key: 'cronos', name: 'Cronos', chainId: 25, symbol: 'CRO' },
  { key: 'sonic', name: 'Sonic', chainId: 146, symbol: 'S' },
  { key: 'mantle', name: 'Mantle', chainId: 5000, symbol: 'MNT' },
  { key: 'zetachain', name: 'ZetaChain', chainId: 7000, symbol: 'ZETA' },
  { key: 'astar', name: 'Astar', chainId: 592, symbol: 'ASTR' },
  { key: 'shape', name: 'Shape', chainId: 360, symbol: 'ETH' },
  { key: 'worldchain', name: 'World Chain', chainId: 480, symbol: 'ETH' },
  { key: 'berachain', name: 'Berachain', chainId: 80084, symbol: 'BERA' },
  { key: 'rootstock', name: 'Rootstock', chainId: 30, symbol: 'RBTC' },
  { key: 'bob', name: 'BOB', chainId: 60808, symbol: 'ETH' },
  { key: 'ink', name: 'Ink', chainId: 57073, symbol: 'ETH' },
  { key: 'frax', name: 'Fraxtal', chainId: 252, symbol: 'FRAX' },
];

// Chains shown in the compact overview grid on the homepage.
export const OVERVIEW_CHAIN_KEYS = ['pulse', 'ethereum', 'polygon', 'base', 'arbitrum', 'optimism', 'bnb', 'avalanche'];

export function getChainMeta(key) {
  return EXPLORER_CHAINS.find((c) => c.key === key) || EXPLORER_CHAINS[0];
}