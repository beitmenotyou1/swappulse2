import React, { useEffect, useState } from 'react';
import { BadgeCheck, Clock3, Loader2, RefreshCw, ShieldOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

function shortHex(value) {
  const raw = String(value || '');
  if (raw.length <= 18) return raw || '—';
  return `${raw.slice(0, 10)}…${raw.slice(-8)}`;
}

export default function V2VerificationTestSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState('');
  const [recordId, setRecordId] = useState('');
  const [identity, setIdentity] = useState(null);
  const [ageStatus, setAgeStatus] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [chainRes, ageRes] = await Promise.all([
        base44.functions.invoke('chain-identity-user', { action: 'status' }),
        base44.functions.invoke('age-status', { action: 'get' }),
      ]);
      const chainData = chainRes?.data || chainRes || {};
      const ageData = ageRes?.data || ageRes || {};
      const currentIdentity = chainData?.identity || null;
      setIdentity(currentIdentity);
      setAgeStatus(ageData?.status || null);
      if (currentIdentity?.id && !recordId) setRecordId(currentIdentity.id);
    } catch (error) {
      toast({
        title: 'V2 verifier test state unavailable',
        description: error?.response?.data?.error || error?.message || 'Could not load verification state.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const reconcile = async (targetRecordId = recordId) => {
    if (!targetRecordId) return null;
    const res = await base44.functions.invoke('chain-identity-reconcile', { record_id: targetRecordId });
    const data = res?.data || res || {};
    return data?.results?.[0] || null;
  };

  const runTest = async (action, expiresInSeconds) => {
    if (!recordId || running) return;
    setRunning(action === 'revoke' ? 'revoke' : String(expiresInSeconds));
    setLastResult(null);
    try {
      const res = await base44.functions.invoke('chain-verification-test', {
        action,
        record_id: recordId,
        ...(action === 'attest' ? { expires_in_seconds: expiresInSeconds } : {}),
      });
      const data = res?.data || res || {};
      const chain = await reconcile(recordId);
      setLastResult({ test: data, chain });
      await load();
      toast({
        title: action === 'revoke' ? 'Test V2 attestation revoked' : 'Test V2 attestation reconciled',
        description: action === 'revoke'
          ? `Chain state: ${chain?.verification_status || chain?.outcome || 'checked'}.`
          : `Chain state: ${chain?.verification_status || 'checked'}, assurance ${data?.verification_type || 0}/${data?.verification_level || 0}.`,
      });
    } catch (error) {
      toast({
        title: 'V2 verification test failed',
        description: error?.response?.data?.error || error?.response?.data?.code || error?.message || 'Unknown test verifier error',
        variant: 'destructive',
      });
    } finally {
      setRunning('');
    }
  };

  const reconcileOnly = async () => {
    if (!recordId || running) return;
    setRunning('reconcile');
    try {
      const chain = await reconcile(recordId);
      setLastResult((prev) => ({ ...(prev || {}), chain }));
      await load();
      toast({
        title: 'Verification state reconciled',
        description: `Chain verification: ${chain?.verification_status || chain?.outcome || 'checked'}.`,
      });
    } catch (error) {
      toast({
        title: 'Verification reconciliation failed',
        description: error?.response?.data?.error || error?.message || 'Unknown reconciliation error',
        variant: 'destructive',
      });
    } finally {
      setRunning('');
    }
  };

  const isAuthoritative = ['REGISTERED', 'RECOVERED', 'MERGED'].includes(String(identity?.status || ''));
  const currentIsTest = String(ageStatus?.verifier_event_id || '').startsWith('SWAPPULSE_TEST_VERIFIER:');

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-base">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <BadgeCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">V2 verification test harness</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin-only SwapPulse Testnet tooling. It uses the real V2 verifier role and blinded commitment pipeline, but marks the off-chain event as SWAPPULSE_TEST_VERIFIER. It is not a production third-party identity-verification result.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading registered Identity…
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-secondary/40 p-3">
              <p className="text-xs text-muted-foreground">Chain identity</p>
              <p className="mt-1 font-mono text-xs" title={identity?.chain_identity_id}>{shortHex(identity?.chain_identity_id)}</p>
            </div>
            <div className="rounded-lg bg-secondary/40 p-3">
              <p className="text-xs text-muted-foreground">Identity status</p>
              <p className="mt-1 text-sm font-semibold">{identity?.status || 'Not found'}</p>
            </div>
            <div className="rounded-lg bg-secondary/40 p-3">
              <p className="text-xs text-muted-foreground">Chain verification</p>
              <p className="mt-1 text-sm font-semibold">{identity?.verification_status || 'NONE'}</p>
              {Number(identity?.verification_level || 0) > 0 && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">Type {identity.verification_type} · Level {identity.verification_level}</p>
              )}
            </div>
            <div className="rounded-lg bg-secondary/40 p-3">
              <p className="text-xs text-muted-foreground">Private verifier</p>
              <p className="mt-1 text-sm font-semibold">{ageStatus?.verifier_status || 'NONE'}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{currentIsTest ? 'Synthetic test verifier' : ageStatus?.age_method || 'SELF_DECLARED'}</p>
            </div>
          </div>

          <label className="mt-4 block text-xs font-semibold text-muted-foreground">
            Target ChainIdentity record ID
            <input
              value={recordId}
              onChange={(e) => setRecordId(e.target.value.trim())}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
              placeholder="Base44 ChainIdentity record ID"
            />
          </label>

          {!isAuthoritative && (
            <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-muted-foreground">
              A chain-authoritative REGISTERED, RECOVERED or MERGED Identity is required before V2 attestation testing.
            </div>
          )}

          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => runTest('attest', 3600)}
              disabled={!recordId || !isAuthoritative || Boolean(running)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              {running === '3600' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />}
              Issue 1-hour test attestation
            </button>
            <button
              type="button"
              onClick={() => runTest('attest', 120)}
              disabled={!recordId || !isAuthoritative || Boolean(running)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
            >
              {running === '120' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock3 className="h-3.5 w-3.5" />}
              Issue 2-minute expiry test
            </button>
            <button
              type="button"
              onClick={() => runTest('revoke')}
              disabled={!recordId || !isAuthoritative || !currentIsTest || Boolean(running)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              {running === 'revoke' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
              Revoke current test attestation
            </button>
            <button
              type="button"
              onClick={reconcileOnly}
              disabled={!recordId || Boolean(running)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
            >
              {running === 'reconcile' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Reconcile verification state
            </button>
          </div>

          {lastResult && (
            <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-3 text-xs">
              <p className="font-semibold">Last test result</p>
              <p className="mt-1 text-muted-foreground">
                Action: {lastResult?.test?.action || 'reconcile'} · Chain: {lastResult?.chain?.verification_status || lastResult?.chain?.outcome || 'checked'}
              </p>
              {lastResult?.test?.transaction_hash && (
                <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">Tx {lastResult.test.transaction_hash}</p>
              )}
              {lastResult?.test?.expires_at && (
                <p className="mt-1 text-muted-foreground">Expires {new Date(lastResult.test.expires_at).toLocaleString()}</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
