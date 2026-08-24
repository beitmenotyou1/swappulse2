import React, { useState, useMemo } from 'react';
import { Copy, Check, QrCode, ChevronDown, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { getChain } from '@/lib/chainRegistry';

// MetaMask-style chain asset list: one row per blockchain showing the native
// coin balance, the wallet address, and copy/QR action buttons. Rows are
// sorted by fiat-converted balance descending; zero-balance chains are sorted
// alphabetically after non-zero ones. Paginated 10 at a time with a "Show
// more" button.
export default function ChainAssetList({ chainBalances = [], formatFiat, cryptoPrices }) {
  const { toast } = useToast();
  const [visibleCount, setVisibleCount] = useState(10);
  const [copiedChain, setCopiedChain] = useState(null);

  // Sort: non-zero balances first (descending), then zero balances alphabetically
  const sortedChains = useMemo(() => {
    const withValue = [];
    const zeroValue = [];

    for (const cb of chainBalances) {
      const chainDef = getChain(cb.chain);
      const balanceNum = parseFloat(cb.balance || '0');
      // Convert native balance to approximate USD for sorting
      const usdValue = estimateUsdValue(cb, chainDef, cryptoPrices);
      const entry = { ...cb, chainDef, balanceNum, usdValue };
      if (balanceNum > 0) {
        withValue.push(entry);
      } else {
        zeroValue.push(entry);
      }
    }

    withValue.sort((a, b) => b.usdValue - a.usdValue);
    zeroValue.sort((a, b) => (a.chainDef?.name || a.chain).localeCompare(b.chainDef?.name || b.chain));

    return [...withValue, ...zeroValue];
  }, [chainBalances, cryptoPrices]);

  const visible = sortedChains.slice(0, visibleCount);
  const hasMore = visibleCount < sortedChains.length;

  const copyAddress = (chain, address) => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopiedChain(chain);
    toast({ title: `${chain} address copied!` });
    setTimeout(() => setCopiedChain(null), 2000);
  };

  if (chainBalances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Wallet className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-semibold text-muted-foreground">No wallet addresses found</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Create a wallet in Settings → Wallet to enable multi-chain balances.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y divide-border rounded-2xl border border-border bg-card shadow-raised">
        {visible.map((cb) => {
          const chainDef = cb.chainDef;
          const symbol = chainDef?.symbol || cb.symbol || '';
          const name = chainDef?.name || cb.name || cb.chain;
          const address = cb.address;
          const truncated = address
            ? `${address.slice(0, 6)}…${address.slice(-4)}`
            : '—';
          const hasBalance = cb.balanceNum > 0;

          return (
            <div key={cb.chain} className="flex items-center gap-3 p-4">
              {/* Chain icon — symbol in a colored circle */}
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-xs font-bold text-primary">
                {symbol.slice(0, 3)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold">{name}</p>
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {symbol}
                  </span>
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">{truncated}</p>
              </div>

              <div className="text-right">
                <p className={`text-sm font-bold ${hasBalance ? '' : 'text-muted-foreground'}`}>
                  {formatNativeBalance(cb.balanceNum, chainDef)}
                </p>
                {hasBalance && cb.usdValue > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ≈{formatFiat ? formatFiat(cb.usdValue * 100, 'USD') : `$${cb.usdValue.toFixed(2)}`}
                  </p>
                )}
              </div>

              {/* Copy + QR buttons */}
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => copyAddress(cb.chain, address)}
                  disabled={!address}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-primary disabled:opacity-30"
                  title="Copy address"
                >
                  {copiedChain === cb.chain ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </button>
                <Link
                  to={`/wallet/receive?chain=${cb.chain}`}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-primary"
                  title="Show QR code"
                >
                  <QrCode className="h-4 w-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setVisibleCount((c) => c + 10)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-muted-foreground transition hover:border-primary/30 hover:text-primary"
        >
          <ChevronDown className="h-4 w-4" />
          Show more ({sortedChains.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
}

// Estimate USD value of a native balance for sorting purposes.
function estimateUsdValue(cb, chainDef, cryptoPrices) {
  const balanceNum = parseFloat(cb.balance || '0');
  if (!balanceNum) return 0;
  // For EVM chains, balance is in wei (18 decimals)
  if (cb.type === 'evm') {
    const coins = balanceNum / 1e18;
    // Use crypto prices if available, otherwise rough estimates
    const pricePerCoin = cryptoPrices?.[chainDef?.key]?.usd || 0;
    return coins * pricePerCoin;
  }
  // For Solana, balance is in lamports (9 decimals)
  if (cb.type === 'solana') {
    const sol = balanceNum / 1e9;
    const solPrice = cryptoPrices?.solana?.usd || 0;
    return sol * solPrice;
  }
  // For Bitcoin, balance is in satoshis (8 decimals) — but we return 0 for now
  return 0;
}

function formatNativeBalance(balanceNum, chainDef) {
  if (!balanceNum || balanceNum <= 0) return '0';
  const type = chainDef?.type;
  if (type === 'evm') {
    const coins = balanceNum / 1e18;
    return coins.toLocaleString('en-US', { maximumFractionDigits: 6 });
  }
  if (type === 'solana') {
    const sol = balanceNum / 1e9;
    return sol.toLocaleString('en-US', { maximumFractionDigits: 6 });
  }
  return balanceNum.toString();
}