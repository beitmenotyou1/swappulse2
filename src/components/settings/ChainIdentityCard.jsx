import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, ChevronDown, ChevronUp, Fingerprint, Loader2 } from 'lucide-react';

function shortHex(value) {
  if (!value || value.length < 18) return value || '—';
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export default function ChainIdentityCard() {
  const [loading, setLoading] = useState(true);
  const [identity, setIdentity] = useState(null);
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke('get-my-chain-identity', {});
        if (!cancelled) setIdentity(res?.data?.identity || res?.identity || null);
      } catch {
        if (!cancelled) setIdentity(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const secured = ['REGISTERED', 'RECOVERED'].includes(identity?.status);
  const inProgress = ['PENDING', 'DEPLOYED', 'RECOVERY_PENDING'].includes(identity?.status);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-full p-2 ${secured ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground'}`}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : secured ? <CheckCircle2 className="h-4 w-4" /> : <Fingerprint className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            {loading ? 'Checking identity…' : secured ? 'Identity secured' : inProgress ? 'Identity setup in progress' : 'SwapPulse Network identity'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {secured
              ? 'Your permanent SwapPulse identity is recorded on the test network. You do not need to manage gas or network settings.'
              : inProgress
                ? 'Your testnet identity is being prepared. No action is required unless an administrator asks you to complete a test.'
                : 'Blockchain identity is being rolled out gradually on the private testnet. No action is required yet.'}
          </p>
        </div>
      </div>

      {identity && (
        <>
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {advanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Advanced blockchain details
          </button>
          {advanced && (
            <div className="mt-2 grid gap-2 rounded-lg bg-secondary/40 p-3 text-xs sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Network</p>
                <p className="font-mono">{identity.network || 'SWAPPULSE_TESTNET'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-mono">{identity.status}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Identity ID</p>
                <p className="font-mono" title={identity.chain_identity_id}>{shortHex(identity.chain_identity_id)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Account address</p>
                <p className="font-mono" title={identity.account_address}>{shortHex(identity.account_address)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Signer generation</p>
                <p className="font-mono">{identity.signer_version || 'STARK_V1'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Recoveries</p>
                <p className="font-mono">{identity.recovery_count || 0}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
