import React from 'react';
import {
  NetworkEthereum, NetworkPolygonPos, NetworkBase, NetworkArbitrumOne,
  NetworkOptimism, NetworkBinanceSmartChain, NetworkAvalanche, NetworkGnosis,
  NetworkLinea, NetworkZksync, NetworkScroll, NetworkMetisAndromeda,
  NetworkCelo, NetworkMoonbeam, NetworkMode, NetworkUnichain, NetworkXLayer,
  NetworkBoba, NetworkZora, NetworkBlast, NetworkKaia, NetworkCronos,
  NetworkSonic, NetworkMantle, NetworkZetaChain, NetworkAstar, NetworkRootstock,
  NetworkBob, NetworkFraxtal, NetworkWorld,
} from '@web3icons/react';
import { getChainMeta } from '@/lib/explorerChains';

// chainKey -> web3icons Network icon component. Chains not listed here
// (pulse, flowevm, opbnb, shape, berachain, ink) fall back to a branded
// circular letter-mark using the chain's brandColor.
const NETWORK_ICONS = {
  ethereum: NetworkEthereum,
  polygon: NetworkPolygonPos,
  base: NetworkBase,
  arbitrum: NetworkArbitrumOne,
  optimism: NetworkOptimism,
  bnb: NetworkBinanceSmartChain,
  avalanche: NetworkAvalanche,
  gnosis: NetworkGnosis,
  linea: NetworkLinea,
  zksync: NetworkZksync,
  scroll: NetworkScroll,
  metis: NetworkMetisAndromeda,
  celo: NetworkCelo,
  moonbeam: NetworkMoonbeam,
  mode: NetworkMode,
  unichain: NetworkUnichain,
  xlayer: NetworkXLayer,
  boba: NetworkBoba,
  zora: NetworkZora,
  blast: NetworkBlast,
  kaia: NetworkKaia,
  cronos: NetworkCronos,
  sonic: NetworkSonic,
  mantle: NetworkMantle,
  zetachain: NetworkZetaChain,
  astar: NetworkAstar,
  rootstock: NetworkRootstock,
  bob: NetworkBob,
  frax: NetworkFraxtal,
  worldchain: NetworkWorld,
};

// Pick black or white text for a given hex background for readable contrast.
function getContrastText(hex) {
  const c = (hex || '#64748b').replace('#', '');
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#1e293b' : '#ffffff';
}

// Renders a chain's network logo from the bundled @web3icons/react pack
// (local SVG, no external fetch — never breaks). For chains without a pack
// icon, renders a branded circular letter-mark in the chain's brand colour.
export default function ChainLogo({ chainKey, size = 20, className = '' }) {
  const meta = getChainMeta(chainKey);
  const Icon = NETWORK_ICONS[chainKey];

  if (Icon) {
    return <Icon variant="branded" size={size} className={className} role="img" aria-label={meta?.name} />;
  }

  const letter = (meta?.name || chainKey).charAt(0).toUpperCase();
  const bg = meta?.brandColor || '#64748b';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${className}`}
      style={{ width: size, height: size, backgroundColor: bg, color: getContrastText(bg), fontSize: size * 0.5 }}
      role="img"
      aria-label={meta?.name}
    >
      {letter}
    </span>
  );
}