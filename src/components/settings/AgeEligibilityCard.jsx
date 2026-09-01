import React, { useEffect, useState } from 'react';
import { BadgeCheck, CalendarRange, Clipboard, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const BANDS = [
  {
    value: '13_15',
    label: '13–15',
    description: 'Collection features only. No photo verification, public collection or blockchain identity.',
  },
  {
    value: '16_17',
    label: '16–17',
    description: 'Private collection and possession checks are available. No wallet or blockchain identity.',
  },
  {
    value: '18_PLUS',
    label: '18 or over',
    description: 'Eligible for the non-value-bearing SwapPulse Testnet identity and wallet rollout.',
  },
];

function statusCopy(status) {
  if (!status) return null;
  if (status.age_band === '18_PLUS') {
    if (status.value_features_eligible) {
      if (status.verifier_source === 'SWAPPULSE_TEST_VERIFIER') {
        return {
          title: 'Synthetic test verifier assertion active',
          description: 'This is a SwapPulse Testnet verification exercise, not a production third-party identity-verification result. Value-bearing features still require the matching ACTIVE attestation reconciled from the chain.',
          tone: 'text-warning',
        };
      }
      return {
        title: 'Private adult verification active',
        description: 'Your private verifier assertion is current. Value-bearing features still require the matching ACTIVE attestation reconciled from the chain.',
        tone: 'text-success',
      };
    }
    if (status.verifier_status === 'PENDING') {
      return {
        title: 'Private verification pending',
        description: 'Your non-value-bearing testnet identity remains available, but staking, bridging and Proof-of-Use stay locked until verification completes and the chain attestation is reconciled.',
        tone: 'text-primary',
      };
    }
    if (status.verifier_status === 'REVOKED' || status.verifier_status === 'EXPIRED') {
      return {
        title: status.verifier_status === 'REVOKED' ? 'Private verification revoked' : 'Private verification expired',
        description: 'Value-bearing features are locked. You can still use the non-value-bearing testnet identity under your 18+ declaration or start a new private verification.',
        tone: 'text-muted-foreground',
      };
    }
    return {
      title: 'Eligible for SwapPulse Testnet',
      description: 'Your 18+ declaration allows the non-value-bearing testnet identity and wallet. Value-bearing features require separate private verification plus an ACTIVE on-chain attestation.',
      tone: 'text-success',
    };
  }
  if (status.age_band === '16_17') {
    return {
      title: 'Private verification only',
      description: 'You can use private collection and possession-verification features, but wallet and blockchain identity features remain unavailable until 18+.',
      tone: 'text-primary',
    };
  }
  return {
    title: 'Collection features only',
    description: 'Wallet, blockchain identity, photo verification and public collection features remain unavailable for this age band.',
    tone: 'text-muted-foreground',
  };
}

export default function AgeEligibilityCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [verificationSession, setVerificationSession] = useState(null);
  const [startingVerification, setStartingVerification] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('age-status', { action: 'get' });
      const data = res?.data || res;
      setStatus(data?.status || null);
      setVerificationSession(data?.verification_session || null);
      setSelected(data?.status?.age_band || '');
    } catch {
      setStatus(null);
      setVerificationSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!selected || !confirmed || saving) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke('age-status', {
        action: 'declare',
        age_band: selected,
        confirm_age_band: true,
      });
      const data = res?.data || res;
      setStatus(data?.status || null);
      setVerificationSession(null);
      setEditing(false);
      setConfirmed(false);
      toast({ title: 'Age eligibility updated', description: 'SwapPulse saved your age band only, not your date of birth.' });
    } catch (error) {
      toast({
        title: 'Could not update age eligibility',
        description: error?.response?.data?.error || error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const startVerification = async () => {
    if (startingVerification) return;
    setStartingVerification(true);
    try {
      const res = await base44.functions.invoke('age-status', { action: 'start_verification' });
      const data = res?.data || res;
      setStatus(data?.status || status);
      setVerificationSession(data?.verification_session || null);
      toast({
        title: data?.idempotent ? 'Verifier reference already prepared' : 'Private verification prepared',
        description: 'SwapPulse created only an opaque reference. Do not send DOB, documents or raw identity evidence to SwapPulse.',
      });
    } catch (error) {
      toast({
        title: 'Could not prepare private verification',
        description: error?.response?.data?.error || error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setStartingVerification(false);
    }
  };

  const copyVerifierReference = async () => {
    const ref = verificationSession?.subject_ref;
    if (!ref) return;
    await navigator.clipboard?.writeText(ref);
    toast({ title: 'Verifier reference copied' });
  };

  const copy = statusCopy(status);
  const showForm = !status || editing;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarRange className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Age eligibility</p>
          <p className="mt-1 text-xs text-muted-foreground">
            SwapPulse stores only your age band for feature eligibility. We do not ask for or store your date of birth here.
          </p>
        </div>
      </div>

      {!loading && showForm && (
        <div className="mt-3 space-y-3">
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-muted-foreground">Select your age band</legend>
            {BANDS.map((band) => (
              <label
                key={band.value}
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${selected === band.value ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-secondary/50'}`}
              >
                <input
                  type="radio"
                  name="age-band"
                  value={band.value}
                  checked={selected === band.value}
                  onChange={() => { setSelected(band.value); setConfirmed(false); }}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  <span className="block text-sm font-semibold">{band.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{band.description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="flex items-start gap-2 rounded-lg bg-secondary/50 p-3 text-xs">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span>I confirm the selected age band is correct for me.</span>
          </label>

          <div className="flex gap-2">
            {status && (
              <button
                type="button"
                onClick={() => { setEditing(false); setSelected(status.age_band); setConfirmed(false); }}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={save}
              disabled={!selected || !confirmed || saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save age band'}
            </button>
          </div>
        </div>
      )}

      {!loading && status && !editing && copy && (
        <div className="mt-3 rounded-lg bg-secondary/40 p-3">
          <div className="flex items-center gap-2">
            {status.testnet_identity_eligible ? <BadgeCheck className="h-4 w-4 text-success" /> : <LockKeyhole className="h-4 w-4 text-muted-foreground" />}
            <p className={`text-sm font-semibold ${copy.tone}`}>{copy.title}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{copy.description}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">Age band: {BANDS.find((b) => b.value === status.age_band)?.label || status.age_band}</span>
            <button
              type="button"
              onClick={() => { setEditing(true); setSelected(status.age_band); setConfirmed(false); }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Change age band
            </button>
          </div>

          {status.age_band === '18_PLUS' && !status.value_features_eligible && (
            <div className="mt-3 border-t border-border pt-3">
              {status.verifier_status === 'PENDING' && verificationSession?.subject_ref ? (
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs font-semibold">Opaque verifier reference</p>
                  <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{verificationSession.subject_ref}</p>
                  <button
                    type="button"
                    onClick={copyVerifierReference}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <Clipboard className="h-3.5 w-3.5" /> Copy reference
                  </button>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Give only this reference to the configured private verifier. DOB, document scans and raw verifier evidence do not belong in SwapPulse or on-chain.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startVerification}
                  disabled={startingVerification}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                >
                  {startingVerification ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  {startingVerification ? 'Preparing…' : 'Prepare private verifier reference'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
