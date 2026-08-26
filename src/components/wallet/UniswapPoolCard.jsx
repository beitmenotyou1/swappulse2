import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Droplets, Loader2, ExternalLink, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

// Shows the live state of the SwapPulse $PULSE/USDC Uniswap v4 pool on Polygon
// (position #134728). Reads on-chain via the get-uniswap-v4-pool-price backend
// function. Only renders for admins (the pool owner) — silently hides on 403.
// Auto-refreshes every 60 seconds.
export default function UniswapPoolCard() {
  const [pool, setPool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('get-uniswap-v4-pool-price', {});
      setPool(res.data);
      setError('');
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) { setHidden(true); return; }
      setError(e?.response?.data?.error || e?.message || 'Failed to load pool');
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

  if (loading && !pool) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading PULSE/USDC pool…
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

  if (!pool) return null;

  const driftPctRounded = (pool.driftPct * 100).toFixed(2);
  const pricePerPulse = pool.priceUsdcPerPulse.toPrecision(4);
  const pulsePerUsdc = pool.pricePulsePerUsdc.toLocaleString('en-US', { maximumFractionDigits: 1 });

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-bold">PULSE / USDC Pool</h3>
            <p className="text-[11px] text-muted-foreground">Uniswap v4 · Polygon · {pool.feeTierPct}% fee</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" title="Refresh">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-secondary/60 p-3">
          <p className="text-[11px] font-semibold text-muted-foreground">1 PULSE</p>
          <p className="text-lg font-bold">${pricePerPulse}</p>
          <p className="text-[10px] text-muted-foreground">target $0.001</p>
        </div>
        <div className="rounded-lg bg-secondary/60 p-3">
          <p className="text-[11px] font-semibold text-muted-foreground">1 USDC</p>
          <p className="text-lg font-bold">{pulsePerUsdc} PULSE</p>
          <p className="text-[10px] text-muted-foreground">target 1,000</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${pool.inRange ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
          {pool.inRange ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {pool.inRange ? 'In range' : 'Out of range'}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${pool.drifted ? 'bg-warning/15 text-warning' : 'bg-secondary text-muted-foreground'}`}>
          {driftPctRounded}% drift
        </span>
        <a
          href={pool.positionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
        >
          View position <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}