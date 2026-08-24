// Backend chain definitions for SwapPulse.
// The frontend src/lib/chainRegistry.js is the full UI-facing registry;
// this is the minimal backend source of truth for balance lookups and
// address resolution. Only chains with rpcSecret can have their native
// balance queried on-chain.

export interface ChainDef {
  key: string;
  name: string;
  symbol: string;
  type: 'evm' | 'solana' | 'bitcoin' | 'other';
  rpcSecret?: string;
}

export const CHAINS: ChainDef[] = [
  // Core chains
  { key: 'polygon', name: 'Polygon', symbol: 'POL', type: 'evm', rpcSecret: 'POLYGON_RPC_URL' },
  { key: 'ethereum', name: 'Ethereum', symbol: 'ETH', type: 'evm', rpcSecret: 'ETHEREUM_RPC_URL' },
  { key: 'arbitrum', name: 'Arbitrum', symbol: 'ARB', type: 'evm', rpcSecret: 'ARBITRUM_RPC_URL' },
  { key: 'optimism', name: 'OP Mainnet', symbol: 'OP', type: 'evm', rpcSecret: 'OPTIMISM_RPC_URL' },
  { key: 'base', name: 'Base', symbol: 'BASE', type: 'evm', rpcSecret: 'BASE_RPC_URL' },
  { key: 'solana', name: 'Solana', symbol: 'SOL', type: 'solana', rpcSecret: 'SOLANA_RPC_URL' },
  { key: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', type: 'bitcoin', rpcSecret: 'BITCOIN_RPC_URL' },

  // EVM L2s and alt-chains
  { key: 'worldchain', name: 'World Chain', symbol: 'WLD', type: 'evm', rpcSecret: 'WORLDCHAIN_RPC_URL' },
  { key: 'shape', name: 'Shape', symbol: 'SHP', type: 'evm', rpcSecret: 'SHAPE_RPC_URL' },
  { key: 'zksync', name: 'ZKsync', symbol: 'ZK', type: 'evm', rpcSecret: 'ZKSYNC_RPC_URL' },
  { key: 'starknet', name: 'Starknet', symbol: 'STRK', type: 'other', rpcSecret: 'STARKNET_RPC_URL' },
  { key: 'astar', name: 'Astar', symbol: 'ASTR', type: 'evm', rpcSecret: 'ASTAR_RPC_URL' },
  { key: 'zetachain', name: 'ZetaChain', symbol: 'ZETA', type: 'evm', rpcSecret: 'ZETACHAIN_RPC_URL' },
  { key: 'mantle', name: 'Mantle', symbol: 'MNT', type: 'evm', rpcSecret: 'MANTLE_RPC_URL' },
  { key: 'berachain', name: 'Berachain', symbol: 'BERA', type: 'evm', rpcSecret: 'BERACHAIN_RPC_URL' },
  { key: 'linea', name: 'Linea', symbol: 'LIN', type: 'evm', rpcSecret: 'LINEA_RPC_URL' },
  { key: 'zora', name: 'Zora', symbol: 'ZORA', type: 'evm', rpcSecret: 'ZORA_RPC_URL' },
  { key: 'ronin', name: 'Ronin', symbol: 'RON', type: 'evm', rpcSecret: 'RONIN_RPC_URL' },
  { key: 'bob', name: 'BOB', symbol: 'BOB', type: 'evm', rpcSecret: 'BOB_RPC_URL' },
  { key: 'rootstock', name: 'Rootstock', symbol: 'RBTC', type: 'evm', rpcSecret: 'ROOTSTOCK_RPC_URL' },
  { key: 'frax', name: 'Frax', symbol: 'FRAX', type: 'evm', rpcSecret: 'FRAX_RPC_URL' },
  { key: 'avalanche', name: 'Avalanche', symbol: 'AVAX', type: 'evm', rpcSecret: 'AVALANCHE_RPC_URL' },
  { key: 'ink', name: 'Ink', symbol: 'INK', type: 'evm', rpcSecret: 'INK_RPC_URL' },
  { key: 'gnosis', name: 'Gnosis', symbol: 'GNO', type: 'evm', rpcSecret: 'GNOSIS_RPC_URL' },
  { key: 'bnb-smart-chain', name: 'BNB Smart Chain', symbol: 'BNB', type: 'evm', rpcSecret: 'BNB_SMART_CHAIN_RPC_URL' },
  { key: 'boba', name: 'Boba', symbol: 'BOBA', type: 'evm', rpcSecret: 'BOBA_RPC_URL' },
  { key: 'x-layer', name: 'X Layer', symbol: 'OKX', type: 'evm', rpcSecret: 'X_LAYER_RPC_URL' },
  { key: 'unichain', name: 'Unichain', symbol: 'UNI', type: 'evm', rpcSecret: 'UNICHAIN_RPC_URL' },
  { key: 'flow-evm', name: 'Flow EVM', symbol: 'FLOW', type: 'evm', rpcSecret: 'FLOW_EVM_RPC_URL' },
  { key: 'blast', name: 'Blast', symbol: 'BLST', type: 'evm', rpcSecret: 'BLAST_RPC_URL' },
  { key: 'injective', name: 'Injective', symbol: 'INJ', type: 'other', rpcSecret: 'INJECTIVE_RPC_URL' },
  { key: 'tron', name: 'Tron', symbol: 'TRX', type: 'evm', rpcSecret: 'TRON_RPC_URL' },
  { key: 'mode', name: 'Mode', symbol: 'MODE', type: 'evm', rpcSecret: 'MODE_RPC_URL' },
  { key: 'litecoin', name: 'Litecoin', symbol: 'LTC', type: 'bitcoin', rpcSecret: 'LITECOIN_RPC_URL' },
  { key: 'moonbeam', name: 'Moonbeam', symbol: 'GLMR', type: 'evm', rpcSecret: 'MOONBEAM_RPC_URL' },
  { key: 'apechain', name: 'ApeChain', symbol: 'APE', type: 'evm', rpcSecret: 'APECHAIN_RPC_URL' },
  { key: 'celo', name: 'Celo', symbol: 'CELO', type: 'evm', rpcSecret: 'CELO_RPC_URL' },
  { key: 'aptos', name: 'Aptos', symbol: 'APT', type: 'other', rpcSecret: 'APTOS_RPC_URL' },
  { key: 'metis', name: 'Metis', symbol: 'METIS', type: 'evm', rpcSecret: 'METIS_RPC_URL' },
  { key: 'sonic', name: 'Sonic', symbol: 'S', type: 'evm', rpcSecret: 'SONIC_RPC_URL' },
  { key: 'sei', name: 'Sei', symbol: 'SEI', type: 'other', rpcSecret: 'SEI_RPC_URL' },
  { key: 'cronos', name: 'Cronos', symbol: 'CRO', type: 'evm', rpcSecret: 'CRONOS_RPC_URL' },
  { key: 'scroll', name: 'Scroll', symbol: 'SCR', type: 'evm', rpcSecret: 'SCROLL_RPC_URL' },
  { key: 'opbnb', name: 'opBNB', symbol: 'BNB', type: 'evm', rpcSecret: 'OPBNB_RPC_URL' },
  { key: 'soneium', name: 'Soneium', symbol: 'SON', type: 'evm', rpcSecret: 'SONEIUM_RPC_URL' },
  { key: 'kaia', name: 'Kaia', symbol: 'KAIA', type: 'evm', rpcSecret: 'KAIA_RPC_URL' },

  // Non-EVM chains
  { key: 'bitcoin-cash', name: 'Bitcoin Cash', symbol: 'BCH', type: 'bitcoin', rpcSecret: 'BITCOIN_CASH_RPC_URL' },
  { key: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', type: 'bitcoin', rpcSecret: 'DOGECOIN_RPC_URL' },
  { key: 'stellar', name: 'Stellar', symbol: 'XLM', type: 'other', rpcSecret: 'STELLAR_RPC_URL' },
  { key: 'sui', name: 'Sui', symbol: 'SUI', type: 'other', rpcSecret: 'SUI_RPC_URL' },

  // Display-only chains (no RPC configured yet)
  { key: 'robinhood', name: 'Robinhood Chain', symbol: 'RBH', type: 'evm' },
  { key: 'plasma', name: 'Plasma', symbol: 'PLSM', type: 'evm' },
  { key: 'mythos', name: 'Mythos', symbol: 'MYTH', type: 'evm' },
  { key: 'settlus', name: 'Settlus', symbol: 'SETT', type: 'evm' },
  { key: 'megaeth', name: 'MegaETH', symbol: 'MEGA', type: 'evm' },
  { key: 'katana', name: 'Katana', symbol: 'KAT', type: 'evm' },
  { key: 'citrea', name: 'Citrea', symbol: 'CITR', type: 'evm' },
  { key: 'gensyn', name: 'Gensyn', symbol: 'GEN', type: 'evm' },
  { key: 'arc', name: 'Arc', symbol: 'ARC', type: 'evm' },
  { key: 'data-network', name: 'DATA Network', symbol: 'DATA', type: 'evm' },
  { key: 'humanity', name: 'Humanity', symbol: 'HUM', type: 'evm' },
  { key: 'hyperliquid', name: 'Hyperliquid', symbol: 'HYPE', type: 'evm' },
  { key: 'tempo', name: 'Tempo', symbol: 'TMPO', type: 'evm' },
  { key: 'galactica', name: 'Galactica', symbol: 'GAL', type: 'evm' },
  { key: 'lens', name: 'Lens', symbol: 'LENS', type: 'evm' },
  { key: 'world-mobile-chain', name: 'World Mobile Chain', symbol: 'WMC', type: 'evm' },
  { key: 'celestiabridge', name: 'CelestiaBridge', symbol: 'CEL', type: 'other' },
  { key: 'superseed', name: 'Superseed', symbol: 'SEED', type: 'evm' },
  { key: 'rise', name: 'Rise', symbol: 'RISE', type: 'evm' },
  { key: 'monad', name: 'Monad', symbol: 'MON', type: 'evm' },
  { key: 'worldmobile', name: 'Worldmobile', symbol: 'WMOB', type: 'evm' },
  { key: 'alpen', name: 'Alpen', symbol: 'ALPN', type: 'evm' },
  { key: 'jovay', name: 'Jovay', symbol: 'JOV', type: 'evm' },
  { key: 'pharos', name: 'Pharos', symbol: 'PHR', type: 'evm' },
  { key: 'edge', name: 'Edge', symbol: 'EDGE', type: 'evm' },
  { key: 'anime', name: 'Anime', symbol: 'ANM', type: 'evm' },
  { key: 'xmtp', name: 'XMTP', symbol: 'XMTP', type: 'other' },
  { key: 'adi', name: 'ADI', symbol: 'ADI', type: 'evm' },
  { key: 'crossfi', name: 'CrossFi', symbol: 'XFI', type: 'evm' },
  { key: 'abstract', name: 'Abstract', symbol: 'ABS', type: 'evm' },
  { key: 'stable', name: 'Stable', symbol: 'STBL', type: 'evm' },
];

export function getChain(key: string): ChainDef | undefined {
  return CHAINS.find(c => c.key === key);
}

export function getChainType(key: string): string {
  return getChain(key)?.type || 'evm';
}

// Chains that have an RPC secret configured (balance-queryable)
export const QUERYABLE_CHAINS = CHAINS.filter(c => c.rpcSecret);