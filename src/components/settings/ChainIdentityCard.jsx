import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, ChevronDown, ChevronUp, Fingerprint, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

function shortHex(value) {
  if (!value || value.length < 18) return value || '—';
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export default function ChainIdentityCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [advanced, setAdvanced] = useState(false);
  const [publicKey, setPublicKey] = useState('');
  const [preparing, setPreparing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('chain-identity-user', { action: 'status' });
      setStatus(res?.data || res || null);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const identity = status?.identity || null;
  const age = status?.age || {};
  const network = status?.network || {};
  const secured = ['REGISTERED', 'RECOVERED'].includes(identity?.status);
  const inProgress = ['PENDING', 'DEPLOYED', 'RECOVERY_PENDING'].includes(identity?.status);
  const eligible = age?.eligible === true;
  const networkReady = network?.ready === true;
  const canPrepare = status?.can_prepare === true;

  const prepare = async () => {
    const key = publicKey.trim();
    if (!key) return;
    setPreparing(true);
    try {
      const res = await base44.functions.invoke('chain-identity-user', { action: 'prepare', public_key: key });
      const data = res?.data || res;
      setStatus((prev) => ({ ...(prev || {}), identity: data?.identity || prev?.identity, can_prepare: false }));
      setPublicKey('');
      toast({
        title: data?.existing ? 'Test identity already reserved' : 'Test identity reserved',
        description: 'Only your public Stark key was sent to SwapPulse. Deployment/signing remains outside Base44.',
      });
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Could not reserve test identity.';
      toast({ title: 'Identity setup blocked', description: message, variant: 'destructive' });
    } finally {
      setPreparing(false);
    }
  };

  let title = 'SwapPulse Network identity';
  let description = 'Blockchain identity is being rolled out gradually on the private testnet.';
  if (loading) {
    title = 'Checking identity…';
    description = 'Checking testnet eligibility and identity status.';
  } else if (secured) {
    title = 'Identity secured';
    description = 'Your permanent SwapPulse identity is recorded on the test network. You do not need to manage gas or network settings.';
  } else if (inProgress) {
    title = 'Identity setup in progress';
    description = identity?.status === 'PENDING'
      ? 'Your identity and public signer key are reserved. The testnet operator still needs to deploy and register the account.'
      : 'Your testnet identity is being verified against the chain before it becomes authoritative.';
  } else if (!age?.declared) {
    description = 'Choose your age band above before SwapPulse can determine whether testnet identity features are available.';
  } else if (!eligible) {
    description = 'Blockchain identity and wallet features are not available for under-18 accounts.';
  } else if (!networkReady) {
    description = 'You are eligible for the testnet, but the SwapPulse Testnet is not currently verified and ready for new identities.';
  } else {
    title = 'Eligible for SwapPulse Testnet';
    description = 'You can reserve a test identity using a Stark public key generated locally. SwapPulse never needs the private key.';
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-full p-2 ${secured ? 'bg-success/10 text-success' : eligible && networkReady ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : secured ? <CheckCircle2 className="h-4 w-4" /> : eligible && networkReady ? <ShieldCheck className="h-4 w-4" /> : <Fingerprint className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      {canPrepare && !identity && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-start gap-2">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold">Experimental test signer</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Paste a Stark <b>public key only</b> generated locally by the SwapPulse test signer tooling. Never paste a private key, seed phrase or passkey secret here.
              </p>
              <label htmlFor="swappulse-stark-public-key" className="mt-2 block text-xs font-semibold">Stark public key</label>
              <input
                id="swappulse-stark-public-key"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={prepare}
                disabled={preparing || !publicKey.trim()}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                {preparing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {preparing ? 'Reserving…' : 'Reserve Test Identity'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <p className="text-muted-foreground">Public signer key</p>
                <p className="font-mono" title={identity.signer_public_key}>{shortHex(identity.signer_public_key)}</p>
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
