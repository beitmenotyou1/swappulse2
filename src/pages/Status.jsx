import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, XCircle, AlertCircle, RefreshCw, ArrowLeft, Bell, Activity, Clock,
  Mail, ChevronDown, AlertTriangle, Loader2, Wrench,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ServiceRow from '@/components/status/ServiceRow';

// Maps health-check service keys to StatusService slugs
const HEALTH_TO_SLUG = {
  base44: 'web-app',
  database: 'postgresql',
  tcgdex: 'tcgdex-api',
  'atproto-relay': 'atproto-relay',
};

const CRITICALITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const STATUS_STYLES = {
  operational: { icon: CheckCircle2, color: 'text-success', label: 'Operational' },
  degraded: { icon: AlertCircle, color: 'text-warning', label: 'Degraded' },
  outage: { icon: XCircle, color: 'text-destructive', label: 'Outage' },
  maintenance: { icon: Wrench, color: 'text-primary', label: 'Maintenance' },
};

const SEVERITY_BADGE = {
  critical: 'bg-destructive/15 text-destructive',
  major: 'bg-warning/15 text-warning',
  minor: 'bg-primary/15 text-primary',
};

export default function Status() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);
  const [services, setServices] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [maintenance, setMaintenance] = useState([]);
  const [email, setEmail] = useState('');
  const [subState, setSubState] = useState(null);
  const [subMsg, setSubMsg] = useState('');
  const [confirmMsg, setConfirmMsg] = useState(null);

  const refreshHealth = useCallback(async () => {
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

  const loadData = useCallback(async () => {
    try {
      const [svcRes, incRes, maintRes] = await Promise.all([
        base44.entities.StatusService.filter({ is_active: true }, 'sort_order', 100),
        base44.entities.StatusIncident.list('-started_at', 20),
        base44.entities.StatusMaintenanceWindow.list('starts_at', 20),
      ]);
      setServices(svcRes || []);
      setIncidents(incRes || []);
      const now = new Date();
      setMaintenance((maintRes || []).filter((m) => new Date(m.ends_at) > now));
    } catch (e) {
      setServices([]);
      setIncidents([]);
    } finally {
      setIncidentsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHealth();
    loadData();

    const params = new URLSearchParams(window.location.search);
    const confirmToken = params.get('confirm');
    const unsubscribeToken = params.get('unsubscribe');

    if (confirmToken) {
      base44.functions.invoke('confirm-subscription', { token: confirmToken })
        .then((res) => {
          setConfirmMsg(res.data?.confirmed || res.data?.alreadyConfirmed
            ? { type: 'success', text: 'Email confirmed! You\'ll now receive status updates.' }
            : { type: 'error', text: res.data?.error || 'Confirmation failed.' });
        })
        .catch(() => setConfirmMsg({ type: 'error', text: 'Confirmation failed.' }));
      window.history.replaceState({}, '', '/status');
    }

    if (unsubscribeToken) {
      base44.functions.invoke('confirm-subscription', { token: unsubscribeToken, action: 'unsubscribe' })
        .then((res) => {
          setConfirmMsg(res.data?.unsubscribed
            ? { type: 'success', text: 'You\'ve been unsubscribed from status updates.' }
            : { type: 'error', text: res.data?.error || 'Unsubscribe failed.' });
        })
        .catch(() => setConfirmMsg({ type: 'error', text: 'Unsubscribe failed.' }));
      window.history.replaceState({}, '', '/status');
    }
  }, [refreshHealth, loadData]);

  // Auto-refresh: health every 30s, data every 60s
  useEffect(() => {
    const healthInterval = setInterval(refreshHealth, 30000);
    const dataInterval = setInterval(loadData, 60000);
    return () => {
      clearInterval(healthInterval);
      clearInterval(dataInterval);
    };
  }, [refreshHealth, loadData]);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubState('sending');
    setSubMsg('');
    try {
      const res = await base44.functions.invoke('subscribe-status', { email: email.trim() });
      if (res.data?.alreadySubscribed) {
        setSubState('sent');
        setSubMsg('You\'re already subscribed!');
      } else if (res.data?.ok) {
        setSubState('sent');
        setSubMsg('Check your email to confirm your subscription.');
      } else {
        setSubState('error');
        setSubMsg(res.data?.error || 'Subscription failed.');
      }
    } catch (err) {
      setSubState('error');
      setSubMsg(err.response?.data?.error || err.message || 'Subscription failed.');
    }
  };

  // Merge service records with live health-check results
  const getLiveStatus = (service) => {
    const healthKey = Object.entries(HEALTH_TO_SLUG).find(([, slug]) => slug === service.slug)?.[0];
    if (!healthKey || !health?.services?.[healthKey]) return service.current_status || 'operational';
    return health.services[healthKey].status === 'up' ? 'operational' : 'outage';
  };

  const allOperational = services.length > 0 && services.every((s) => getLiveStatus(s) === 'operational');
  const anyOutage = services.some((s) => getLiveStatus(s) === 'outage');
  const anyDegraded = services.some((s) => ['degraded', 'maintenance'].includes(getLiveStatus(s)));
  const overallUp = allOperational;
  const OverallIcon = overallUp ? CheckCircle2 : anyOutage ? XCircle : AlertCircle;

  const activeIncidents = incidents.filter((i) => i.status !== 'resolved');
  const pastIncidents = incidents.filter((i) => i.status === 'resolved');

  // Group services by criticality
  const grouped = services.reduce((acc, s) => {
    const c = s.criticality || 'medium';
    if (!acc[c]) acc[c] = [];
    acc[c].push(s);
    return acc;
  }, {});
  const criticalityOrder = ['critical', 'high', 'medium', 'low'];

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
            onClick={() => { refreshHealth(); loadData(); }}
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
          overallUp ? 'border-success/30 bg-success/5'
          : anyOutage ? 'border-destructive/30 bg-destructive/5'
          : 'border-warning/30 bg-warning/5'
        }`}>
          <OverallIcon className={`mx-auto h-16 w-16 ${
            overallUp ? 'text-success' : anyOutage ? 'text-destructive' : 'text-warning'
          }`} />
          <h2 className="mt-3 text-2xl font-extrabold">
            {overallUp ? 'All Systems Operational'
              : anyOutage ? 'Some Services Down'
              : 'Some Services Degraded'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {overallUp
              ? `All ${services.length} SwapPulse services are running normally.`
              : anyOutage
                ? 'Some services are experiencing outages. We\'re aware and working on it.'
                : 'Some services are degraded. We\'re monitoring the situation.'}
          </p>
        </div>

        {/* Confirmation messages */}
        {confirmMsg && (
          <div className={`rounded-xl border p-3 text-sm ${
            confirmMsg.type === 'success' ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}>
            {confirmMsg.text}
          </div>
        )}

        {/* Maintenance windows */}
        {maintenance.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-extrabold">Scheduled Maintenance</h3>
            </div>
            <div className="space-y-2">
              {maintenance.map((m) => (
                <div key={m.id} className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <p className="text-sm font-bold">{m.title}</p>
                  {m.description && <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(m.starts_at).toLocaleString()} → {new Date(m.ends_at).toLocaleString()}
                  </p>
                  {(m.affected_services || []).length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">Affected: {m.affected_services.join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Active incidents */}
        {activeIncidents.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <h3 className="text-lg font-extrabold">Active Incidents</h3>
            </div>
            <div className="space-y-3">
              {activeIncidents.map((inc) => (
                <IncidentCard key={inc.id} incident={inc} />
              ))}
            </div>
          </section>
        )}

        {/* Services grouped by criticality */}
        <section>
          <h3 className="mb-3 text-lg font-extrabold">Services</h3>
          {services.length === 0 && incidentsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {criticalityOrder.map((crit) => {
                const group = grouped[crit];
                if (!group || group.length === 0) return null;
                return (
                  <div key={crit}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {CRITICALITY_LABELS[crit]}
                    </p>
                    <div className="space-y-2">
                      {group.map((svc) => {
                        const status = getLiveStatus(svc);
                        const healthKey = Object.entries(HEALTH_TO_SLUG).find(([, slug]) => slug === svc.slug)?.[0];
                        const latency = healthKey ? health?.services?.[healthKey]?.latencyMs : null;
                        return (
                          <ServiceRow
                            key={svc.id}
                            service={svc}
                            liveStatus={status}
                            latency={latency}
                            criticalityLabel={CRITICALITY_LABELS[crit]}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Past incidents */}
        <section>
          <h3 className="mb-3 text-lg font-extrabold">Incident History</h3>
          {incidentsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : pastIncidents.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              No incidents recorded yet. All systems have been operational.
            </p>
          ) : (
            <div className="space-y-3">
              {pastIncidents.map((inc) => (
                <IncidentCard key={inc.id} incident={inc} />
              ))}
            </div>
          )}
        </section>

        {/* Subscribe */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <h3 className="font-bold">Subscribe to status updates</h3>
              <p className="mb-3 text-sm text-muted-foreground">
                Get an email when a service goes down or recovers. Double-opt-in — check your inbox to confirm.
              </p>
              {subState === 'sent' ? (
                <div className="rounded-lg bg-success/10 p-3 text-sm text-success">{subMsg}</div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      disabled={subState === 'sending'}
                      className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={subState === 'sending'}
                    className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
                  >
                    {subState === 'sending' ? 'Sending…' : 'Subscribe'}
                  </button>
                </form>
              )}
              {subState === 'error' && <p className="mt-2 text-sm text-destructive">{subMsg}</p>}
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

function IncidentCard({ incident }) {
  const [expanded, setExpanded] = useState(false);
  const updates = incident.updates || [];
  const statusColor = incident.status === 'resolved' ? 'text-success' : 'text-warning';
  const sevClass = SEVERITY_BADGE[incident.severity] || 'bg-muted text-muted-foreground';

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold">{incident.title}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sevClass}`}>{incident.severity}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(incident.started_at).toLocaleString()}
            {incident.resolved_at && ` → Resolved ${new Date(incident.resolved_at).toLocaleString()}`}
          </p>
          {(incident.affected_services || []).length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">Affected: {incident.affected_services.join(', ')}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${statusColor}`}>{incident.status}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {expanded && updates.length > 0 && (
        <div className="mt-4 space-y-3 border-l-2 border-primary/30 pl-4">
          {updates.map((upd, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-primary" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{new Date(upd.created_at).toLocaleString()}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  upd.status === 'resolved' ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary'
                }`}>{upd.status}</span>
                <span className="text-xs text-muted-foreground">by {upd.authored_by}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{upd.text}</p>
            </div>
          ))}
        </div>
      )}
      {expanded && (
        <div className="mt-3 border-t border-border pt-3">
          <Link to={`/incidents/${incident.id}`} className="text-xs font-semibold text-primary hover:underline">
            View full details →
          </Link>
        </div>
      )}
    </div>
  );
}