import React, { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { CreditCard, Loader2, AlertCircle } from 'lucide-react';

// Polygon Cross-chain SDK (Trails) on-ramp card. Renders the Trails "fund"
// widget from the Polygon Cross-chain SDK CDN, letting a collector top up
// their Polygon USDC wallet with card, bank, exchange, or connected-wallet
// funds — a crypto-native alternative to the Stripe fiat top-up.
//
// Zero npm dependency: the widget is loaded from https://cdn.trails.build/widget.js
// (see https://docs.polygon.technology/cross-chain/sdk). Requires:
//   1. TRAILS_ACCESS_KEY secret (publishable — served via get-trails-config)
//   2. A SwapPulse custodial Polygon wallet address (the USDC destination)
//
// Native USDC on Polygon PoS (6 decimals) — same contract the wallet already
// uses (base44/shared/walletEscrow.ts).

const TRAILS_WIDGET_SRC = 'https://cdn.trails.build/widget.js';
const POLYGON_USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const POLYGON_CHAIN_ID = 137;
const CONTAINER_ID = 'trails-fund-widget';

// Loads the Trails CDN widget script once and resolves when window.TrailsWidget
// is available. Safe to call from multiple components — the promise is shared.
let widgetPromise = null;
function loadTrailsWidget() {
  if (widgetPromise) return widgetPromise;
  widgetPromise = new Promise((resolve, reject) => {
    if (window.TrailsWidget) { resolve(); return; }
    const existing = document.querySelector(`script[src="${TRAILS_WIDGET_SRC}"]`);
    if (existing) {
      const onDone = () => (window.TrailsWidget ? resolve() : reject(new Error('Trails widget failed to load')));
      existing.addEventListener('load', onDone, { once: true });
      existing.addEventListener('error', () => reject(new Error('Trails widget failed to load')), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = TRAILS_WIDGET_SRC;
    s.async = true;
    s.onload = () => (window.TrailsWidget ? resolve() : reject(new Error('Trails widget failed to load')));
    s.onerror = () => reject(new Error('Trails widget failed to load'));
    document.head.appendChild(s);
  });
  return widgetPromise;
}

export default function TrailsFundCard({ walletAddress }) {
  const containerRef = useRef(null);
  // accessKey: null = loading config, '' = missing/unconfigured, string = ready
  const [accessKey, setAccessKey] = useState(null);
  const [widgetReady, setWidgetReady] = useState(false);
  const [error, setError] = useState('');

  // Fetch the publishable access key from the backend.
  useEffect(() => {
    let cancelled = false;
    base44.functions.invoke('get-trails-config', {})
      .then((res) => { if (!cancelled) setAccessKey(res.data?.accessKey || ''); })
      .catch((e) => { if (!cancelled) { setAccessKey(''); setError(e?.message || 'Failed to load on-ramp config'); } });
    return () => { cancelled = true; };
  }, []);

  // Initialise the widget once the script + key + wallet are all present.
  const initWidget = useCallback(async () => {
    if (!accessKey || !walletAddress) return;
    try {
      await loadTrailsWidget();
      if (!containerRef.current) return;
      // Clear any previous widget content before (re)initialising.
      containerRef.current.innerHTML = '';
      window.TrailsWidget.init({
        containerId: CONTAINER_ID,
        accessKey,
        mode: 'fund',
        destinationChainId: POLYGON_CHAIN_ID,
        destinationTokenAddress: POLYGON_USDC,
        destinationToAddress: walletAddress,
      });
      setWidgetReady(true);
      setError('');
    } catch (e) {
      setError(e?.message || 'On-ramp widget failed to load');
    }
  }, [accessKey, walletAddress]);

  useEffect(() => {
    if (accessKey === null) return; // still loading config
    initWidget();
  }, [initWidget, accessKey]);

  // Loading config
  if (accessKey === null) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading on-ramp…
        </div>
      </div>
    );
  }

  const header = (
    <div className="mb-3 flex items-center gap-2">
      <CreditCard className="h-5 w-5 text-primary" />
      <div>
        <h3 className="text-sm font-bold">Card / Bank On-ramp</h3>
        <p className="text-[11px] text-muted-foreground">Powered by Polygon Cross-chain SDK · deposits USDC to your wallet</p>
      </div>
    </div>
  );

  // Not configured (admin hasn't set the key)
  if (!accessKey) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        {header}
        <p className="text-xs text-muted-foreground">
          Top up your Polygon USDC wallet with card or bank transfer via the Polygon Cross-chain SDK.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>On-ramp not configured yet. An admin needs to set the <code className="font-mono">TRAILS_ACCESS_KEY</code> secret (get one at dashboard.trails.build).</span>
        </div>
      </div>
    );
  }

  // No wallet
  if (!walletAddress) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        {header}
        <p className="text-xs text-muted-foreground">
          Create a SwapPulse wallet first — the on-ramp deposits USDC directly to your Polygon address.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      {header}
      <div id={CONTAINER_ID} ref={containerRef} className="min-h-[120px]" />
      {!widgetReady && !error && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting on-ramp…
        </div>
      )}
      {error && (
        <div className="mt-2 flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </div>
      )}
    </div>
  );
}