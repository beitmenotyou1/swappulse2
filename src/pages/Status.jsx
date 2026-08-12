import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, ArrowLeft, Bell, Activity, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SERVICES = [
  { key: 'base44', name: 'SwapPulse Platform', desc: 'Web app and API gateway', criticality: 'Critical' },
  { key: 'database', name: 'Database', desc: 'Collections, trades, and user data', criticality: 'Critical' },
  { key: 'tcgdex', name: 'TCGDex Catalog', desc: 'Card data, set info, and pricing', criticality: 'High' },
  { key: 'smtp', name: 'Email Service', desc: 'Transactional and branded emails', criticality: 'Medium' },
  { key: 'vapid', name: 'Push Notifications', desc: 'Web push delivery (VAPID)', criticality: 'Medium' },
];

export default function Status() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('health-check', {});
      setHealth(res.data);
      setLastChecked(new Date());
    } catch (e) {
      setHealth({ status: 'error', error: e?.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const services = health?.services || {};
  const serviceValues = Object.values(services);
  const allUp = serviceValues.length > 0 && serviceValues.every((s) => s?.status === 'up');
  const anyDown = serviceValues.some((s) => s?.status === 'down');
  const OverallIcon = allUp ? CheckCircle2 : AlertCircle;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="rounded-full p-1.5 hover:bg-secondary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">System Status</h1>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()}` : 'Checking…'}
              </p>
            </div>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-full p-2 hover:bg-secondary disabled:opacity-50"
            aria-label="Refresh status"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 p-4">
        {/* Overall status */}
        <div className={`rounded-2xl border p-6 text-center ${
          allUp ? 'border-success/30 bg-success/5' : anyDown ? 'border-destructive/30 bg-destructive/5' : 'border-border'
        }`}>
          <OverallIcon className={`mx-auto h-16 w-16 ${
            allUp ? 'text-success' : anyDown ? 'text-destructive' : 'text-muted-foreground'
          }`} />
          <h2 className="mt-3 text-2xl font-extrabold">
            {allUp ? 'All Systems Operational' : anyDown ? 'Some Services Degraded' : 'Checking service status…'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {allUp
              ? 'Every SwapPulse service is running normally.'
              : anyDown
                ? 'Some services are experiencing issues. We’re aware and working on it.'
                : 'Hang tight while we check each service.'}
          </p>
        </div>

        {/* Service grid */}
        <section>
          <h3 className="mb-3 text-lg font-extrabold">Services</h3>
          <div className="space-y-2">
            {SERVICES.map((svc) => {
              const s = services[svc.key];
              const status = s?.status || 'checking';
              const isUp = status === 'up';
              const isDown = status === 'down';
              const Icon = isUp ? CheckCircle2 : isDown ? XCircle : AlertCircle;
              return (
                <div key={svc.key} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 shrink-0 ${
                      isUp ? 'text-success' : isDown ? 'text-destructive' : 'text-muted-foreground'
                    }`} />
                    <div>
                      <p className="text-sm font-bold">{svc.name}</p>
                      <p className="text-xs text-muted-foreground">{svc.desc}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${
                      isUp ? 'text-success' : isDown ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                      {isUp ? 'Operational' : isDown ? 'Down' : 'Checking…'}
                    </p>
                    {s?.error && <p className="max-w-[200px] truncate text-xs text-muted-foreground">{s.error}</p>}
                    {s?.latencyMs != null && isUp && <p className="text-xs text-muted-foreground">{s.latencyMs}ms</p>}
                    <span className="text-xs text-muted-foreground">{svc.criticality}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Subscribe */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <h3 className="font-bold">Subscribe to status updates</h3>
              <p className="text-sm text-muted-foreground">
                Get push notifications when a service goes down or recovers. Configure in Settings → Notifications.
              </p>
              <Link to="/settings" className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
                <Bell className="h-4 w-4" /> Notification settings
              </Link>
            </div>
          </div>
        </section>

        {/* Help link */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <Activity className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <h3 className="font-bold">Need help?</h3>
              <p className="text-sm text-muted-foreground">
                Check the Help Centre for guides, FAQ, and troubleshooting tips.
              </p>
              <Link to="/help" className="mt-2 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-bold hover:bg-secondary">
                Help Centre
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}