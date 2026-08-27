// Frontend chain list for the multi-chain explorer. Mirrors the backend
// chainRegistry.ts but only includes display-relevant fields (no RPC secrets).
// PulseChain is the main/default chain (isMain: true).
// brandColor is the chain's official brand colour, used for fallback letter-marks
// when no official SVG logo is available.
// logoSlug maps to the @web3icons/core network SVG filename (kebab-case) served
// via jsDelivr CDN — see ChainLogo.jsx. Chains without an official icon in the
// @web3icons set (logoSlug: null) fall back to the branded letter-mark.

export const EXPLORER_CHAINS = [
  { key: 'pulse', name: 'PulseChain', chainId: 369, symbol: 'PLS', isMain: true, brandColor: '#00B366', logoSlug: 'pulsechain' },
  { key: 'ethereum', name: 'Ethereum', chainId: 1, symbol: 'ETH', brandColor: '#627EEA', logoSlug: 'ethereum' },
  { key: 'polygon', name: 'Polygon', chainId: 137, symbol: 'POL', brandColor: '#8247E5', logoSlug: 'polygon' },
  { key: 'base', name: 'Base', chainId: 8453, symbol: 'ETH', brandColor: '#0052FF', logoSlug: 'base' },
  { key: 'arbitrum', name: 'Arbitrum One', chainId: 42161, symbol: 'ETH', brandColor: '#28A0F0', logoSlug: 'arbitrum-one' },
  { key: 'optimism', name: 'Optimism', chainId: 10, symbol: 'ETH', brandColor: '#FF0420', logoSlug: 'optimism' },
  { key: 'bnb', name: 'BNB Smart Chain', chainId: 56, symbol: 'BNB', brandColor: '#F3BA2F', logoSlug: 'binance-smart-chain' },
  { key: 'avalanche', name: 'Avalanche', chainId: 43114, symbol: 'AVAX', brandColor: '#E84142', logoSlug: 'avalanche' },
  { key: 'gnosis', name: 'Gnosis', chainId: 100, symbol: 'xDAI', brandColor: '#3E6957', logoSlug: 'gnosis' },
  { key: 'linea', name: 'Linea', chainId: 59144, symbol: 'ETH', brandColor: '#61DFFF', logoSlug: 'linea' },
  { key: 'zksync', name: 'zkSync Era', chainId: 324, symbol: 'ETH', brandColor: '#8C8DFC', logoSlug: 'zksync' },
  { key: 'scroll', name: 'Scroll', chainId: 534352, symbol: 'ETH', brandColor: '#E0C99E', logoSlug: 'scroll' },
  { key: 'metis', name: 'Metis', chainId: 1088, symbol: 'METIS', brandColor: '#00D3C5', logoSlug: 'metis-andromeda' },
  { key: 'celo', name: 'Celo', chainId: 42220, symbol: 'CELO', brandColor: '#35D07F', logoSlug: 'celo' },
  { key: 'moonbeam', name: 'Moonbeam', chainId: 1284, symbol: 'GLMR', brandColor: '#6E56C8', logoSlug: 'moonbeam' },
  { key: 'mode', name: 'Mode', chainId: 34443, symbol: 'ETH', brandColor: '#D4FF00', logoSlug: 'mode' },
  { key: 'unichain', name: 'Uniswap Chain', chainId: 84532, symbol: 'ETH', brandColor: '#FF007A', logoSlug: 'unichain' },
  { key: 'xlayer', name: 'X Layer', chainId: 196, symbol: 'OKX', brandColor: '#1A1A1A', logoSlug: 'x-layer' },
  { key: 'boba', name: 'Boba', chainId: 288, symbol: 'ETH', brandColor: '#00B386', logoSlug: 'boba' },
  { key: 'zora', name: 'Zora', chainId: 7777777, symbol: 'ETH', brandColor: '#000000', logoSlug: 'zora' },
  { key: 'blast', name: 'Blast', chainId: 81457, symbol: 'ETH', brandColor: '#FCFC03', logoSlug: 'blast' },
  { key: 'flowevm', name: 'Flow EVM', chainId: 747, symbol: 'FLOW', brandColor: '#00EF8B', logoSlug: null },
  { key: 'kaia', name: 'Kaia', chainId: 8217, symbol: 'KAIA', brandColor: '#4C1F7A', logoSlug: 'kaia' },
  { key: 'opbnb', name: 'opBNB', chainId: 204, symbol: 'BNB', brandColor: '#F3BA2F', logoSlug: null },
  { key: 'cronos', name: 'Cronos', chainId: 25, symbol: 'CRO', brandColor: '#002D74', logoSlug: 'cronos' },
  { key: 'sonic', name: 'Sonic', chainId: 146, symbol: 'S', brandColor: '#29327C', logoSlug: 'sonic' },
  { key: 'mantle', name: 'Mantle', chainId: 5000, symbol: 'MNT', brandColor: '#65B3AE', logoSlug: 'mantle' },
  { key: 'zetachain', name: 'ZetaChain', chainId: 7000, symbol: 'ZETA', brandColor: '#5E6AD2', logoSlug: 'zeta-chain' },
  { key: 'astar', name: 'Astar', chainId: 592, symbol: 'ASTR', brandColor: '#00C48D', logoSlug: 'astar' },
  { key: 'shape', name: 'Shape', chainId: 360, symbol: 'ETH', brandColor: '#65B3AE', logoSlug: null },
  { key: 'worldchain', name: 'World Chain', chainId: 480, symbol: 'ETH', brandColor: '#1A1A1A', logoSlug: 'world' },
  { key: 'berachain', name: 'Berachain', chainId: 80084, symbol: 'BERA', brandColor: '#9D7B4B', logoSlug: 'berachain' },
  { key: 'rootstock', name: 'Rootstock', chainId: 30, symbol: 'RBTC', brandColor: '#00B366', logoSlug: 'rootstock' },
  { key: 'bob', name: 'BOB', chainId: 60808, symbol: 'ETH', brandColor: '#FFA500', logoSlug: 'bob' },
  { key: 'ink', name: 'Ink', chainId: 57073, symbol: 'ETH', brandColor: '#1A1A1A', logoSlug: 'ink' },
  { key: 'frax', name: 'Fraxtal', chainId: 252, symbol: 'FRAX', brandColor: '#000000', logoSlug: 'fraxtal' },
];

// Chains shown in the compact overview grid on the homepage.
export const OVERVIEW_CHAIN_KEYS = ['pulse', 'ethereum', 'polygon', 'base', 'arbitrum', 'optimism', 'bnb', 'avalanche'];

export function getChainMeta(key) {
  return EXPLORER_CHAINS.find((c) => c.key === key) || EXPLORER_CHAINS[0];
}