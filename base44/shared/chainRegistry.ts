// Registry of all supported EVM blockchains for the multi-chain explorer.
// Each chain maps to its RPC URL secret name, chain ID, native token symbol,
// and external explorer URL. PulseChain is the main/default chain (isMain: true).
// Non-EVM chains (Bitcoin, Solana, etc.) are not included — they need different
// RPC APIs and can be added in a future iteration.

import { secrets } from 'base44:runtime';

export interface ChainConfig {
  key: string;
  name: string;
  chainId: number;
  symbol: string;       // native token symbol (PLS, ETH, BNB, etc.)
  rpcSecret: string;    // name of the secret holding the RPC URL
  explorerUrl: string;  // external block explorer
  isMain?: boolean;     // true for PulseChain (default chain)
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
  // --- Main chain ---
  { key: 'pulse', name: 'PulseChain', chainId: 369, symbol: 'PLS', rpcSecret: 'PULSE_RPC_URL', explorerUrl: 'https://otter.pulsechain.com', isMain: true },

  // --- Major EVM chains ---
  { key: 'ethereum', name: 'Ethereum', chainId: 1, symbol: 'ETH', rpcSecret: 'ETHEREUM_RPC_URL', explorerUrl: 'https://etherscan.io' },
  { key: 'polygon', name: 'Polygon', chainId: 137, symbol: 'POL', rpcSecret: 'POLYGON_RPC_URL', explorerUrl: 'https://polygonscan.com' },
  { key: 'base', name: 'Base', chainId: 8453, symbol: 'ETH', rpcSecret: 'BASE_RPC_URL', explorerUrl: 'https://basescan.org' },
  { key: 'arbitrum', name: 'Arbitrum One', chainId: 42161, symbol: 'ETH', rpcSecret: 'ARBITRUM_RPC_URL', explorerUrl: 'https://arbiscan.io' },
  { key: 'optimism', name: 'Optimism', chainId: 10, symbol: 'ETH', rpcSecret: 'OPTIMISM_RPC_URL', explorerUrl: 'https://optimistic.etherscan.io' },
  { key: 'bnb', name: 'BNB Smart Chain', chainId: 56, symbol: 'BNB', rpcSecret: 'BNB_SMART_CHAIN_RPC_URL', explorerUrl: 'https://bscscan.com' },
  { key: 'avalanche', name: 'Avalanche C-Chain', chainId: 43114, symbol: 'AVAX', rpcSecret: 'AVALANCHE_RPC_URL', explorerUrl: 'https://snowtrace.io' },

