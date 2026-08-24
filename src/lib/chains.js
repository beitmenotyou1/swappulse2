// Client-side chain definitions mirroring base44/shared/multiChain.ts.
// Used by the wallet UI for chain switcher, asset list, send/receive modals.

export const SUPPORTED_CHAINS = [
  { key: 'polygon', name: 'Polygon', nativeSymbol: 'POL', nativeDecimals: 18, type: 'evm', color: '#8247e5', usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
  { key: 'ethereum', name: 'Ethereum', nativeSymbol: 'ETH', nativeDecimals: 18, type: 'evm', color: '#627eea', usdcAddress: '0xA0b86991c6218b36c1D19d4a2e9Eb0cE3606eB48' },
  { key: 'arbitrum', name: 'Arbitrum', nativeSymbol: 'ETH', nativeDecimals: 18, type: 'evm', color: '#28a0f0', usdcAddress: '0xaf88d6f728e6841d8c5cdf3a55121a5b3c3a3a5d' },
  { key: 'optimism', name: 'Optimism', nativeSymbol: 'ETH', nativeDecimals: 18, type: 'evm', color: '#ff0420', usdcAddress: '0x0b2C639c633876a8f2c5Cdf3a55121a5b3c3a3a5d' },
  { key: 'base', name: 'Base', nativeSymbol: 'ETH', nativeDecimals: 18, type: 'evm', color: '#0052ff', usdcAddress: '0x833589fCD6eDb6E08f4c795C7d3a5a5a5a5a5a5a' },
  { key: 'solana', name: 'Solana', nativeSymbol: 'SOL', nativeDecimals: 9, type: 'solana', color: '#14f195' },
  { key: 'bitcoin', name: 'Bitcoin', nativeSymbol: 'BTC', nativeDecimals: 8, type: 'bitcoin', color: '#f7931a' },
];

export const EVM_CHAINS = SUPPORTED_CHAINS.filter((c) => c.type === 'evm');

export function getChain(key) {
  return SUPPORTED_CHAINS.find((c) => c.key === key);
}

export function formatNative(raw, decimals) {
  const value = Number(BigInt(raw || '0')) / Math.pow(10, decimals);
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
}