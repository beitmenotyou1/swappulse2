import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { DollarSign, Loader2, RefreshCw, ArrowUpRight, ExternalLink, TrendingUp, Fuel, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const FEE_SOURCE_LABELS = {
  topup: 'Top-up',
  send: 'Send',
  convert: 'Convert',
  escrow_purchase: 'Escrow Purchase',
  fiat_to_usdc: 'Fiat → USDC',
  usdc_to_fiat: 'USDC → Fiat',
  token_convert: 'Token Convert',
};

const FEE_SOURCE_COLORS = {
  topup: 'hsl(252 100% 64%)',
  send: 'hsl(217 91% 60%)',
  convert: 'hsl(45 96% 53%)',
  escrow_purchase: 'hsl(160 84% 39%)',
  fiat_to_usdc: 'hsl(258 90% 66%)',
  usdc_to_fiat: 'hsl(0 84% 60%)',
  token_convert: 'hsl(38 92% 50%)',
};

// Converts USDC wei (6 decimals) to a human-readable number
function weiToUsdc(wei) {
  if (!wei) return 0;
  const n = BigInt(wei);
  return Number(n / 10000n) / 100; // 6 decimals → 2 for display
}

function formatUsdc(n) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FeeRevenueSection() {
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [error, setError] = useState('');
  const [sweepResult, setSweepResult] = useState(null);
  const [polBalance, setPolBalance] = useState(null);
  const [usdcBalance, setUsdcBalance] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // FeeLedger is admin-readable; fetch most recent 200 records
      const list = await base44.entities.FeeLedger.list('-created_date', 200);
      setFees(list);
      // Fetch platform wallet balances (calls sweep-fees without force —
      // returns balances without triggering an actual sweep)
      try {
        const res = await base44.functions.invoke('sweep-fees', {});
        if (res.data?.platform_pol_wei !== undefined) {
          setPolBalance(res.data.platform_pol_wei);
          setUsdcBalance(res.data.platform_usdc_wei);
        }
      } catch {}
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load fee ledger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sweep = async () => {
    if (!window.confirm('Sweep all pending unswept fees to the platform fee wallet on Polygon? This will broadcast an on-chain transaction.')) return;
    setSweeping(true);
    setSweepResult(null);
    try {
      const res = await base44.functions.invoke('sweep-fees', { force: true });
      setSweepResult(res.data);
      if (res.data?.platform_pol_wei !== undefined) {
        setPolBalance(res.data.platform_pol_wei);
        setUsdcBalance(res.data.platform_usdc_wei);
      }
      await load();
    } catch (e) {
      setSweepResult({ error: e.response?.data?.error || e.message || 'Sweep failed' });
    } finally {
      setSweeping(false);
    }
  };

  // Aggregate stats
  const totalFeesWei = fees.reduce((sum, f) => sum + BigInt(f.fee_usdc_wei || '0'), 0n);
  const totalFeesUsdc = weiToUsdc(totalFeesWei.toString());

  const unsweptFeesWei = fees.filter(f => !f.swept).reduce((sum, f) => sum + BigInt(f.fee_usdc_wei || '0'), 0n);
  const unsweptFeesUsdc = weiToUsdc(unsweptFeesWei.toString());

  const sweptFeesUsdc = totalFeesUsdc - unsweptFeesUsdc;

  // Breakdown by source
  const bySource = {};
  fees.forEach(f => {
    const src = f.fee_source || 'unknown';
    if (!bySource[src]) bySource[src] = { source: src, count: 0, wei: 0n };
    bySource[src].count++;
    bySource[src].wei += BigInt(f.fee_usdc_wei || '0');
  });
  const sourceData = Object.values(bySource)
    .map(d => ({
      source: FEE_SOURCE_LABELS[d.source] || d.source,
      raw: d.source,
      count: d.count,
      usdc: weiToUsdc(d.wei.toString()),
    }))
    .sort((a, b) => b.usdc - a.usdc);

  const explorerUrl = 'https://polygonscan.com';

  // POL balance: 18 decimals. Warn when below 0.5 POL (not enough for gas).
  const polAmount = polBalance ? Number(BigInt(polBalance) / 1000000000000000n) / 1000 : null;
  const usdcAmount = usdcBalance ? Number(BigInt(usdcBalance) / 10000n) / 100 : null;
  const polLow = polAmount !== null && polAmount < 0.5;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-success" />
          <h3 className="font-bold">Fee Revenue Dashboard</h3>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <p className="mb-3 text-sm text-destructive">{error}</p>
      )}

      {/* Platform wallet gas monitor */}
      {polAmount !== null && (
        <div className={`mb-4 rounded-xl border p-4 ${polLow ? 'border-destructive/40 bg-destructive/10' : 'border-border bg-secondary'}`}>
          <div className="flex items-center gap-2">
            <Fuel className={`h-4 w-4 ${polLow ? 'text-destructive' : 'text-muted-foreground'}`} />
            <span className="text-xs font-semibold text-muted-foreground">PLATFORM WALLET GAS</span>
            {polLow && (
              <span className="ml-auto flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                <AlertTriangle className="h-3 w-3" /> LOW POL — TOP UP NEEDED
              </span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-4">
            <div>
              <span className="text-xl font-extrabold text-foreground">{polAmount.toFixed(3)}</span>
              <span className="ml-1 text-sm font-semibold text-muted-foreground">POL</span>
            </div>
            {usdcAmount !== null && (
              <div>
                <span className="text-xl font-extrabold text-foreground">{usdcAmount.toFixed(2)}</span>
                <span className="ml-1 text-sm font-semibold text-muted-foreground">USDC</span>
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {polLow
              ? 'The platform wallet needs POL for gas to sweep fees. Send POL to the platform wallet address to keep fee sweeps running.'
              : 'Gas for fee sweeps is paid from this wallet\'s POL balance. The 5-minute sweep auto-swaps POL→USDC when needed.'}
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-success/10 p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-success">
            <TrendingUp className="h-3.5 w-3.5" /> TOTAL COLLECTED
          </div>
          <p className="mt-1 text-2xl font-extrabold text-foreground">
            {formatUsdc(totalFeesUsdc)} <span className="text-sm font-semibold text-muted-foreground">USDC</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{fees.length} fee entries</p>
        </div>
        <div className="rounded-xl bg-secondary p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <ArrowUpRight className="h-3.5 w-3.5" /> SWEPT TO PLATFORM
          </div>
          <p className="mt-1 text-2xl font-extrabold text-foreground">
            {formatUsdc(sweptFeesUsdc)} <span className="text-sm font-semibold text-muted-foreground">USDC</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">On-chain in fee wallet</p>
        </div>
        <div className="rounded-xl bg-warning/10 p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-warning">
            <Loader2 className="h-3.5 w-3.5" /> PENDING SWEEP
          </div>
          <p className="mt-1 text-2xl font-extrabold text-foreground">
            {formatUsdc(unsweptFeesUsdc)} <span className="text-sm font-semibold text-muted-foreground">USDC</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fees.filter(f => !f.swept).length} entries awaiting sweep
          </p>
        </div>
      </div>

      {/* Sweep button */}
      {unsweptFeesUsdc > 0 && (
        <div className="mt-4">
          <button
            onClick={sweep}
            disabled={sweeping}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {sweeping ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
            {sweeping ? 'Sweeping…' : `Sweep ${formatUsdc(unsweptFeesUsdc)} USDC to fee wallet`}
          </button>
          {sweepResult?.tx_hash && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
              <span className="font-semibold">Swept successfully!</span>
              <a href={`${explorerUrl}/tx/${sweepResult.tx_hash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold hover:underline">
                View tx <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
          {sweepResult?.error && (
            <p className="mt-2 text-sm text-destructive">{sweepResult.error}</p>
          )}
        </div>
      )}

      {/* Chart */}
      {sourceData.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-2 text-sm font-bold text-muted-foreground">Revenue by source</h4>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="source" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--secondary))' }}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', fontSize: '12px' }}
                  formatter={(value) => [`${formatUsdc(value)} USDC`, 'Fees']}
                />
                <Bar dataKey="usdc" radius={[4, 4, 0, 0]}>
                  {sourceData.map((entry, i) => (
                    <Bar key={i} dataKey="usdc" fill={FEE_SOURCE_COLORS[entry.raw] || 'hsl(var(--primary))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent entries */}
      <div className="mt-5">
        <h4 className="mb-2 text-sm font-bold text-muted-foreground">Recent fee entries</h4>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : fees.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No fees collected yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Source</th>
                  <th className="py-2 pr-3 font-semibold">Amount (USDC)</th>
                  <th className="py-2 pr-3 font-semibold">Fee (USDC)</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 font-semibold">Tx</th>
                </tr>
              </thead>
              <tbody>
                {fees.slice(0, 15).map(f => (
                  <tr key={f.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-medium">{FEE_SOURCE_LABELS[f.fee_source] || f.fee_source}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {f.original_amount_wei ? formatUsdc(weiToUsdc(f.original_amount_wei)) : f.original_amount_cents ? `${(f.original_amount_cents / 100).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2 pr-3 font-semibold text-success">{formatUsdc(weiToUsdc(f.fee_usdc_wei))}</td>
                    <td className="py-2 pr-3">
                      {f.swept ? (
                        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">SWEPT</span>
                      ) : (
                        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">PENDING</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{f.created_at ? new Date(f.created_at).toLocaleDateString() : '—'}</td>
                    <td className="py-2">
                      {f.fee_tx_hash ? (
                        <a href={`${explorerUrl}/tx/${f.fee_tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}