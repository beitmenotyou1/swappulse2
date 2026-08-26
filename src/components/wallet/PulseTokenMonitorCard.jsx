import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Coins, Loader2, ExternalLink, AlertTriangle, RefreshCw, Fish } from 'lucide-react';

// Shows live $PULSE ERC-20 token stats from Etherscan (holders, top holders,
// price) + on-chain RPC (supply, recent transfers, whale moves). Reads via the
// get-pulse-token-stats backend function. Admin-only — silently hides on 403.
// Auto-refreshes every 60 seconds.
export default function PulseTokenMonitorCard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('get-pulse-token-stats', {});
      setStats(res.data);
      setError('');
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) { setHidden(true); return; }
      setError(e?.response?.data?.error || e?.message || 'Failed to load token stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  if (hidden) return null;

  if (loading && !stats) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading $PULSE token stats…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const short = (addr) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';
  const fmtNum = (n, max = 0) =>
    n == null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: max });

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-bold">$PULSE Token</h3>
            <p className="text-[11px] text-muted-foreground">
              {stats.token.symbol} · Polygon
              {!stats.etherscanAvailable && ' · Etherscan PRO unavailable (showing on-chain data)'}
            </p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" title="Refresh">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total supply" value={fmtNum(Math.round(stats.humanSupply))} />
        <Stat label="Holders" value={fmtNum(stats.holderCount)} />
        <Stat label="Price" value={stats.priceUsd != null ? `$${stats.priceUsd}` : '—'} />
        <Stat label="Top-10 %" value={stats.top10ConcentrationPct != null ? `${stats.top10ConcentrationPct.toFixed(1)}%` : '—'} />
      </div>

      {stats.whaleCount > 0 && (
        <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-bold text-warning">
          <Fish className="h-3.5 w-3.5" />
          {stats.whaleCount} whale transfer{stats.whaleCount > 1 ? 's' : ''} (last hour)
        </div>
      )}

      {/* Top holders */}
      {stats.topHolders.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">Top holders</p>
          <div className="space-y-1">
            {stats.topHolders.slice(0, 5).map((h, i) => (
              <div key={h.address + i} className="flex items-center justify-between text-[11px]">
                <a
                  href={`https://polygonscan.com/address/${h.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-foreground hover:text-primary"
                >
                  {short(h.address)} <ExternalLink className="h-2.5 w-2.5" />
                </a>
                <span className="font-semibold">{h.pct.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent transfers */}
      {stats.recentTransfers.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">Recent transfers</p>
          <div className="space-y-1.5">
            {stats.recentTransfers.slice(0, 5).map((t) => (
              <div key={t.hash + t.blockNumber} className="flex items-center justify-between gap-2 text-[11px]">
                <a
                  href={`https://polygonscan.com/tx/${t.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 truncate font-mono text-foreground hover:text-primary"
                  title={`${short(t.from)} → ${short(t.to)}`}
                >
                  {short(t.from)} → {short(t.to)}
                </a>
                <span className={`shrink-0 font-semibold ${t.isWhale ? 'text-warning' : 'text-foreground'}`}>
                  {fmtNum(t.valueHuman, 0)} {stats.token.symbol}
                  {t.isWhale && ' 🐋'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 text-right">
        <a
          href={`https://polygonscan.com/token/${stats.token.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          View on PolygonScan <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-secondary/60 p-3">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}