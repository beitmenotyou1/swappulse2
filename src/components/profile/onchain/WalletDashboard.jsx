import React, { useEffect, useMemo, useState } from 'react';
import { Blocks, CheckCircle2, Clock3, Copy, LifeBuoy, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { identityStatusConfig, isChainAuthoritative, shortHex } from '@/lib/chainIdentityDisplay';
import { useI18n } from '@/lib/i18n/I18nProvider';

const IDENTITY_STATUS_KEYS = {
  REGISTERED: 'wallet.identity.status.registered',
  RECOVERED: 'wallet.identity.status.recovered',
  MERGED: 'wallet.identity.status.merged',
  DEPLOYED: 'wallet.identity.status.deployed',
  PENDING: 'wallet.identity.status.pending',
  FAILED: 'wallet.identity.status.failed',
  RECOVERY_PENDING: 'wallet.identity.status.recoveryPending',
};

function formatTimestamp(seconds, locale, t) {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value <= 0) return t('wallet.identity.noExpiry');
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value * 1000));
}

function formatIsoTimestamp(value, locale) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return String(value || '');
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function remainingLabel(seconds, nowMs, t) {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  const ms = value * 1000 - nowMs;
  if (ms <= 0) return t('wallet.identity.verification.expired');
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return t('wallet.identity.remainingDays', { days, hours });
  if (hours > 0) return t('wallet.identity.remainingHours', { hours, minutes });
  return t('wallet.identity.remainingMinutes', { minutes: Math.max(1, minutes) });
}

function verificationPresentation(identity, nowMs, t) {
  const stored = String(identity?.verification_status || 'NONE');
  const expiresAt = Number(identity?.verification_expires_at || 0);
  const expiredByClock = expiresAt > 0 && expiresAt * 1000 <= nowMs;
  if (stored === 'REVOKED') return { label: t('wallet.identity.verification.revoked'), active: false };
  if (stored === 'EXPIRED' || expiredByClock) return { label: t('wallet.identity.verification.expired'), active: false };
  if (stored === 'ACTIVE') return { label: t('wallet.identity.verification.active'), active: true };
  return { label: t('wallet.identity.verification.notVerified'), active: false };
}

function translatedIdentityStatus(statusValue, t) {
  if (IDENTITY_STATUS_KEYS[statusValue]) return t(IDENTITY_STATUS_KEYS[statusValue]);
  if (!statusValue) return t('wallet.identity.status.none');
  return t('wallet.identity.status.unknown', { status: statusValue });
}

