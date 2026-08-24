// Chain registry for SwapPulse wallet — lists all supported chains for
// trading and crypto. Minting of username and card NFTs is Polygon-only.
// EVM chains share the same EVM address from MultiChainWallet; Solana and
// Bitcoin have their own keypairs. Chains without configured RPC secrets
// are display-only (balances shown when available).

export const MINTING_CHAIN = 'polygon'; // Only Polygon supports NFT minting

export const CHAINS = [
  // --- Core chains (with configured RPC secrets) ---
  { key: 'polygon', name: 'Polygon', symbol: 'POL', type: 'evm', chainId: 137, rpcSecret: 'POLYGON_RPC_URL', explorer: 'https://polygonscan.com', minting: true },
  { key: 'ethereum', name: 'Ethereum', symbol: 'ETH', type: 'evm', chainId: 1, rpcSecret: 'ETHEREUM_RPC_URL', explorer: 'https://etherscan.io' },
  { key: 'arbitrum', name: 'Arbitrum', symbol: 'ARB', type: 'evm', chainId: 42161, rpcSecret: 'ARBITRUM_RPC_URL', explorer: 'https://arbiscan.io' },
  { key: 'optimism', name: 'OP Mainnet', symbol: 'OP', type: 'evm', chainId: 10, rpcSecret: 'OPTIMISM_RPC_URL', explorer: 'https://optimistic.etherscan.io' },
  { key: 'base', name: 'Base', symbol: 'BASE', type: 'evm', chainId: 8453, rpcSecret: 'BASE_RPC_URL', explorer: 'https://basescan.org' },
  { key: 'solana', name: 'Solana', symbol: 'SOL', type: 'solana', rpcSecret: 'SOLANA_RPC_URL', explorer: 'https://solscan.io' },
  { key: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', type: 'bitcoin', rpcSecret: 'BITCOIN_RPC_URL', explorer: 'https://blockchain.com' },

  // --- EVM L2s and alt-chains ---
  { key: 'robinhood', name: 'Robinhood Chain', symbol: 'RBH', type: 'evm', chainId: 73799 },
  { key: 'worldchain', name: 'World Chain', symbol: 'WLD', type: 'evm', chainId: 480 },
  { key: 'shape', name: 'Shape', symbol: 'SHP', type: 'evm', chainId: 360 },
  { key: 'zksync', name: 'ZKsync', symbol: 'ZK', type: 'evm', chainId: 324 },
  { key: 'starknet', name: 'Starknet', symbol: 'STRK', type: 'other' },
  { key: 'astar', name: 'Astar', symbol: 'ASTR', type: 'evm', chainId: 592 },
  { key: 'zetachain', name: 'ZetaChain', symbol: 'ZETA', type: 'evm', chainId: 7000 },
  { key: 'mantle', name: 'Mantle', symbol: 'MNT', type: 'evm', chainId: 5000 },
  { key: 'berachain', name: 'Berachain', symbol: 'BERA', type: 'evm', chainId: 80094 },
  { key: 'linea', name: 'Linea', symbol: 'LIN', type: 'evm', chainId: 59144 },
  { key: 'zora', name: 'Zora', symbol: 'ZORA', type: 'evm', chainId: 7777777 },
  { key: 'ronin', name: 'Ronin', symbol: 'RON', type: 'evm', chainId: 2020 },
  { key: 'plasma', name: 'Plasma', symbol: 'PLSM', type: 'evm' },
  { key: 'mythos', name: 'Mythos', symbol: 'MYTH', type: 'evm' },
  { key: 'settlus', name: 'Settlus', symbol: 'SETT', type: 'evm' },
  { key: 'bob', name: 'BOB', symbol: 'BOB', type: 'evm', chainId: 60808 },
  { key: 'rootstock', name: 'Rootstock', symbol: 'RBTC', type: 'evm', chainId: 30 },
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
  { key: 'frax', name: 'Frax', symbol: 'FRAX', type: 'evm' },
  { key: 'avalanche', name: 'Avalanche', symbol: 'AVAX', type: 'evm', chainId: 43114 },
  { key: 'ink', name: 'Ink', symbol: 'INK', type: 'evm' },
  { key: 'gnosis', name: 'Gnosis', symbol: 'GNO', type: 'evm', chainId: 100 },
  { key: 'celestiabridge', name: 'CelestiaBridge', symbol: 'CEL', type: 'other' },
  { key: 'bnb-smart-chain', name: 'BNB Smart Chain', symbol: 'BNB', type: 'evm', chainId: 56 },
  { key: 'boba', name: 'Boba', symbol: 'BOBA', type: 'evm', chainId: 288 },
  { key: 'x-layer', name: 'X Layer', symbol: 'OKX', type: 'evm', chainId: 196 },
  { key: 'unichain', name: 'Unichain', symbol: 'UNI', type: 'evm', chainId: 130 },
  { key: 'superseed', name: 'Superseed', symbol: 'SEED', type: 'evm' },
  { key: 'rise', name: 'Rise', symbol: 'RISE', type: 'evm' },
  { key: 'monad', name: 'Monad', symbol: 'MON', type: 'evm' },
  { key: 'flow-evm', name: 'Flow EVM', symbol: 'FLOW', type: 'evm', chainId: 747 },
  { key: 'blast', name: 'Blast', symbol: 'BLST', type: 'evm', chainId: 81457 },
  { key: 'worldmobile', name: 'Worldmobile', symbol: 'WMOB', type: 'evm' },
  { key: 'injective', name: 'Injective', symbol: 'INJ', type: 'other' },
  { key: 'alpen', name: 'Alpen', symbol: 'ALPN', type: 'evm' },
  { key: 'tron', name: 'Tron', symbol: 'TRX', type: 'evm', chainId: 728126428 },
  { key: 'jovay', name: 'Jovay', symbol: 'JOV', type: 'evm' },
  { key: 'pharos', name: 'Pharos', symbol: 'PHR', type: 'evm' },
  { key: 'mode', name: 'Mode', symbol: 'MODE', type: 'evm', chainId: 34443 },
  { key: 'edge', name: 'Edge', symbol: 'EDGE', type: 'evm' },
  { key: 'litecoin', name: 'Litecoin', symbol: 'LTC', type: 'bitcoin' },
  { key: 'moonbeam', name: 'Moonbeam', symbol: 'GLMR', type: 'evm', chainId: 1284 },
  { key: 'apechain', name: 'ApeChain', symbol: 'APE', type: 'evm' },
  { key: 'celo', name: 'Celo', symbol: 'CELO', type: 'evm', chainId: 42220 },
  { key: 'aptos', name: 'Aptos', symbol: 'APT', type: 'other' },
  { key: 'anime', name: 'Anime', symbol: 'ANM', type: 'evm' },
  { key: 'metis', name: 'Metis', symbol: 'METIS', type: 'evm', chainId: 1088 },
  { key: 'sonic', name: 'Sonic', symbol: 'S', type: 'evm', chainId: 146 },
  { key: 'sei', name: 'Sei', symbol: 'SEI', type: 'other' },
  { key: 'cronos', name: 'Cronos', symbol: 'CRO', type: 'evm', chainId: 25 },
  { key: 'xmtp', name: 'XMTP', symbol: 'XMTP', type: 'other' },
  { key: 'adi', name: 'ADI', symbol: 'ADI', type: 'evm' },
  { key: 'scroll', name: 'Scroll', symbol: 'SCR', type: 'evm', chainId: 534352 },
  { key: 'opbnb', name: 'opBNB', symbol: 'BNB', type: 'evm', chainId: 204 },
  { key: 'crossfi', name: 'CrossFi', symbol: 'XFI', type: 'evm' },
  { key: 'soneium', name: 'Soneium', symbol: 'SON', type: 'evm' },
  { key: 'abstract', name: 'Abstract', symbol: 'ABS', type: 'evm' },
  { key: 'stable', name: 'Stable', symbol: 'STBL', type: 'evm' },

  // --- Non-EVM chains ---
  { key: 'bitcoin-cash', name: 'Bitcoin Cash', symbol: 'BCH', type: 'bitcoin' },
  { key: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', type: 'bitcoin' },
  { key: 'stellar', name: 'Stellar', symbol: 'XLM', type: 'other' },
  { key: 'sui', name: 'Sui', symbol: 'SUI', type: 'other' },
  { key: 'kaia', name: 'Kaia', symbol: 'KAIA', type: 'evm', chainId: 8217 },
];

export const EVM_CHAINS = CHAINS.filter(c => c.type === 'evm');
export const NON_EVM_CHAINS = CHAINS.filter(c => c.type !== 'evm');

export function getChain(key) {
  return CHAINS.find(c => c.key === key);
}

export function isMintingChain(key) {
  return key === MINTING_CHAIN;
}