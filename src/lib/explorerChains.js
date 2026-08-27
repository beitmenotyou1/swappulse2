// Frontend chain list for the multi-chain explorer. Mirrors the backend
// chainRegistry.ts but only includes display-relevant fields (no RPC secrets).
// PulseChain is the main/default chain (isMain: true).
// brandColor is the chain's official brand colour, used for fallback letter-marks
// and tinted backgrounds when no web3icons network logo is available.

export const EXPLORER_CHAINS = [
  { key: 'pulse', name: 'PulseChain', chainId: 369, symbol: 'PLS', isMain: true, brandColor: '#00B366' },
  { key: 'ethereum', name: 'Ethereum', chainId: 1, symbol: 'ETH', brandColor: '#627EEA' },
  { key: 'polygon', name: 'Polygon', chainId: 137, symbol: 'POL', brandColor: '#8247E5' },
  { key: 'base', name: 'Base', chainId: 8453, symbol: 'ETH', brandColor: '#0052FF' },
  { key: 'arbitrum', name: 'Arbitrum One', chainId: 42161, symbol: 'ETH', brandColor: '#28A0F0' },
  { key: 'optimism', name: 'Optimism', chainId: 10, symbol: 'ETH', brandColor: '#FF0420' },
  { key: 'bnb', name: 'BNB Smart Chain', chainId: 56, symbol: 'BNB', brandColor: '#F3BA2F' },
  { key: 'avalanche', name: 'Avalanche', chainId: 43114, symbol: 'AVAX', brandColor: '#E84142' },
  { key: 'gnosis', name: 'Gnosis', chainId: 100, symbol: 'xDAI', brandColor: '#3E6957' },
  { key: 'linea', name: 'Linea', chainId: 59144, symbol: 'ETH', brandColor: '#61DFFF' },
  { key: 'zksync', name: 'zkSync Era', chainId: 324, symbol: 'ETH', brandColor: '#8C8DFC' },
  { key: 'scroll', name: 'Scroll', chainId: 534352, symbol: 'ETH', brandColor: '#E0C99E' },
  { key: 'metis', name: 'Metis', chainId: 1088, symbol: 'METIS', brandColor: '#00D3C5' },
  { key: 'celo', name: 'Celo', chainId: 42220, symbol: 'CELO', brandColor: '#35D07F' },
  { key: 'moonbeam', name: 'Moonbeam', chainId: 1284, symbol: 'GLMR', brandColor: '#6E56C8' },
  { key: 'mode', name: 'Mode', chainId: 34443, symbol: 'ETH', brandColor: '#D4FF00' },
  { key: 'unichain', name: 'Uniswap Chain', chainId: 84532, symbol: 'ETH', brandColor: '#FF007A' },
  { key: 'xlayer', name: 'X Layer', chainId: 196, symbol: 'OKX', brandColor: '#1A1A1A' },
  { key: 'boba', name: 'Boba', chainId: 288, symbol: 'ETH', brandColor: '#00B386' },
  { key: 'zora', name: 'Zora', chainId: 7777777, symbol: 'ETH', brandColor: '#000000' },
  { key: 'blast', name: 'Blast', chainId: 81457, symbol: 'ETH', brandColor: '#FCFC03' },
  { key: 'flowevm', name: 'Flow EVM', chainId: 747, symbol: 'FLOW', brandColor: '#00EF8B' },
  { key: 'kaia', name: 'Kaia', chainId: 8217, symbol: 'KAIA', brandColor: '#4C1F7A' },
  { key: 'opbnb', name: 'opBNB', chainId: 204, symbol: 'BNB', brandColor: '#F3BA2F' },
  { key: 'cronos', name: 'Cronos', chainId: 25, symbol: 'CRO', brandColor: '#002D74' },
  { key: 'sonic', name: 'Sonic', chainId: 146, symbol: 'S', brandColor: '#29327C' },
  { key: 'mantle', name: 'Mantle', chainId: 5000, symbol: 'MNT', brandColor: '#65B3AE' },
  { key: 'zetachain', name: 'ZetaChain', chainId: 7000, symbol: 'ZETA', brandColor: '#5E6AD2' },
  { key: 'astar', name: 'Astar', chainId: 592, symbol: 'ASTR', brandColor: '#00C48D' },
  { key: 'shape', name: 'Shape', chainId: 360, symbol: 'ETH', brandColor: '#65B3AE' },
  { key: 'worldchain', name: 'World Chain', chainId: 480, symbol: 'ETH', brandColor: '#1A1A1A' },
  { key: 'berachain', name: 'Berachain', chainId: 80084, symbol: 'BERA', brandColor: '#9D7B4B' },
  { key: 'rootstock', name: 'Rootstock', chainId: 30, symbol: 'RBTC', brandColor: '#00B366' },
  { key: 'bob', name: 'BOB', chainId: 60808, symbol: 'ETH', brandColor: '#FFA500' },
  { key: 'ink', name: 'Ink', chainId: 57073, symbol: 'ETH', brandColor: '#1A1A1A' },
  { key: 'frax', name: 'Fraxtal', chainId: 252, symbol: 'FRAX', brandColor: '#000000' },
];

// Chains shown in the compact overview grid on the homepage.
export const OVERVIEW_CHAIN_KEYS = ['pulse', 'ethereum', 'polygon', 'base', 'arbitrum', 'optimism', 'bnb', 'avalanche'];

export function getChainMeta(key) {
  return EXPLORER_CHAINS.find((c) => c.key === key) || EXPLORER_CHAINS[0];
}