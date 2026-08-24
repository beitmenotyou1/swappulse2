// Curated list of pre-approved dApps for the in-app browser.
// Each dApp can be opened in an iframe with the user's wallet address
// appended via urlBuilder for read-only viewing.
export const DAPP_CATALOG = [
  {
    id: 'opensea',
    name: 'OpenSea',
    description: 'Browse and view your NFT collection on the largest marketplace',
    logo: '🌊',
    category: 'NFT Marketplace',
    urlBuilder: (address) => `https://opensea.io/${address}`,
  },
  {
    id: 'magiceden',
    name: 'Magic Eden',
    description: 'View your Polygon NFT collection and explore listings',
    logo: '✨',
    category: 'NFT Marketplace',
    urlBuilder: (address) => `https://magiceden.io/collection/polygon/${address}`,
  },
  {
    id: 'rarible',
    name: 'Rarible',
    description: 'Explore and view your on-chain NFTs',
    logo: '🎨',
    category: 'NFT Marketplace',
    urlBuilder: (address) => `https://rarible.com/user/${address}`,
  },
  {
    id: 'polygonscan',
    name: 'PolygonScan',
    description: 'View your on-chain transactions, NFTs, and token holdings',
    logo: '🔍',
    category: 'Explorer',
    urlBuilder: (address) => `https://polygonscan.com/address/${address}`,
  },
  {
    id: 'okx',
    name: 'OKX NFT',
    description: 'Browse NFT collections and your holdings on OKX',
    logo: '🟢',
    category: 'NFT Marketplace',
    urlBuilder: (address) => `https://www.okx.com/web3/nft/wallet/${address}`,
  },
  {
    id: 'element',
    name: 'Element',
    description: 'Discover and view NFT collections across Polygon',
    logo: '🧩',
    category: 'NFT Marketplace',
    urlBuilder: (address) => `https://element.market/${address}`,
  },
];