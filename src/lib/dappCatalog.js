// Curated directory of pre-approved, legitimate crypto dApps for the in-app
// browser. Each dApp can be opened in an iframe. dApps with a `urlBuilder`
// append the user's wallet address for read-only portfolio viewing; dApps
// with only a `url` open their homepage.
//
// Categories:
//   - 'TCG'            — Tokenised trading-card platforms (Courtyard, etc.)
//   - 'NFT Marketplace' — Established NFT marketplaces
//   - 'DeFi'           — Trustworthy decentralised finance protocols
//   - 'Explorer'       — Block explorers for on-chain verification

export const DAPP_CATEGORIES = [
  { id: 'TCG', label: 'Crypto TCG', icon: '🃏' },
  { id: 'NFT Marketplace', label: 'NFT Marketplaces', icon: '🖼️' },
  { id: 'DeFi', label: 'DeFi', icon: '💱' },
  { id: 'Explorer', label: 'Explorers', icon: '🔍' },
];

export const DAPP_CATALOG = [
  // ── Crypto TCG / Tokenised Trading Cards ──────────────────────────
  {
    id: 'courtyard',
    name: 'Courtyard',
    description: 'Tokenised, vaulted Pokémon TCG cards on-chain. Buy, sell, and redeem physical cards.',
    logo: '🏛️',
    category: 'TCG',
    url: 'https://courtyard.io',
  },
  {
    id: 'collectr',
    name: 'Collector',
    description: 'Fractionalised ownership of graded Pokémon TCG slabs on the blockchain.',
    logo: '📊',
    category: 'TCG',
    url: 'https://www.collector.xyz/',
  },
  {
    id: 'treasure',
    name: 'Treasure',
    description: 'Decentralised gaming console and NFT marketplace for web3 game assets.',
    logo: '💎',
    category: 'TCG',
    url: 'https://treasure.lol',
  },
  {
    id: 'arena',
    name: 'Splinterlands',
    description: 'Blockchain-based digital trading card game on the Hive network.',
    logo: '⚔️',
    category: 'TCG',
    url: 'https://splinterlands.com',
  },
  {
    id: 'gods',
    name: 'Gods Unchained',
    description: 'Competitive web3 trading card game on the Immutable X network.',
    logo: '⚡',
    category: 'TCG',
    url: 'https://godsunchained.com',
  },

  // ── NFT Marketplaces ───────────────────────────────────────────────
  {
    id: 'opensea',
    name: 'OpenSea',
    description: 'The largest NFT marketplace — browse, buy, sell, and view your collection.',
    logo: '🌊',
    category: 'NFT Marketplace',
    urlBuilder: (address) => `https://opensea.io/${address}`,
  },
  {
    id: 'magiceden',
    name: 'Magic Eden',
    description: 'Multi-chain NFT marketplace with strong Polygon support.',
    logo: '✨',
    category: 'NFT Marketplace',
    urlBuilder: (address) => `https://magiceden.io/collection/polygon/${address}`,
  },
  {
    id: 'rarible',
    name: 'Rarible',
    description: 'Community-driven NFT marketplace with royalty enforcement.',
    logo: '🎨',
    category: 'NFT Marketplace',
    urlBuilder: (address) => `https://rarible.com/user/${address}`,
  },
  {
    id: 'blur',
    name: 'Blur',
    description: 'High-performance NFT aggregator and marketplace for pro traders.',
    logo: '🌀',
    category: 'NFT Marketplace',
    url: 'https://blur.io',
  },
  {
    id: 'okx',
    name: 'OKX NFT',
    description: 'Browse NFT collections and your holdings on OKX Web3.',
    logo: '🟢',
    category: 'NFT Marketplace',
    urlBuilder: (address) => `https://www.okx.com/web3/nft/wallet/${address}`,
  },
  {
    id: 'element',
    name: 'Element',
    description: 'Multi-chain NFT marketplace with aggregated listings.',
    logo: '🧩',
    category: 'NFT Marketplace',
    urlBuilder: (address) => `https://element.market/${address}`,
  },
  {
    id: 'treasuremarket',
    name: 'Treasure Marketplace',
    description: 'NFT marketplace for web3 gaming assets and metaverse items.',
    logo: '💎',
    category: 'NFT Marketplace',
    url: 'https://marketplace.treasure.lol',
  },

  // ── DeFi (Trustworthy Protocols) ───────────────────────────────────
  {
    id: 'uniswap',
    name: 'Uniswap',
    description: 'The leading decentralised exchange for ERC-20 token swaps.',
    logo: '🦄',
    category: 'DeFi',
    url: 'https://app.uniswap.org',
  },
  {
    id: 'aave',
    name: 'Aave',
    description: 'Decentralised lending and borrowing protocol — earn yield or borrow against crypto.',
    logo: '👻',
    category: 'DeFi',
    url: 'https://app.aave.com',
  },
  {
    id: 'curve',
    name: 'Curve',
    description: 'Low-slippage stablecoin and pegged-asset exchange.',
    logo: '📈',
    category: 'DeFi',
    url: 'https://curve.fi',
  },
  {
    id: 'oneinch',
    name: '1inch',
    description: 'DEX aggregator finding the best swap rates across all sources.',
    logo: '🦅',
    category: 'DeFi',
    url: 'https://1inch.io',
  },
  {
    id: 'compound',
    name: 'Compound',
    description: 'Decentralised money market for supplying and borrowing crypto assets.',
    logo: '🏦',
    category: 'DeFi',
    url: 'https://app.compound.finance',
  },
  {
    id: 'balancer',
    name: 'Balancer',
    description: 'Self-balancing liquidity pools and automated portfolio manager.',
    logo: '⚖️',
    category: 'DeFi',
    url: 'https://balancer.fi',
  },
  {
    id: 'lido',
    name: 'Lido',
    description: 'Liquid staking for Ethereum and other proof-of-stake assets.',
    logo: '🦢',
    category: 'DeFi',
    url: 'https://lido.fi',
  },

  // ── Block Explorers ────────────────────────────────────────────────
  {
    id: 'polygonscan',
    name: 'PolygonScan',
    description: 'View your on-chain transactions, NFTs, and token holdings on Polygon.',
    logo: '🔍',
    category: 'Explorer',
    urlBuilder: (address) => `https://polygonscan.com/address/${address}`,
  },
  {
    id: 'etherscan',
    name: 'Etherscan',
    description: 'Ethereum mainnet block explorer and transaction verifier.',
    logo: '🔷',
    category: 'Explorer',
    urlBuilder: (address) => `https://etherscan.io/address/${address}`,
  },
  {
    id: 'arbiscan',
    name: 'Arbiscan',
    description: 'Arbitrum One block explorer for L2 transactions.',
    logo: '🟦',
    category: 'Explorer',
    urlBuilder: (address) => `https://arbiscan.io/address/${address}`,
  },
  {
    id: 'basescan',
    name: 'Basescan',
    description: 'Base L2 block explorer for on-chain verification.',
    logo: '🔵',
    category: 'Explorer',
    urlBuilder: (address) => `https://basescan.org/address/${address}`,
  },
];