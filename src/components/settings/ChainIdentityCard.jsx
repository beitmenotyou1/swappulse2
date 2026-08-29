import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, ChevronDown, ChevronUp, Copy, Fingerprint, KeyRound, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { createDeviceTestSigner, getDeviceTestSigner } from '@/lib/testnetSignerVault';

function shortHex(value) {
  if (!value || value.length < 18) return value || '—';
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export default function ChainIdentityCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [deviceSigner, setDeviceSigner] = useState(null);
  const [advanced, setAdvanced] = useState(false);
  const [creatingSigner, setCreatingSigner] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [provisioningResult, setProvisioningResult] = useState('');
  const [importingResult, setImportingResult] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, signer] = await Promise.all([
        base44.functions.invoke('chain-identity-user', { action: 'status' }),
        user?.id ? getDeviceTestSigner(user.id).catch(() => null) : Promise.resolve(null),
      ]);
      setStatus(res?.data || res || null);
      setDeviceSigner(signer);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const identity = status?.identity || null;
  const age = status?.age || {};
  const network = status?.network || {};
  const secured = ['REGISTERED', 'RECOVERED'].includes(identity?.status);
  const inProgress = ['PENDING', 'DEPLOYED', 'RECOVERY_PENDING'].includes(identity?.status);
  const eligible = age?.eligible === true;
  const networkReady = network?.ready === true;
  const canPrepare = status?.can_prepare === true;
  const signerMatchesIdentity = Boolean(
    identity?.signer_public_key
    && deviceSigner?.publicKey
    && identity.signer_public_key.toLowerCase() === deviceSigner.publicKey.toLowerCase(),
  );

  const createSigner = async () => {
    if (!user?.id) return;
    setCreatingSigner(true);
    try {
      const signer = await createDeviceTestSigner(user.id);
      setDeviceSigner(signer);
      toast({
        title: 'Device test signer created',
        description: 'The private Stark key is encrypted in this browser. Only its public key can be sent to SwapPulse.',
      });
    } catch (error) {
      toast({
        title: 'Could not create device signer',
        description: error?.message || 'Secure local key storage is unavailable.',
        variant: 'destructive',
      });
    } finally {
      setCreatingSigner(false);
    }
  };

  const prepare = async () => {
    const publicKey = deviceSigner?.publicKey;
    if (!publicKey) return;
    setPreparing(true);
    try {
      const res = await base44.functions.invoke('chain-identity-user', { action: 'prepare', public_key: publicKey });
      const data = res?.data || res;
      await load();
      toast({
        title: data?.existing ? 'Test identity already reserved' : 'Test identity reserved',
        description: 'Only your public Stark key was sent to SwapPulse. The encrypted private key remains on this device.',
      });
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Could not reserve test identity.';
      toast({ title: 'Identity setup blocked', description: message, variant: 'destructive' });
    } finally {
      setPreparing(false);
    }
  };

  const copyProvisioningRequest = async () => {
    if (!status?.provisioning) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(status.provisioning, null, 2));
      toast({ title: 'Provisioning request copied', description: 'This JSON contains public testnet data only.' });
    } catch {
      toast({ title: 'Could not copy provisioning request', variant: 'destructive' });
    }
  };

  const importProvisioningResult = async () => {
    if (!identity?.id || !provisioningResult.trim()) return;
    setImportingResult(true);
    try {
      await base44.functions.invoke('chain-identity-user', {
        action: 'import_provisioning_result',
        record_id: identity.id,
        result: provisioningResult,
      });
      setProvisioningResult('');
      await load();
      toast({
        title: 'Deployment recorded',
        description: 'The public provisioning result was accepted. Verify it on chain before the identity becomes authoritative.',
      });
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Could not import the provisioning result.';
      toast({ title: 'Provisioning result rejected', description: message, variant: 'destructive' });
    } finally {
      setImportingResult(false);
    }
  };

  const reconcileIdentity = async () => {
    if (!identity?.id) return;
    setReconciling(true);
    try {
      const res = await base44.functions.invoke('chain-identity-reconcile', { record_id: identity.id });
      const data = res?.data || res;
      const outcome = data?.results?.[0]?.outcome || 'CHECKED';
      await load();
      toast({
        title: ['REGISTERED', 'RECOVERED'].includes(outcome) ? 'Identity verified on chain' : 'Chain check completed',
        description: ['REGISTERED', 'RECOVERED'].includes(outcome)
          ? 'Your SwapPulse identity is now chain-authoritative.'
          : `Chain result: ${outcome}`,
      });
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Could not verify the identity on chain.';
      toast({ title: 'Chain verification failed', description: message, variant: 'destructive' });
    } finally {
      setReconciling(false);
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
    description = 'Create a device-local test signer, then reserve your permanent testnet identity. SwapPulse never receives the private key.';
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
              <p className="text-xs font-bold">Device test signer</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Testnet only. The Stark private key is encrypted in this browser with a non-extractable WebCrypto key and is never uploaded to Base44. Clearing this site's browser data can remove the test signer and may require account recovery.
              </p>
              {!deviceSigner ? (
                <button
                  type="button"
                  onClick={createSigner}
                  disabled={creatingSigner}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-background px-3 py-2 text-xs font-bold text-primary disabled:opacity-50"
                >
                  {creatingSigner && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {creatingSigner ? 'Creating signer…' : 'Create Device Test Signer'}
                </button>
              ) : (
                <div className="mt-2">
                  <div className="rounded-lg border border-border bg-background p-2 text-xs">
                    <p className="text-muted-foreground">Public Stark key</p>
                    <p className="mt-1 font-mono" title={deviceSigner.publicKey}>{shortHex(deviceSigner.publicKey)}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">Created {deviceSigner.createdAt ? new Date(deviceSigner.createdAt).toLocaleString() : 'on this device'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={prepare}
                    disabled={preparing}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {preparing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {preparing ? 'Reserving…' : 'Reserve Test Identity'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {identity && deviceSigner && !signerMatchesIdentity && (
        <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs">
          <p className="font-bold text-warning">This device holds a different test signer</p>
          <p className="mt-1 text-muted-foreground">Do not delete or replace the signer bound to your reserved identity. Use the recovery process before changing signer keys.</p>
        </div>
      )}

      {identity && signerMatchesIdentity && (
        <div className="mt-3 rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-xs text-success">
          This device holds the encrypted test signer bound to your identity.
        </div>
      )}

      {identity?.status === 'PENDING' && status?.provisioning && (
        <div className="mt-3 rounded-lg border border-border bg-secondary/30 p-3">
          <p className="text-xs font-bold">External testnet deployment</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Copy the public provisioning request for the SwapPulse testnet operator. It contains no private key. After deployment, paste the public provisioning-result JSON returned by the operator.
          </p>
          <button
            type="button"
            onClick={copyProvisioningRequest}
            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-secondary"
          >
            <Copy className="h-3.5 w-3.5" /> Copy Public Provisioning Request
          </button>
          <label htmlFor="swappulse-provisioning-result" className="mt-3 block text-xs font-semibold">Public provisioning result</label>
          <textarea
            id="swappulse-provisioning-result"
            value={provisioningResult}
            onChange={(e) => setProvisioningResult(e.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={'{\n  "schema_version": 1,\n  "kind": "SWAPPULSE_TEST_IDENTITY_PROVISIONING_RESULT",\n  ...\n}'}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11px] outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={importProvisioningResult}
            disabled={importingResult || !provisioningResult.trim()}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {importingResult && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {importingResult ? 'Checking result…' : 'Import Public Result'}
          </button>
        </div>
      )}

      {identity?.status === 'DEPLOYED' && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs font-bold">Deployment recorded, chain proof required</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            SwapPulse will read the verified public RPC and confirm the registry mapping, account class and reverse identity mapping before marking this identity secured.
          </p>
          <button
            type="button"
            onClick={reconcileIdentity}
            disabled={reconciling}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${reconciling ? 'animate-spin' : ''}`} />
            {reconciling ? 'Verifying on chain…' : 'Verify on Chain'}
          </button>
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