export default function WalletDashboard({ status, onReload }) {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const [reconciling, setReconciling] = useState(false);
  const [recovery, setRecovery] = useState(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const identity = status?.identity || {};
  const network = status?.network || {};
  const { Icon, bgClass, textClass } = identityStatusConfig(identity.status);
  const identityLabel = translatedIdentityStatus(identity.status, t);

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

  const verification = useMemo(
    () => verificationPresentation(identity, now, t),
    [identity, now, t],
  );
  const verificationType = Number(identity?.verification_type || 0);
  const verificationLevel = Number(identity?.verification_level || 0);
  const expiryLabel = remainingLabel(identity?.verification_expires_at, now, t);

  const copy = async (value, successKey) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: t(successKey) });
    } catch {
      toast({ title: t('wallet.identity.copyFailed'), variant: 'destructive' });
    }
  };

  const reconcile = async () => {
    if (!identity?.id) return;
    setReconciling(true);
    try {
      const res = await base44.functions.invoke('chain-identity-reconcile', { record_id: identity.id });
      const data = res?.data || res;
      const outcome = data?.results?.[0]?.outcome || 'CHECKED';
      await onReload();
      const authoritative = isChainAuthoritative(outcome);
      toast({
        title: authoritative ? t('wallet.identity.reconcileVerified') : t('wallet.identity.reconcileRefreshed'),
        description: authoritative
          ? t('wallet.identity.chainAuthoritative')
          : t('wallet.identity.chainResult', { outcome }),
      });
    } catch (error) {
      toast({
        title: t('wallet.identity.reconcileFailed'),
        description: error?.response?.data?.error || error?.message,
        variant: 'destructive',
      });
    } finally {
      setReconciling(false);
    }
  };

  const txs = [
    { label: t('wallet.identity.tx.accountDeployment'), hash: identity.deployment_tx_hash },
    { label: t('wallet.identity.tx.registration'), hash: identity.registration_tx_hash },
    { label: t('wallet.identity.tx.latestVerification'), hash: identity.verification_tx_hash },
    {
      label: t(identity.verification_status === 'REVOKED'
        ? 'wallet.identity.tx.currentRevocation'
        : 'wallet.identity.tx.previousRevocation'),
      hash: identity.verification_revoke_tx_hash,
    },
  ].filter((item) => item.hash);

  const recoveryDelayHours = Math.round(Number(network?.recovery_delay_seconds || recovery?.recovery_delay_seconds || 0) / 3600);
  const recoveryPending = Boolean(recovery?.pending);
  const recoveryReady = Boolean(recovery?.ready);
  const recoveryState = recoveryLoading
    ? t('wallet.identity.recoveryChecking')
    : recoveryReady
      ? t('wallet.identity.recoveryReady')
      : recoveryPending
        ? t('wallet.identity.recoveryScheduled')
        : t('wallet.identity.recoveryProtected');

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2.5 ${bgClass} ${textClass}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{identityLabel}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{identity.network || 'SWAPPULSE_TESTNET'}</p>
          </div>
          {network?.identity_verification_mode && (
            <span className="rounded-full border border-border bg-secondary/40 px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">
              {t('wallet.identity.networkIdentity', { mode: network.identity_verification_mode })}
            </span>
          )}
        </div>
      </div>

      {identity.account_address && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground">{t('wallet.identity.smartAccountAddress')}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-sm" dir="ltr">{identity.account_address}</code>
            <Link
              to={`/chain/address/${identity.account_address}`}
              className="shrink-0 rounded-lg p-2 text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={t('explorer.viewAddress')}
              title={t('explorer.viewAddress')}
            >
              <Blocks className="h-4 w-4" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => copy(identity.account_address, 'wallet.identity.addressCopied')}
              className="shrink-0 rounded-lg p-2 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={t('wallet.identity.copySmartAccountAddress')}
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">{t('wallet.identity.identityId')}</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-mono text-sm" dir="ltr" title={identity.chain_identity_id}>{shortHex(identity.chain_identity_id)}</p>
            {identity.chain_identity_id && (
              <button
                type="button"
                onClick={() => copy(identity.chain_identity_id, 'wallet.identity.identityIdCopied')}
                className="rounded p-1 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={t('wallet.identity.copyIdentityId')}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">{t('wallet.identity.completedRecoveries')}</p>
          <p className="mt-1 font-mono text-sm">{identity.recovery_count || 0}</p>
        </div>
      </div>

      {isChainAuthoritative(identity.status) && (
        <div className={`rounded-xl border p-4 ${verification.active ? 'border-success/30 bg-success/5' : 'border-border bg-card'}`}>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-full p-2 ${verification.active ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground'}`}>
              {verification.active ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold">{t('wallet.identity.assuranceTitle')}</p>
                <span
                  aria-live="polite"
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${verification.active ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground'}`}
                >
                  {verification.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {verificationType > 0 ? t('wallet.identity.assuranceType', { type: verificationType }) : t('wallet.identity.noAssuranceType')}
                {' · '}
                {verificationLevel > 0 ? t('wallet.identity.assuranceLevel', { level: verificationLevel }) : t('wallet.identity.noAssuranceLevel')}
              </p>
              {Number(identity?.verification_expires_at || 0) > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-background/70 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">{t('wallet.identity.expires')}</p>
                    <p className="mt-0.5 text-xs font-medium">{formatTimestamp(identity.verification_expires_at, locale, t)}</p>
                  </div>
                  <div className="rounded-lg bg-background/70 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">{t('wallet.identity.currentState')}</p>
                    <p className="mt-0.5 text-xs font-medium" aria-live="polite">{expiryLabel || verification.label}</p>
                  </div>
                </div>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                {t('wallet.identity.privacyNotice')}
              </p>
              {identity.last_reconciled_at && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {t('wallet.identity.lastChecked', { time: formatIsoTimestamp(identity.last_reconciled_at, locale) })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {isChainAuthoritative(identity.status) && network?.recovery_configured && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary"><LifeBuoy className="h-4 w-4" aria-hidden="true" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold">{t('wallet.identity.recoveryTitle')}</p>
                <span
                  aria-live="polite"
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${recoveryPending ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}
                >
                  {recoveryState}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {recoveryDelayHours > 0
                  ? t('wallet.identity.recoveryDelayHours', { hours: recoveryDelayHours })
                  : t('wallet.identity.recoveryDelayConfigured')}
              </p>
              {recoveryPending && recovery?.execute_after_iso && (
                <div className="mt-2 flex items-center gap-2 text-xs text-warning">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  {recoveryReady
                    ? t('wallet.identity.recoveryWaitingFinished')
                    : t('wallet.identity.recoveryCanCompleteAfter', { time: formatIsoTimestamp(recovery.execute_after_iso, locale) })}
                </div>
              )}
              <Link
                to="/recover"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" /> {t('wallet.identity.manageRecovery')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {txs.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground">{t('wallet.identity.transactionHistory')}</p>
          <div className="mt-2 space-y-2">
            {txs.map((tx) => (
              <div key={`${tx.label}:${tx.hash}`} className="flex items-center gap-2">
                <Link
                  to={`/chain/tx/${tx.hash}`}
                  className="min-w-0 flex-1 rounded-lg p-1 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={`${t('explorer.viewTransaction')}: ${tx.label}`}
                >
                  <p className="text-xs font-medium">{tx.label}</p>
                  <p className="truncate font-mono text-[11px] text-primary" dir="ltr" title={tx.hash}>{shortHex(tx.hash)}</p>
                </Link>
                <button
                  type="button"
                  onClick={() => copy(tx.hash, 'wallet.identity.txHashCopied')}
                  className="shrink-0 rounded-lg p-1.5 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={t('wallet.identity.copyTransaction', { label: tx.label })}
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {identity.id && ['DEPLOYED', 'REGISTERED', 'RECOVERED'].includes(identity.status) && (
        <button
          type="button"
          onClick={reconcile}
          disabled={reconciling}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${reconciling ? 'animate-spin' : ''}`} aria-hidden="true" />
          {reconciling ? t('wallet.identity.checkingPublicChain') : t('wallet.identity.refreshIdentity')}
        </button>
      )}

      {identity.account_address && (
        <Link
          to="/status"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {t('wallet.identity.viewNetworkStatus')}
        </Link>
      )}
    </div>
  );
}