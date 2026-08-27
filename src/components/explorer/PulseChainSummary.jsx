import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, TrendingUp, Activity } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useT } from '@/lib/i18n/I18nProvider';
import { formatPls, formatNumber } from '@/lib/explorerFormat';

// PulseChain activity summary — two side-by-side metric cards showing
// on-chain PLS transfer volume and SwapPulse trade volume for the last
// 24h and 7d. Helps users gauge network activity at a glance.
export default function PulseChainSummary() {
  const t = useT();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions.invoke('pulse-trade-volume', {})
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    );
  }

  if (!data || data.error) return null;

  const pls24h = formatPls(data.pulsechain?.plsTransferVolume?.['24h'] || '0', 2);
  const pls7d = formatPls(data.pulsechain?.plsTransferVolume?.['7d'] || '0', 2);
  const plsTx24h = data.pulsechain?.plsTxCount?.['24h'] || 0;
  const plsTx7d = data.pulsechain?.plsTxCount?.['7d'] || 0;

  // SwapPulse trade volume is in USDC (6 decimals)
  const trade24hRaw = data.swapPulse?.tradeVolume?.['24h'] || '0';
  const trade7dRaw = data.swapPulse?.tradeVolume?.['7d'] || '0';
  const trade24h = formatUsdc(trade24hRaw);
  const trade7d = formatUsdc(trade7dRaw);
  const tradeCount24h = data.swapPulse?.tradeCount?.['24h'] || 0;
  const tradeCount7d = data.swapPulse?.tradeCount?.['7d'] || 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* PLS Transfer Volume */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-success/5 to-transparent p-4 shadow-base">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
            <Activity className="h-4 w-4 text-success" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-success">{t('explorer.plsTransferVolume')}</p>
            <p className="text-[10px] text-muted-foreground">{t('explorer.pulseChainNetwork')}</p>
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <p className="text-2xl font-bold tabular-nums text-foreground">{pls24h}</p>
          <span className="text-sm font-semibold text-muted-foreground">PLS</span>
          <span className="text-xs text-muted-foreground">{t('explorer.last24h')}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('explorer.last7d')}: <span className="font-mono font-semibold text-foreground">{pls7d} PLS</span></span>
          <span>{formatNumber(plsTx24h)} {t('explorer.stat.txs')}</span>
        </div>
      </div>

      {/* SwapPulse Trade Volume */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-4 shadow-base">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t('explorer.swapPulseTradeVolume')}</p>
            <p className="text-[10px] text-muted-foreground">{t('explorer.completedTrades')}</p>
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <p className="text-2xl font-bold tabular-nums text-foreground">{trade24h}</p>
          <span className="text-sm font-semibold text-muted-foreground">USDC</span>
          <span className="text-xs text-muted-foreground">{t('explorer.last24h')}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('explorer.last7d')}: <span className="font-mono font-semibold text-foreground">{trade7d} USDC</span></span>
          <span>{formatNumber(tradeCount24h)} {t('explorer.trades')}</span>
        </div>
      </div>
    </div>
  );
}

// Format USDC amount from base units (6 decimals) to a display string.
function formatUsdc(valueStr, displayDecimals = 2) {
  if (!valueStr || valueStr === '0') return '0';
  try {
    const value = BigInt(valueStr);
    const divisor = 10n ** 6n;
    const whole = value / divisor;
    const fraction = value % divisor;
    const fracStr = fraction.toString().padStart(6, '0').slice(0, displayDecimals).replace(/0+$/, '');
    return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
  } catch {
    return '0';
  }
}