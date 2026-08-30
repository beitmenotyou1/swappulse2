import React, { useEffect, useState } from 'react';
import { CheckCircle2, Fingerprint, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { createDeviceTestSigner, getDeviceTestSigner, signTestnetHash } from '@/lib/testnetSignerVault';

export default function SmartAccountSetup({ status, onReload }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [deviceSigner, setDeviceSigner] = useState(null);
  const [creatingSigner, setCreatingSigner] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [autoSetup, setAutoSetup] = useState(false);
  const [setupStep, setSetupStep] = useState('');

  useEffect(() => {
    if (user?.id) getDeviceTestSigner(user.id).then(setDeviceSigner).catch(() => setDeviceSigner(null));
  }, [user?.id]);

  const age = status?.age || {};
  const network = status?.network || {};
  const eligible = age?.eligible === true;
  const networkReady = network?.ready === true;
  const canPrepare = status?.can_prepare === true;
  const automationReady = status?.automation_ready === true;
  const identity = status?.identity || null;

  const createSigner = async () => {
    if (!user?.id) return;
    setCreatingSigner(true);
    try {
      const signer = await createDeviceTestSigner(user.id);
      setDeviceSigner(signer);
      toast({ title: 'Device signer created', description: 'Your private Stark key is encrypted in this browser.' });
    } catch (error) {
      toast({ title: 'Could not create signer', description: error?.message, variant: 'destructive' });
    } finally {
      setCreatingSigner(false);
    }
  };

  const prepare = async () => {
    if (!deviceSigner?.publicKey) return;
    setPreparing(true);
    try {
      await base44.functions.invoke('chain-identity-user', { action: 'prepare', public_key: deviceSigner.publicKey });
      await onReload();
      toast({ title: 'Identity reserved', description: 'Your public key was sent. The private key stays on this device.' });
    } catch (error) {
      toast({ title: 'Could not reserve identity', description: error?.response?.data?.error || error?.message, variant: 'destructive' });
    } finally {
      setPreparing(false);
    }
  };

  const invokeData = async (name, payload) => {
    const res = await base44.functions.invoke(name, payload);
    return res?.data || res;
  };

  const getDraft = (action) => invokeData('chain-tx-draft', { action, record_id: identity?.id });

  const signAndSubmitDraft = async (draft) => {
    if (draft?.already_complete) return draft;
    if (!user?.id || !draft?.transaction || !draft?.signing_hash || !draft?.draft_token) throw new Error('Incomplete transaction draft.');
    const signature = await signTestnetHash(user.id, draft.signing_hash);
    const transaction = { ...draft.transaction, signature: [signature.r, signature.s] };
    return invokeData('chain-tx-submit', { action: draft.action, record_id: identity.id, draft_token: draft.draft_token, transaction });
  };

  const waitForStep = async (action, attempts = 12) => {
    for (let i = 0; i < attempts; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1000));
      try {
        const draft = await getDraft(action);
        if (draft?.already_complete) return draft;
      } catch (error) {
        const code = error?.response?.data?.code || '';
        if (code !== 'ACCOUNT_NOT_READY' && i === attempts - 1) throw error;
      }
    }
    throw new Error('The testnet RPC has not confirmed the transaction yet.');
  };

  const secureIdentity = async () => {
    if (!identity?.id || !user?.id) return;
    setAutoSetup(true);
    setSetupStep('Preparing account deployment…');
    try {
      const deployDraft = await getDraft('deploy_account');
      if (!deployDraft?.already_complete) {
        setSetupStep('Signing account deployment…');
        await signAndSubmitDraft(deployDraft);
        setSetupStep('Waiting for deployment confirmation…');
        await waitForStep('deploy_account');
      }
      setSetupStep('Checking recovery configuration…');
      const recoveryDraft = await getDraft('configure_recovery');
      if (!recoveryDraft?.already_complete) {
        setSetupStep('Signing recovery settings…');
        await signAndSubmitDraft(recoveryDraft);
        setSetupStep('Waiting for recovery confirmation…');
        await waitForStep('configure_recovery');
      }
      setSetupStep('Registering identity…');
      await invokeData('chain-identity-register', { record_id: identity.id });
      setSetupStep('Verifying from chain state…');
      const reconciled = await invokeData('chain-identity-reconcile', { record_id: identity.id });
      const outcome = reconciled?.results?.[0]?.outcome || '';
      await onReload();
      if (!['REGISTERED', 'RECOVERED'].includes(outcome)) throw new Error(`Reconciliation returned ${outcome || 'no result'}.`);
      setSetupStep('Identity secured');
      toast({ title: 'Identity secured', description: 'Your account was signed, registered, and verified on chain.' });
    } catch (error) {
      toast({ title: 'Setup paused', description: error?.response?.data?.error || error?.message, variant: 'destructive' });
      await onReload().catch(() => {});
    } finally {
      setAutoSetup(false);
      setSetupStep('');
    }
  };

  const steps = [
    { num: 1, label: 'Age eligibility', done: eligible, blocked: !age?.declared },
    { num: 2, label: 'Network ready', done: networkReady, blocked: age?.declared && !eligible },
    { num: 3, label: 'Create device signer', done: Boolean(deviceSigner), blocked: !networkReady },
    { num: 4, label: 'Reserve identity', done: Boolean(identity), blocked: !deviceSigner },
    { num: 5, label: 'Secure on chain', done: ['REGISTERED', 'RECOVERED'].includes(identity?.status), blocked: !identity },
  ];

  return (
    <div className="space-y-5 py-2">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <Fingerprint className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-bold">Create your SwapPulse on-chain identity</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your Starknet Layer 3 identity gives you a self-custodial smart account. The private key never leaves this device.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.num} className={`flex items-center gap-3 rounded-lg border p-3 ${step.done ? 'border-success/20 bg-success/5' : step.blocked ? 'border-border bg-secondary/30 opacity-60' : 'border-border bg-card'}`}>
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step.done ? 'bg-success text-success-foreground' : 'bg-secondary text-muted-foreground'}`}>
              {step.done ? <CheckCircle2 className="h-4 w-4" /> : step.num}
            </div>
            <span className="flex-1 text-sm font-medium">{step.label}</span>
          </div>
        ))}
      </div>

      {!age?.declared && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs">
          <p className="font-bold text-warning">Age verification required</p>
          <p className="mt-1 text-muted-foreground">Set your age band in Settings before creating a testnet identity.</p>
        </div>
      )}

      {age?.declared && !eligible && (
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
          <p className="font-bold">Not eligible</p>
          <p className="mt-1">Blockchain identity features require an 18+ account.</p>
        </div>
      )}

      {eligible && !networkReady && (
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
          <p className="font-bold">Testnet not ready</p>
          <p className="mt-1">The SwapPulse Testnet is not currently verified for new identities. Check back later.</p>
        </div>
      )}

      {eligible && networkReady && !deviceSigner && (
        <button onClick={createSigner} disabled={creatingSigner} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {creatingSigner ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {creatingSigner ? 'Creating signer…' : 'Create Device Signer'}
        </button>
      )}

      {deviceSigner && canPrepare && !identity && (
        <button onClick={prepare} disabled={preparing} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {preparing ? 'Reserving…' : 'Reserve Test Identity'}
        </button>
      )}

      {identity?.status === 'PENDING' && automationReady && (
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
          <button onClick={secureIdentity} disabled={autoSetup} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {autoSetup ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {autoSetup ? 'Securing…' : 'Secure My Identity'}
          </button>
          {autoSetup && setupStep && (
            <p className="mt-2 text-center text-xs font-medium text-primary" role="status" aria-live="polite">{setupStep}</p>
          )}
        </div>
      )}

      {identity?.status === 'PENDING' && !automationReady && (
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
          <p className="font-bold">Automatic setup unavailable</p>
          <p className="mt-1">The provisioning relay is not verified yet. Your reservation is safe — continue once the relay is configured.</p>
        </div>
      )}
    </div>
  );
}