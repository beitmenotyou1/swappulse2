import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { signTestnetHash } from '@/lib/testnetSignerVault';

// One shared draft → sign-on-device → submit flow for every collector-signed
// chain action (staking, bridging). The private key never leaves the browser:
// the server drafts the transaction, this device signs the hash, and the server
// verifies the signature and relays only the calls it drafted.

async function invokeData(name, payload) {
  const res = await base44.functions.invoke(name, payload);
  return res?.data || res;
}

export default function useChainAction({ userId, onDone }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');

  const run = async (action, params, labels = {}) => {
    if (!userId) {
      toast({ title: 'Sign in required', variant: 'destructive' });
      return null;
    }

    setBusy(true);
    setStep(labels.preparing || 'Preparing…');
    try {
      const draft = await invokeData('chain-action-draft', { action, ...params });
      if (!draft?.transaction || !draft?.signing_hash || !draft?.draft_token) {
        throw new Error('SwapPulse returned an incomplete transaction draft.');
      }

      setStep(labels.signing || 'Confirming on this device…');
      const signature = await signTestnetHash(userId, draft.signing_hash);

      setStep(labels.submitting || 'Finalising…');
      const result = await invokeData('chain-action-submit', {
        action,
        record_id: draft.record_id,
        draft_token: draft.draft_token,
        transaction: { ...draft.transaction, signature: [signature.r, signature.s] },
      });

      toast({ title: labels.success || 'Done', description: labels.successDescription || undefined });
      if (onDone) await onDone();
      return result;
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'The action could not be completed.';
      toast({ title: labels.failure || 'Action failed', description: message, variant: 'destructive' });
      return null;
    } finally {
      setBusy(false);
      setStep('');
    }
  };

  return { busy, step, run };
}