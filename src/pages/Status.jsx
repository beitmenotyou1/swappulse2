import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, XCircle, AlertCircle, RefreshCw, ArrowLeft, Bell, Activity, Clock,
  Mail, ChevronDown, AlertTriangle, Loader2,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SERVICES = [
  { key: 'base44', name: 'SwapPulse Platform', desc: 'Web app and API gateway', criticality: 'Critical' },
  { key: 'database', name: 'Database', desc: 'Collections, trades, and user data', criticality: 'Critical' },
  { key: 'tcgdex', name: 'TCGDex Catalog', desc: 'Card data, set info, and pricing', criticality: 'High' },
  { key: 'smtp', name: 'Email Service', desc: 'Transactional and branded emails', criticality: 'Medium' },
  { key: 'vapid', name: 'Push Notifications', desc: 'Web push delivery (VAPID)', criticality: 'Medium' },
];

const STATUS_COLORS = {
  operational: 'text-success',
  degraded: 'text-warning',
  outage: 'text-destructive',
  investigating: 'text-warning',
  identified: 'text-warning',
  monitoring: 'text-primary',
  resolved: 'text-success',
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
  const [incidents, setIncidents] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [subState, setSubState] = useState(null); // null | 'sending' | 'sent' | 'error'
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

  const loadIncidents = useCallback(async () => {
    setIncidentsLoading(true);
    try {
      const res = await base44.entities.StatusIncident.list('-started_at', 20);
      setIncidents(res || []);
    } catch (e) {
      setIncidents([]);
    } finally {
      setIncidentsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHealth();
    loadIncidents();

    // Handle ?confirm=TOKEN and ?unsubscribe=TOKEN URL params
    const params = new URLSearchParams(window.location.search);
    const confirmToken = params.get('confirm');
    const unsubscribeToken = params.get('unsubscribe');

    if (confirmToken) {
      base44.functions.invoke('confirm-subscription', { token: confirmToken })
        .then((res) => {
          if (res.data?.confirmed || res.data?.alreadyConfirmed) {
            setConfirmMsg({ type: 'success', text: 'Email confirmed! You\'ll now receive status updates.' });
          } else {
            setConfirmMsg({ type: 'error', text: res.data?.error || 'Confirmation failed.' });
          }
        })
        .catch(() => setConfirmMsg({ type: 'error', text: 'Confirmation failed.' }));
      // Clean URL
      window.history.replaceState({}, '', '/status');
    }

    if (unsubscribeToken) {
      base44.functions.invoke('confirm-subscription', { token: unsubscribeToken, action: 'unsubscribe' })
        .then((res) => {
          if (res.data?.unsubscribed) {
            setConfirmMsg({ type: 'success', text: 'You\'ve been unsubscribed from status updates.' });
          } else {
            setConfirmMsg({ type: 'error', text: res.data?.error || 'Unsubscribe failed.' });
          }
        })
        .catch(() => setConfirmMsg({ type: 'error', text: 'Unsubscribe failed.' }));
      window.history.replaceState({}, '', '/status');
    }
  }, [refreshHealth, loadIncidents]);

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

  const services = health?.services || {};
  const serviceValues = Object.values(services);
  const allUp = serviceValues.length > 0 && serviceValues.every((s) => s?.status === 'up');
  const anyDown = serviceValues.some((s) => s?.status === 'down');
  const OverallIcon = allUp ? CheckCircle2 : AlertCircle;

  const activeIncidents = incidents.filter((i) => i.status !== 'resolved');
  const pastIncidents = incidents.filter((i) => i.status === 'resolved');

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
            onClick={refreshHealth}
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
                ? 'Some services are experiencing issues. We\'re aware and working on it.'
                : 'Hang tight while we check each service.'}
          </p>
        </div>

        {/* Confirmation / unsubscribe messages */}
        {confirmMsg && (
          <div className={`rounded-xl border p-3 text-sm ${
            confirmMsg.type === 'success' ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}>
            {confirmMsg.text}
          </div>
        )}

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
                <div className="rounded-lg bg-success/10 p-3 text-sm text-success">
                  {subMsg}
                </div>
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
              {subState === 'error' && (
                <p className="mt-2 text-sm text-destructive">{subMsg}</p>
              )}
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
  const statusClass = STATUS_COLORS[incident.status] || 'text-muted-foreground';
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
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sevClass}`}>
              {incident.severity}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(incident.started_at).toLocaleString()}
            {incident.resolved_at && ` → Resolved ${new Date(incident.resolved_at).toLocaleString()}`}
          </p>
          {(incident.affected_services || []).length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Affected: {incident.affected_services.join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${statusClass}`}>{incident.status}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {expanded && updates.length > 0 && (
        <div className="mt-4 space-y-3 border-l-2 border-primary/30 pl-4">
          {updates.map((upd, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-primary" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {new Date(upd.created_at).toLocaleString()}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  upd.status === 'resolved' ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary'
                }`}>
                  {upd.status}
                </span>
                <span className="text-xs text-muted-foreground">by {upd.authored_by}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{upd.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}