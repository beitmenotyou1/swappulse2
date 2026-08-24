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
  { key: 'worldchain', name: 'World Chain', symbol: 'WLD', type: 'evm', chainId: 480, rpcSecret: 'WORLDCHAIN_RPC_URL', explorer: 'https://worldchain-mainnet.explorer.alchemy.com' },
  { key: 'shape', name: 'Shape', symbol: 'SHP', type: 'evm', chainId: 360, rpcSecret: 'SHAPE_RPC_URL', explorer: 'https://shapescan.com' },
  { key: 'zksync', name: 'ZKsync', symbol: 'ZK', type: 'evm', chainId: 324, rpcSecret: 'ZKSYNC_RPC_URL', explorer: 'https://explorer.zksync.io' },
  { key: 'starknet', name: 'Starknet', symbol: 'STRK', type: 'other', rpcSecret: 'STARKNET_RPC_URL', explorer: 'https://starkscan.co' },
  { key: 'astar', name: 'Astar', symbol: 'ASTR', type: 'evm', chainId: 592, rpcSecret: 'ASTAR_RPC_URL', explorer: 'https://astar.blockscout.com' },
  { key: 'zetachain', name: 'ZetaChain', symbol: 'ZETA', type: 'evm', chainId: 7000, rpcSecret: 'ZETACHAIN_RPC_URL', explorer: 'https://explorer.zetachain.com' },
  { key: 'mantle', name: 'Mantle', symbol: 'MNT', type: 'evm', chainId: 5000, rpcSecret: 'MANTLE_RPC_URL', explorer: 'https://mantlescan.org' },
  { key: 'berachain', name: 'Berachain', symbol: 'BERA', type: 'evm', chainId: 80094, rpcSecret: 'BERACHAIN_RPC_URL', explorer: 'https://berascan.com' },
  { key: 'linea', name: 'Linea', symbol: 'LIN', type: 'evm', chainId: 59144, rpcSecret: 'LINEA_RPC_URL', explorer: 'https://lineascan.build' },
  { key: 'zora', name: 'Zora', symbol: 'ZORA', type: 'evm', chainId: 7777777, rpcSecret: 'ZORA_RPC_URL', explorer: 'https://explorer.zora.energy' },
  { key: 'ronin', name: 'Ronin', symbol: 'RON', type: 'evm', chainId: 2020, rpcSecret: 'RONIN_RPC_URL', explorer: 'https://app.roninchain.com' },
  { key: 'plasma', name: 'Plasma', symbol: 'PLSM', type: 'evm' },
  { key: 'mythos', name: 'Mythos', symbol: 'MYTH', type: 'evm' },
  { key: 'settlus', name: 'Settlus', symbol: 'SETT', type: 'evm' },
  { key: 'bob', name: 'BOB', symbol: 'BOB', type: 'evm', chainId: 60808, rpcSecret: 'BOB_RPC_URL', explorer: 'https://explorer.gobob.xyz' },
  { key: 'rootstock', name: 'Rootstock', symbol: 'RBTC', type: 'evm', chainId: 30, rpcSecret: 'ROOTSTOCK_RPC_URL', explorer: 'https://explorer.rsk.co' },
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
  { key: 'frax', name: 'Frax', symbol: 'FRAX', type: 'evm', rpcSecret: 'FRAX_RPC_URL', explorer: 'https://fraxscan.com' },
  { key: 'avalanche', name: 'Avalanche', symbol: 'AVAX', type: 'evm', chainId: 43114, rpcSecret: 'AVALANCHE_RPC_URL', explorer: 'https://snowtrace.io' },
  { key: 'ink', name: 'Ink', symbol: 'INK', type: 'evm', rpcSecret: 'INK_RPC_URL', explorer: 'https://explorer.inkonchain.com' },
  { key: 'gnosis', name: 'Gnosis', symbol: 'GNO', type: 'evm', chainId: 100, rpcSecret: 'GNOSIS_RPC_URL', explorer: 'https://gnosisscan.io' },
  { key: 'celestiabridge', name: 'CelestiaBridge', symbol: 'CEL', type: 'other' },
  { key: 'bnb-smart-chain', name: 'BNB Smart Chain', symbol: 'BNB', type: 'evm', chainId: 56, rpcSecret: 'BNB_SMART_CHAIN_RPC_URL', explorer: 'https://bscscan.com' },
  { key: 'boba', name: 'Boba', symbol: 'BOBA', type: 'evm', chainId: 288, rpcSecret: 'BOBA_RPC_URL', explorer: 'https://bobascan.com' },
  { key: 'x-layer', name: 'X Layer', symbol: 'OKX', type: 'evm', chainId: 196, rpcSecret: 'X_LAYER_RPC_URL', explorer: 'https://www.oklink.com/xlayer' },
  { key: 'unichain', name: 'Unichain', symbol: 'UNI', type: 'evm', chainId: 130, rpcSecret: 'UNICHAIN_RPC_URL', explorer: 'https://uniscan.xyz' },
  { key: 'superseed', name: 'Superseed', symbol: 'SEED', type: 'evm' },
  { key: 'rise', name: 'Rise', symbol: 'RISE', type: 'evm' },
  { key: 'monad', name: 'Monad', symbol: 'MON', type: 'evm' },
  { key: 'flow-evm', name: 'Flow EVM', symbol: 'FLOW', type: 'evm', chainId: 747, rpcSecret: 'FLOW_EVM_RPC_URL', explorer: 'https://evm.flowscan.io' },
  { key: 'blast', name: 'Blast', symbol: 'BLST', type: 'evm', chainId: 81457, rpcSecret: 'BLAST_RPC_URL', explorer: 'https://blastscan.io' },
  { key: 'worldmobile', name: 'Worldmobile', symbol: 'WMOB', type: 'evm' },
  { key: 'injective', name: 'Injective', symbol: 'INJ', type: 'other', rpcSecret: 'INJECTIVE_RPC_URL', explorer: 'https://explorer.injective.network' },
  { key: 'alpen', name: 'Alpen', symbol: 'ALPN', type: 'evm' },
  { key: 'tron', name: 'Tron', symbol: 'TRX', type: 'evm', chainId: 728126428, rpcSecret: 'TRON_RPC_URL', explorer: 'https://tronscan.org' },
  { key: 'jovay', name: 'Jovay', symbol: 'JOV', type: 'evm' },
  { key: 'pharos', name: 'Pharos', symbol: 'PHR', type: 'evm' },
  { key: 'mode', name: 'Mode', symbol: 'MODE', type: 'evm', chainId: 34443, rpcSecret: 'MODE_RPC_URL', explorer: 'https://explorer.mode.network' },
  { key: 'edge', name: 'Edge', symbol: 'EDGE', type: 'evm' },
  { key: 'litecoin', name: 'Litecoin', symbol: 'LTC', type: 'bitcoin', rpcSecret: 'LITECOIN_RPC_URL', explorer: 'https://blockchair.com/litecoin' },
  { key: 'moonbeam', name: 'Moonbeam', symbol: 'GLMR', type: 'evm', chainId: 1284, rpcSecret: 'MOONBEAM_RPC_URL', explorer: 'https://moonbeam.moonscan.io' },
  { key: 'apechain', name: 'ApeChain', symbol: 'APE', type: 'evm', rpcSecret: 'APECHAIN_RPC_URL', explorer: 'https://apescan.io' },
  { key: 'celo', name: 'Celo', symbol: 'CELO', type: 'evm', chainId: 42220, rpcSecret: 'CELO_RPC_URL', explorer: 'https://celoscan.io' },
  { key: 'aptos', name: 'Aptos', symbol: 'APT', type: 'other', rpcSecret: 'APTOS_RPC_URL', explorer: 'https://aptoscan.com' },
  { key: 'anime', name: 'Anime', symbol: 'ANM', type: 'evm' },
  { key: 'metis', name: 'Metis', symbol: 'METIS', type: 'evm', chainId: 1088, rpcSecret: 'METIS_RPC_URL', explorer: 'https://andromeda-explorer.metis.io' },
  { key: 'sonic', name: 'Sonic', symbol: 'S', type: 'evm', chainId: 146, rpcSecret: 'SONIC_RPC_URL', explorer: 'https://sonicscan.org' },
  { key: 'sei', name: 'Sei', symbol: 'SEI', type: 'other', rpcSecret: 'SEI_RPC_URL', explorer: 'https://seitrace.com' },
  { key: 'cronos', name: 'Cronos', symbol: 'CRO', type: 'evm', chainId: 25, rpcSecret: 'CRONOS_RPC_URL', explorer: 'https://cronoscan.com' },
  { key: 'xmtp', name: 'XMTP', symbol: 'XMTP', type: 'other' },
  { key: 'adi', name: 'ADI', symbol: 'ADI', type: 'evm' },
  { key: 'scroll', name: 'Scroll', symbol: 'SCR', type: 'evm', chainId: 534352, rpcSecret: 'SCROLL_RPC_URL', explorer: 'https://scrollscan.com' },
  { key: 'opbnb', name: 'opBNB', symbol: 'BNB', type: 'evm', chainId: 204, rpcSecret: 'OPBNB_RPC_URL', explorer: 'https://opbnb.bscscan.com' },
  { key: 'crossfi', name: 'CrossFi', symbol: 'XFI', type: 'evm' },
  { key: 'soneium', name: 'Soneium', symbol: 'SON', type: 'evm', rpcSecret: 'SONEIUM_RPC_URL', explorer: 'https://soneium.blockscout.com' },
  { key: 'abstract', name: 'Abstract', symbol: 'ABS', type: 'evm' },
  { key: 'stable', name: 'Stable', symbol: 'STBL', type: 'evm' },

  // --- Non-EVM chains ---
  { key: 'bitcoin-cash', name: 'Bitcoin Cash', symbol: 'BCH', type: 'bitcoin', rpcSecret: 'BITCOIN_CASH_RPC_URL', explorer: 'https://blockchair.com/bitcoin-cash' },
  { key: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', type: 'bitcoin', rpcSecret: 'DOGECOIN_RPC_URL', explorer: 'https://blockchair.com/dogecoin' },
  { key: 'stellar', name: 'Stellar', symbol: 'XLM', type: 'other', rpcSecret: 'STELLAR_RPC_URL', explorer: 'https://stellar.expert' },
  { key: 'sui', name: 'Sui', symbol: 'SUI', type: 'other', rpcSecret: 'SUI_RPC_URL', explorer: 'https://suiscan.xyz' },
  { key: 'kaia', name: 'Kaia', symbol: 'KAIA', type: 'evm', chainId: 8217, rpcSecret: 'KAIA_RPC_URL', explorer: 'https://kaiascope.com' },
];

export const EVM_CHAINS = CHAINS.filter(c => c.type === 'evm');
export const NON_EVM_CHAINS = CHAINS.filter(c => c.type !== 'evm');

export function getChain(key) {
  return CHAINS.find(c => c.key === key);
}

export function isMintingChain(key) {
  return key === MINTING_CHAIN;
}