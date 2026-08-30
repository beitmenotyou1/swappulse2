import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { signTestnetHash } from '@/lib/testnetSignerVault';
import { isChainAuthoritative } from '@/lib/chainIdentityDisplay';

// Single source of truth for the testnet provisioning flow. This logic was
// duplicated in ChainIdentityCard and SmartAccountSetup and had already drifted
// apart in two places (retry handling and the signer-binding guard), so both
// surfaces now share exactly one implementation.

export function signerMatchesIdentity(identity, deviceSigner) {
  return Boolean(
    identity?.signer_public_key
    && deviceSigner?.publicKey
    && identity.signer_public_key.toLowerCase() === deviceSigner.publicKey.toLowerCase(),
  );
}

async function invokeData(name, payload) {
  const res = await base44.functions.invoke(name, payload);
  return res?.data || res;
}

export default function useChainProvisioning({ identity, userId, onReload }) {
  const { toast } = useToast();
  const [autoSetup, setAutoSetup] = useState(false);
  const [setupStep, setSetupStep] = useState('');

  const getDraft = (action) => invokeData('chain-tx-draft', { action, record_id: identity?.id });

  const signAndSubmitDraft = async (draft) => {
    if (draft?.already_complete) return draft;
    if (!userId || !draft?.transaction || !draft?.signing_hash || !draft?.draft_token) {
      throw new Error('SwapPulse returned an incomplete testnet transaction draft.');
    }
    const signature = await signTestnetHash(userId, draft.signing_hash);
    const transaction = { ...draft.transaction, signature: [signature.r, signature.s] };
    return invokeData('chain-tx-submit', {
      action: draft.action,
      record_id: identity.id,
      draft_token: draft.draft_token,
      transaction,
    });
  };

  // Only ACCOUNT_NOT_READY is transient (the RPC has not yet seen the tx).
  // Every other failure is permanent and must surface immediately — retrying it
  // for 12s and then reporting "not confirmed yet" hides the real cause.
  const waitForStep = async (action, attempts = 12) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        const draft = await getDraft(action);
        if (draft?.already_complete) return draft;
      } catch (error) {
        if ((error?.response?.data?.code || '') !== 'ACCOUNT_NOT_READY') throw error;
      }
    }
    throw new Error('The public testnet RPC has not confirmed the transaction yet. Try again shortly.');
  };

  const secureIdentity = async () => {
    if (!identity?.id || !userId) return;
    setAutoSetup(true);
    setSetupStep('Preparing account deployment…');
    try {
      const deployDraft = await getDraft('deploy_account');
      if (!deployDraft?.already_complete) {
        setSetupStep('Signing account deployment on this device…');
        await signAndSubmitDraft(deployDraft);
        setSetupStep('Waiting for account deployment confirmation…');
        await waitForStep('deploy_account');
      }

      setSetupStep('Checking recovery configuration…');
      const recoveryDraft = await getDraft('configure_recovery');
      if (!recoveryDraft?.already_complete) {
        setSetupStep('Signing recovery settings on this device…');
        await signAndSubmitDraft(recoveryDraft);
        setSetupStep('Waiting for recovery settings confirmation…');
        await waitForStep('configure_recovery');
      }

      setSetupStep('Registering your identity…');
      await invokeData('chain-identity-register', { record_id: identity.id });
      setSetupStep('Verifying identity from public chain state…');
      const reconciled = await invokeData('chain-identity-reconcile', { record_id: identity.id });
      const outcome = reconciled?.results?.[0]?.outcome || '';
      await onReload();
      if (!isChainAuthoritative(outcome)) {
        throw new Error(`The chain registration completed, but final reconciliation returned ${outcome || 'no result'}.`);
      }
      setSetupStep('Identity secured');
      toast({
        title: 'Identity secured',
        description: 'Your account was signed on this device, registered on SwapPulse Testnet and independently verified from the public chain state.',
      });
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Could not complete automatic testnet identity setup.';
      await onReload().catch(() => {});
      toast({ title: 'Testnet setup paused', description: message, variant: 'destructive' });
    } finally {
      setAutoSetup(false);
      setSetupStep('');
    }
  };

  return { autoSetup, setupStep, secureIdentity };
}