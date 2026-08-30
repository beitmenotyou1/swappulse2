import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Copy, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

function shortHex(v) {
  if (!v || v.length < 18) return v || '—';
  return `${v.slice(0, 10)}…${v.slice(-8)}`;
}

const STATUS_CONFIG = {
  REGISTERED: { label: 'Secured on chain', bgClass: 'bg-success/10', textClass: 'text-success', Icon: CheckCircle2 },
  RECOVERED: { label: 'Recovered', bgClass: 'bg-success/10', textClass: 'text-success', Icon: ShieldCheck },
  DEPLOYED: { label: 'Deployed, pending verification', bgClass: 'bg-primary/10', textClass: 'text-primary', Icon: Clock },
  PENDING: { label: 'Reservation pending', bgClass: 'bg-warning/10', textClass: 'text-warning', Icon: Clock },
  FAILED: { label: 'Setup failed', bgClass: 'bg-destructive/10', textClass: 'text-destructive', Icon: AlertCircle },
  RECOVERY_PENDING: { label: 'Recovery in progress', bgClass: 'bg-warning/10', textClass: 'text-warning', Icon: RefreshCw },
};

export default function WalletDashboard({ status, onReload }) {
  const { toast } = useToast();
  const [reconciling, setReconciling] = useState(false);
  const identity = status?.identity || {};
  const network = status?.network || {};
  const cfg = STATUS_CONFIG[identity.status] || STATUS_CONFIG.PENDING;
  const { Icon, bgClass, textClass, label } = cfg;

  const copy = async (value, label) => {
    try { await navigator.clipboard.writeText(value); toast({ title: `${label} copied` }); }
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
        title: ['REGISTERED', 'RECOVERED'].includes(outcome) ? 'Identity verified on chain' : 'Chain check completed',
        description: ['REGISTERED', 'RECOVERED'].includes(outcome) ? 'Your identity is chain-authoritative.' : `Chain result: ${outcome}`,
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
  ].filter((t) => t.hash);

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
        </div>
      </div>

      {identity.account_address && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground">Smart account address</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-sm">{identity.account_address}</code>
            <button onClick={() => copy(identity.account_address, 'Address')} className="shrink-0 rounded-lg p-2 hover:bg-secondary">
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Identity ID</p>
          <p className="mt-1 truncate font-mono text-sm" title={identity.chain_identity_id}>{shortHex(identity.chain_identity_id)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Recoveries</p>
          <p className="mt-1 font-mono text-sm">{identity.recovery_count || 0}</p>
        </div>
      </div>

      {txs.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground">Transaction history</p>
          <div className="mt-2 space-y-2">
            {txs.map((tx) => (
              <div key={tx.hash} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{tx.label}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground" title={tx.hash}>{shortHex(tx.hash)}</p>
                </div>
                <button onClick={() => copy(tx.hash, 'Tx hash')} className="shrink-0 rounded-lg p-1.5 hover:bg-secondary">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {identity.status === 'DEPLOYED' && (
        <button
          onClick={reconcile}
          disabled={reconciling}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${reconciling ? 'animate-spin' : ''}`} />
          {reconciling ? 'Verifying on chain…' : 'Verify on Chain'}
        </button>
      )}

      {identity.account_address && (
        <a
          href={`${window.location.origin}/status`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" /> View network status
        </a>
      )}
    </div>
  );
}