  // --- Additional EVM chains ---
  { key: 'gnosis', name: 'Gnosis', chainId: 100, symbol: 'xDAI', rpcSecret: 'GNOSIS_RPC_URL', explorerUrl: 'https://gnosisscan.io' },
  { key: 'linea', name: 'Linea', chainId: 59144, symbol: 'ETH', rpcSecret: 'LINEA_RPC_URL', explorerUrl: 'https://lineascan.build' },
  { key: 'zksync', name: 'zkSync Era', chainId: 324, symbol: 'ETH', rpcSecret: 'ZKSYNC_RPC_URL', explorerUrl: 'https://explorer.zksync.io' },
  { key: 'scroll', name: 'Scroll', chainId: 534352, symbol: 'ETH', rpcSecret: 'SCROLL_RPC_URL', explorerUrl: 'https://scrollscan.com' },
  { key: 'metis', name: 'Metis Andromeda', chainId: 1088, symbol: 'METIS', rpcSecret: 'METIS_RPC_URL', explorerUrl: 'https://andromeda-explorer.metis.io' },
  { key: 'celo', name: 'Celo', chainId: 42220, symbol: 'CELO', rpcSecret: 'CELO_RPC_URL', explorerUrl: 'https://celoscan.io' },
  { key: 'moonbeam', name: 'Moonbeam', chainId: 1284, symbol: 'GLMR', rpcSecret: 'MOONBEAM_RPC_URL', explorerUrl: 'https://moonbeam.moonscan.io' },
  { key: 'mode', name: 'Mode', chainId: 34443, symbol: 'ETH', rpcSecret: 'MODE_RPC_URL', explorerUrl: 'https://explorer.mode.network' },
  { key: 'unichain', name: 'Uniswap Chain', chainId: 84532, symbol: 'ETH', rpcSecret: 'UNICHAIN_RPC_URL', explorerUrl: 'https://unichain.blockscout.com' },
  { key: 'xlayer', name: 'X Layer', chainId: 196, symbol: 'OKX', rpcSecret: 'X_LAYER_RPC_URL', explorerUrl: 'https://www.oklink.com/x-layer' },
  { key: 'boba', name: 'Boba Network', chainId: 288, symbol: 'ETH', rpcSecret: 'BOBA_RPC_URL', explorerUrl: 'https://bobascan.com' },
  { key: 'zora', name: 'Zora', chainId: 7777777, symbol: 'ETH', rpcSecret: 'ZORA_RPC_URL', explorerUrl: 'https://explorer.zora.energy' },
  { key: 'blast', name: 'Blast', chainId: 81457, symbol: 'ETH', rpcSecret: 'BLAST_RPC_URL', explorerUrl: 'https://blastscan.io' },
  { key: 'flowevm', name: 'Flow EVM', chainId: 747, symbol: 'FLOW', rpcSecret: 'FLOW_EVM_RPC_URL', explorerUrl: 'https://evm.flowscan.io' },
  { key: 'kaia', name: 'Kaia', chainId: 8217, symbol: 'KAIA', rpcSecret: 'KAIA_RPC_URL', explorerUrl: 'https://kaiascope.com' },
  { key: 'opbnb', name: 'opBNB', chainId: 204, symbol: 'BNB', rpcSecret: 'OPBNB_RPC_URL', explorerUrl: 'https://opbnb.bscscan.com' },
  { key: 'cronos', name: 'Cronos', chainId: 25, symbol: 'CRO', rpcSecret: 'CRONOS_RPC_URL', explorerUrl: 'https://cronoscan.com' },
  { key: 'sonic', name: 'Sonic', chainId: 146, symbol: 'S', rpcSecret: 'SONIC_RPC_URL', explorerUrl: 'https://sonicscan.org' },
  { key: 'mantle', name: 'Mantle', chainId: 5000, symbol: 'MNT', rpcSecret: 'MANTLE_RPC_URL', explorerUrl: 'https://mantlescan.info' },
  { key: 'zetachain', name: 'ZetaChain', chainId: 7000, symbol: 'ZETA', rpcSecret: 'ZETACHAIN_RPC_URL', explorerUrl: 'https://explorer.zetachain.com' },
  { key: 'astar', name: 'Astar', chainId: 592, symbol: 'ASTR', rpcSecret: 'ASTAR_RPC_URL', explorerUrl: 'https://astar.zkevm.explorer.startale.com' },
  { key: 'shape', name: 'Shape', chainId: 360, symbol: 'ETH', rpcSecret: 'SHAPE_RPC_URL', explorerUrl: 'https://shapescan.xyz' },
  { key: 'worldchain', name: 'World Chain', chainId: 480, symbol: 'ETH', rpcSecret: 'WORLDCHAIN_RPC_URL', explorerUrl: 'https://worldchain.org' },
  { key: 'berachain', name: 'Berachain', chainId: 80084, symbol: 'BERA', rpcSecret: 'BERACHAIN_RPC_URL', explorerUrl: 'https://berascan.com' },
  { key: 'rootstock', name: 'Rootstock', chainId: 30, symbol: 'RBTC', rpcSecret: 'ROOTSTOCK_RPC_URL', explorerUrl: 'https://explorer.rsk.co' },
  { key: 'bob', name: 'BOB', chainId: 60808, symbol: 'ETH', rpcSecret: 'BOB_RPC_URL', explorerUrl: 'https://explorer.gobob.xyz' },
  { key: 'ink', name: 'Ink', chainId: 57073, symbol: 'ETH', rpcSecret: 'INK_RPC_URL', explorerUrl: 'https://explorer.inkonchain.com' },
  { key: 'frax', name: 'Fraxtal', chainId: 252, symbol: 'FRAX', rpcSecret: 'FRAX_RPC_URL', explorerUrl: 'https://fraxscan.com' },
];

// Quick lookup by key.
const CHAIN_MAP = new Map(SUPPORTED_CHAINS.map((c) => [c.key, c]));

export function getChain(key: string): ChainConfig | undefined {
  return CHAIN_MAP.get(key);
}

export function getMainChain(): ChainConfig {
  return SUPPORTED_CHAINS.find((c) => c.isMain) || SUPPORTED_CHAINS[0];
}

// Get the RPC URL for a chain from secrets.
export function getChainRpcUrl(chainKey: string): string {
  const chain = getChain(chainKey);
  if (!chain) throw new Error(`Unknown chain: ${chainKey}`);
  const url = secrets.get(chain.rpcSecret);
  if (!url) throw new Error(`RPC URL secret not set for chain ${chain.name}: ${chain.rpcSecret}`);
  return url;
}

// Chains to show in the compact overview (top chains by relevance).
export const OVERVIEW_CHAINS = SUPPORTED_CHAINS.filter((c) =>
  ['pulse', 'ethereum', 'polygon', 'base', 'arbitrum', 'optimism', 'bnb', 'avalanche'].includes(c.key)
);