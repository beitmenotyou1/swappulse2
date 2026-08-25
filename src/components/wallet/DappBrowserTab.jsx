import React, { useState, useMemo } from 'react';
import { Globe, Shield, ArrowRight, CheckCircle2 } from 'lucide-react';
import { DAPP_CATALOG, DAPP_CATEGORIES } from '@/lib/dappCatalog';
import DappBrowser from '@/components/wallet/DappBrowser';

export default function DappBrowserTab({ walletAddress }) {
  const [activeDapp, setActiveDapp] = useState(null);
  const [activeCategory, setActiveCategory] = useState('TCG');

  const filteredDapps = useMemo(
    () => DAPP_CATALOG.filter((d) => d.category === activeCategory),
    [activeCategory],
  );

  if (activeDapp) {
    return (
      <DappBrowser
        dapp={activeDapp}
        walletAddress={walletAddress}
        onClose={() => setActiveDapp(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Security notice */}
      <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <div>
          <p className="text-sm font-semibold">Read-Only dApp Browser</p>
          <p className="text-xs text-muted-foreground">
            Browse curated, legitimate crypto dApps with your wallet address. Transaction signing is not supported — your funds are safe.
          </p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DAPP_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${
              activeCategory === cat.id
                ? 'bg-primary text-white'
                : 'border border-border bg-card text-muted-foreground hover:bg-secondary'
            }`}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* dApp grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {filteredDapps.map((dapp) => (
          <button
            key={dapp.id}
            onClick={() => setActiveDapp(dapp)}
            className="group flex flex-col items-start rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/30 hover:shadow-raised"
          >
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-2xl">
              {dapp.logo}
            </div>
            <div className="flex w-full items-center gap-1">
              <p className="truncate text-sm font-bold">{dapp.name}</p>
              <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{dapp.description}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-primary opacity-0 transition group-hover:opacity-100">
              Open <ArrowRight className="h-3 w-3" />
            </span>
          </button>
        ))}
      </div>

      {!walletAddress && (
        <div className="rounded-xl border border-border bg-secondary p-3 text-center text-xs text-muted-foreground">
          <Globe className="mx-auto mb-1 h-5 w-5" />
          Create or link a wallet in Settings to view your holdings on these dApps.
        </div>
      )}
    </div>
  );
}