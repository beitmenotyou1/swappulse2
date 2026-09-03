import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, TestTube2 } from 'lucide-react';

function Meter({ label, used = 0, soft = 0, provider = 0, suffix = '' }) {
  const pct = soft > 0 ? Math.min(100, (used / soft) * 100) : 0;
  return (
    <div className="rounded-xl border border-border bg-secondary/35 p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground">{used}/{soft}{suffix}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Provider ceiling: {provider}{suffix}</p>
    </div>
  );
}

export default function ExternalApiBudgetSection({ pokewallet, priceTracker, onRefresh }) {
  const [testCardId, setTestCardId] = useState('swsh3-136');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const runPriceTrackerTest = async () => {
    const cardId = String(testCardId || '').trim();
    if (!cardId || testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke('pokemon-price-tracker-market', { cardId });
      const data = res?.data ?? res;
      setTestResult({ ok: true, data });
      await onRefresh?.();
    } catch (error) {
      setTestResult({ ok: false, error: error?.response?.data?.error || error?.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  if (!pokewallet && !priceTracker) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3">
        <h2 className="font-bold">External API budgets</h2>
        <p className="text-xs text-muted-foreground">SwapPulse stops before provider ceilings and serves cached/fallback data where safe.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {pokewallet && (
          <div className="space-y-2">
            <p className="text-xs font-bold">PokéWallet</p>
            <Meter label="Hour requests" used={pokewallet.hour?.used || 0} soft={pokewallet.hour?.softLimit || 0} provider={pokewallet.hour?.providerLimit || 0} />
            <Meter label="Day requests" used={pokewallet.day?.used || 0} soft={pokewallet.day?.softLimit || 0} provider={pokewallet.day?.providerLimit || 0} />
          </div>
        )}
        {priceTracker && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold">PokemonPriceTracker</p>
              <div className="flex flex-wrap gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priceTracker.policy?.configured ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                  {priceTracker.policy?.configured ? 'API key configured' : 'API key missing'}
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{priceTracker.policy?.plan || 'free'} · {priceTracker.policy?.publicUseAllowed ? 'public enabled' : 'admin/dev only'}</span>
              </div>
            </div>
            <Meter label="Minute calls" used={priceTracker.minute?.callsUsed || 0} soft={priceTracker.minute?.softCallLimit || 0} provider={priceTracker.minute?.providerCallLimit || 0} />
            <Meter label="Daily credits" used={priceTracker.day?.creditsUsed || 0} soft={priceTracker.day?.softCreditLimit || 0} provider={priceTracker.day?.providerCreditLimit || 0} suffix=" credits" />
            {priceTracker.day?.providerCreditsRemaining != null && <p className="text-[10px] text-muted-foreground">Provider-reported remaining credits: {priceTracker.day.providerCreditsRemaining}</p>}

            <div className="mt-3 rounded-xl border border-border bg-background/60 p-3">
              <div className="flex items-center gap-2">
                <TestTube2 className="h-4 w-4 text-primary" />
                <p className="text-xs font-bold">Admin credit/cache test</p>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Runs one deliberate card enrichment. On Free this is expected to cost up to 3 credits on the first uncached card and 0 extra credits on a repeat while the 24-hour cache is fresh.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  value={testCardId}
                  onChange={(e) => setTestCardId(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs"
                  aria-label="TCGDex card ID for PokemonPriceTracker test"
                />
                <Button size="sm" onClick={runPriceTrackerTest} disabled={testing || !priceTracker.policy?.configured}>
                  {testing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="mr-1.5 h-3.5 w-3.5" />}
                  Test once
                </Button>
              </div>
              {testResult && (
                <div className={`mt-3 rounded-lg px-3 py-2 text-[11px] ${testResult.ok ? 'bg-secondary/60 text-foreground' : 'bg-destructive/10 text-destructive'}`}>
                  {testResult.ok ? (
                    <>
                      <p className="font-semibold">
                        {testResult.data?.matched ? 'Matched' : `No match: ${testResult.data?.reason || 'unknown'}`}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {testResult.data?.freshness?.fromCache ? 'Served from cache' : 'Fresh provider request'}
                        {testResult.data?.freshness?.stale ? ' · stale fallback' : ''}
                        {testResult.data?.developmentPreview ? ' · admin development preview' : ''}
                      </p>
                    </>
                  ) : testResult.error}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
