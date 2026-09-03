import React from 'react';

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

export default function ExternalApiBudgetSection({ pokewallet, priceTracker }) {
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
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold">PokemonPriceTracker</p>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{priceTracker.policy?.plan || 'free'} · {priceTracker.policy?.publicUseAllowed ? 'public enabled' : 'admin/dev only'}</span>
            </div>
            <Meter label="Minute calls" used={priceTracker.minute?.callsUsed || 0} soft={priceTracker.minute?.softCallLimit || 0} provider={priceTracker.minute?.providerCallLimit || 0} />
            <Meter label="Daily credits" used={priceTracker.day?.creditsUsed || 0} soft={priceTracker.day?.softCreditLimit || 0} provider={priceTracker.day?.providerCreditLimit || 0} suffix=" credits" />
            {priceTracker.day?.providerCreditsRemaining != null && <p className="text-[10px] text-muted-foreground">Provider-reported remaining credits: {priceTracker.day.providerCreditsRemaining}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
