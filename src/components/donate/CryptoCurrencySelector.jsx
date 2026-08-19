import React from 'react';

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

export default function CryptoCurrencySelector({ value, onChange }) {
  return (
    <select
      id="crypto-currency"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full cursor-pointer rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary"
    >
      {GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map((o) => (
            <option key={o.symbol} value={o.symbol}>{o.name} ({o.network})</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}