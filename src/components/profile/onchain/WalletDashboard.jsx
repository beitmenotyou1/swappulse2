import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Copy, LifeBuoy, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { identityStatusConfig, isChainAuthoritative, shortHex } from '@/lib/chainIdentityDisplay';

function formatUtc(seconds) {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value <= 0) return 'No expiry';
  return new Date(value * 1000).toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function remainingLabel(seconds, nowMs) {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  const ms = value * 1000 - nowMs;
  if (ms <= 0) return 'Expired';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${Math.max(1, minutes)}m remaining`;
}

function verificationPresentation(identity, nowMs) {
  const stored = String(identity?.verification_status || 'NONE');
  const expiresAt = Number(identity?.verification_expires_at || 0);
  const expiredByClock = expiresAt > 0 && expiresAt * 1000 <= nowMs;
  if (stored === 'REVOKED') return { label: 'Revoked', active: false };
  if (stored === 'EXPIRED' || expiredByClock) return { label: 'Expired', active: false };
  if (stored === 'ACTIVE') return { label: 'Active', active: true };
  return { label: 'Not verified', active: false };
}

export default function WalletDashboard({ status, onReload }) {
  const { toast } = useToast();
  const [reconciling, setReconciling] = useState(false);
  const [recovery, setRecovery] = useState(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const identity = status?.identity || {};
  const network = status?.network || {};
  const { Icon, bgClass, textClass, label } = identityStatusConfig(identity.status);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!identity?.account_address || !isChainAuthoritative(identity?.status)) {
      setRecovery(null);
      return () => { cancelled = true; };
    }
    setRecoveryLoading(true);
    base44.functions.invoke('chain-recovery', { action: 'status' })
      .then((res) => {
        if (!cancelled) setRecovery((res?.data || res || {})?.recovery || null);
      })
      .catch(() => {
        if (!cancelled) setRecovery(null);
      })
      .finally(() => {
        if (!cancelled) setRecoveryLoading(false);
      });
    return () => { cancelled = true; };
  }, [identity?.id, identity?.account_address, identity?.status]);

  const verification = useMemo(() => verificationPresentation(identity, now), [identity, now]);
  const verificationType = Number(identity?.verification_type || 0);
  const verificationLevel = Number(identity?.verification_level || 0);
  const expiryLabel = remainingLabel(identity?.verification_expires_at, now);

  const copy = async (value, what) => {
    try { await navigator.clipboard.writeText(value); toast({ title: `${what} copied` }); }
    catch { toast({ title: 'Could not copy', variant: 'destructive' }); }
  };

  const reconcile = async () => {
    if (!identity?.id) return;
    setReconciling(true);
    try {
      const res = await base44.functions.invoke('chain-identity-reconcile', { record_id: identity.id });
      const data = res?.data || res;
      const outcome = data?.results?.[0]?.outcome || 'CHECKED';
      await onReload();
      toast({
        title: isChainAuthoritative(outcome) ? 'Identity verified on chain' : 'Chain state refreshed',
        description: isChainAuthoritative(outcome) ? 'Your identity is chain-authoritative.' : `Chain result: ${outcome}`,
      });
    } catch (error) {
      toast({ title: 'Chain verification failed', description: error?.response?.data?.error || error?.message, variant: 'destructive' });
    } finally {
      setReconciling(false);
    }
  };

  const txs = [
    { label: 'Account deployment', hash: identity.deployment_tx_hash },
    { label: 'Identity registration', hash: identity.registration_tx_hash },
    { label: 'Latest V2 verification', hash: identity.verification_tx_hash },
    { label: identity.verification_status === 'REVOKED' ? 'Current verification revocation' : 'Previous verification revocation', hash: identity.verification_revoke_tx_hash },
  ].filter((t) => t.hash);

  const recoveryDelayHours = Math.round(Number(network?.recovery_delay_seconds || recovery?.recovery_delay_seconds || 0) / 3600);
  const recoveryPending = Boolean(recovery?.pending);
  const recoveryReady = Boolean(recovery?.ready);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2.5 ${bgClass} ${textClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{identity.network || 'SWAPPULSE_TESTNET'}</p>
          </div>
          {network?.identity_verification_mode && (
            <span className="rounded-full border border-border bg-secondary/40 px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">
              {network.identity_verification_mode} identity
            </span>
          )}
        </div>
      </div>

      {identity.account_address && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground">Smart account address</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-sm">{identity.account_address}</code>
            <button onClick={() => copy(identity.account_address, 'Address')} className="shrink-0 rounded-lg p-2 hover:bg-secondary" aria-label="Copy smart account address">
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Identity ID</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-mono text-sm" title={identity.chain_identity_id}>{shortHex(identity.chain_identity_id)}</p>
            {identity.chain_identity_id && (
              <button onClick={() => copy(identity.chain_identity_id, 'Identity ID')} className="rounded p-1 hover:bg-secondary" aria-label="Copy identity ID">
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Completed recoveries</p>
          <p className="mt-1 font-mono text-sm">{identity.recovery_count || 0}</p>
        </div>
      </div>

      {isChainAuthoritative(identity.status) && (
        <div className={`rounded-xl border p-4 ${verification.active ? 'border-success/30 bg-success/5' : 'border-border bg-card'}`}>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-full p-2 ${verification.active ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground'}`}>
              {verification.active ? <CheckCircle2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold">V2 identity assurance</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${verification.active ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground'}`}>
                  {verification.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {verificationType > 0 ? `Type ${verificationType}` : 'No assurance type'} · {verificationLevel > 0 ? `Level ${verificationLevel}` : 'No assurance level'}
              </p>
              {Number(identity?.verification_expires_at || 0) > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-background/70 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Expires</p>
                    <p className="mt-0.5 text-xs font-medium">{formatUtc(identity.verification_expires_at)}</p>
                  </div>
                  <div className="rounded-lg bg-background/70 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Current state</p>
                    <p className="mt-0.5 text-xs font-medium">{expiryLabel || verification.label}</p>
                  </div>
                </div>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                The public chain record contains only opaque commitments, assurance metadata, timestamps and revocation state. Your name, email, date of birth and identity documents are not stored on-chain.
              </p>
              {identity.last_reconciled_at && (
                <p className="mt-2 text-[10px] text-muted-foreground">Last checked against the public chain: {new Date(identity.last_reconciled_at).toLocaleString()}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {isChainAuthoritative(identity.status) && network?.recovery_configured && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary"><LifeBuoy className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold">Account recovery protection</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${recoveryPending ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                  {recoveryLoading ? 'Checking' : recoveryReady ? 'Ready to complete' : recoveryPending ? 'Scheduled' : 'Protected'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {recoveryDelayHours > 0 ? `${recoveryDelayHours}-hour on-chain delay protects signer changes.` : 'Signer changes use the configured on-chain recovery delay.'}
              </p>
              {recoveryPending && recovery?.execute_after_iso && (
                <div className="mt-2 flex items-center gap-2 text-xs text-warning">
                  <Clock3 className="h-3.5 w-3.5" />
                  {recoveryReady ? 'The waiting period has finished.' : `Can complete after ${new Date(recovery.execute_after_iso).toLocaleString()}.`}
                </div>
              )}
              <Link to="/recover" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                <LifeBuoy className="h-3.5 w-3.5" /> Manage account recovery
              </Link>
            </div>
          </div>
        </div>
      )}

      {txs.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground">Public transaction history</p>
          <div className="mt-2 space-y-2">
            {txs.map((tx) => (
              <div key={`${tx.label}:${tx.hash}`} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{tx.label}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground" title={tx.hash}>{shortHex(tx.hash)}</p>
                </div>
                <button onClick={() => copy(tx.hash, 'Tx hash')} className="shrink-0 rounded-lg p-1.5 hover:bg-secondary" aria-label={`Copy ${tx.label} transaction hash`}>
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {identity.id && ['DEPLOYED', 'REGISTERED', 'RECOVERED'].includes(identity.status) && (
        <button
          onClick={reconcile}
          disabled={reconciling}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${reconciling ? 'animate-spin' : ''}`} />
          {reconciling ? 'Checking public chain…' : 'Refresh identity from chain'}
        </button>
      )}

      {identity.account_address && (
        <Link
          to="/status"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <RefreshCw className="h-3.5 w-3.5" /> View network status
        </Link>
      )}
    </div>
  );
}
