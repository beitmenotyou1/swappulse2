import React from 'react';
import SettingSelect from '@/components/settings/SettingSelect';

const GROUPS = [
  {
    label: 'Stablecoins',
    options: [
      { symbol: 'usdcsol', name: 'USDC', network: 'Solana' },
      { symbol: 'usdceth', name: 'USDC', network: 'Ethereum' },
      { symbol: 'usdcmatic', name: 'USDC', network: 'Polygon' },
      { symbol: 'usdtsol', name: 'USDT', network: 'Solana' },
      { symbol: 'usdteth', name: 'USDT', network: 'Ethereum' },
      { symbol: 'usdtpolygon', name: 'USDT', network: 'Polygon' },
    ],
  },
  {
    label: 'Privacy coins',
    options: [
      { symbol: 'xmr', name: 'Monero', network: 'XMR' },
      { symbol: 'zec', name: 'Zcash', network: 'ZEC' },
      { symbol: 'dash', name: 'Dash', network: 'DASH' },
    ],
  },
  {
    label: 'Major coins',
    options: [
      { symbol: 'btc', name: 'Bitcoin', network: 'BTC' },
      { symbol: 'eth', name: 'Ethereum', network: 'ETH' },
      { symbol: 'sol', name: 'Solana', network: 'SOL' },
      { symbol: 'matic', name: 'Polygon', network: 'MATIC' },
    ],
  },
];

// Flattened options for SettingSelect (bottom-sheet picker has no optgroup support)
const OPTIONS = GROUPS.flatMap((g) => g.options.map((o) => ({
  value: o.symbol,
  label: `${o.name} (${o.network})`,
})));

export default function CryptoCurrencySelector({ value, onChange }) {
  return (
    <SettingSelect
      value={value}
      onChange={onChange}
      label="Cryptocurrency"
      options={OPTIONS}
    />
  );
}