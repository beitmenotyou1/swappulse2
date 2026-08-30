import React, { useEffect, useState } from 'react';
import { CheckCircle2, Fingerprint, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { createDeviceTestSigner, getDeviceTestSigner } from '@/lib/testnetSignerVault';
import useChainProvisioning, { signerMatchesIdentity } from '@/hooks/useChainProvisioning';
import { isChainAuthoritative } from '@/lib/chainIdentityDisplay';

export default function SmartAccountSetup({ status, onReload }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [deviceSigner, setDeviceSigner] = useState(null);
  const [creatingSigner, setCreatingSigner] = useState(false);
  const [preparing, setPreparing] = useState(false);

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

  const signerBound = signerMatchesIdentity(identity, deviceSigner);
  const { autoSetup, setupStep, secureIdentity } = useChainProvisioning({
    identity,
    userId: user?.id,
    onReload,
  });

  const steps = [
    { num: 1, label: 'Age eligibility', done: eligible, blocked: !age?.declared },
    { num: 2, label: 'Network ready', done: networkReady, blocked: age?.declared && !eligible },
    { num: 3, label: 'Create device signer', done: Boolean(deviceSigner), blocked: !networkReady },
    { num: 4, label: 'Reserve identity', done: Boolean(identity), blocked: !deviceSigner },
    { num: 5, label: 'Secure on chain', done: isChainAuthoritative(identity?.status), blocked: !identity },
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

      {/* A device holding a different signer cannot produce a valid signature for
          this identity — offering the button would guarantee a failed setup. */}
      {identity && deviceSigner && !signerBound && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs">
          <p className="font-bold text-warning">This device holds a different signer</p>
          <p className="mt-1 text-muted-foreground">
            Your reserved identity is bound to a signer created on another device. Use the recovery process rather than replacing the signer here.
          </p>
        </div>
      )}

      {identity?.status === 'PENDING' && automationReady && signerBound && (
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

      {identity?.status === 'PENDING' && !automationReady && signerBound && (
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
          <p className="font-bold">Automatic setup unavailable</p>
          <p className="mt-1">The provisioning relay is not verified yet. Your reservation is safe — continue once the relay is configured.</p>
        </div>
      )}
    </div>
  );
}