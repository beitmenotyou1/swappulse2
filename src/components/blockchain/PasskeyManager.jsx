import React, { useState } from 'react';
import { Fingerprint, Loader2, Plus, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { startRegistration } from '@simplewebauthn/browser';

// Manages wallet passkeys: shows count and allows adding new passkeys.
// Passkeys are stored in WebAuthnCredential and referenced by ID in the
// CustodialWallet's passkey_credential_ids array.
export default function PasskeyManager({ wallet, onUpdated }) {
  const { toast } = useToast();
  const [enrolling, setEnrolling] = useState(false);

  const handleAdd = async () => {
    setEnrolling(true);
    try {
      const optsRes = await base44.functions.invoke('add-wallet-passkey', { phase: 'options' });
      const attestation = await startRegistration(optsRes.data.options);
      await base44.functions.invoke('add-wallet-passkey', {
        phase: 'verify',
        attestation,
        challenge: optsRes.data.challenge,
        challenge_signature: optsRes.data.challenge_signature,
        label: 'Wallet Passkey',
      });
      toast({ title: 'Passkey added', description: 'Your wallet is now secured by this device.' });
      if (onUpdated) onUpdated();
    } catch (e) {
      if (e.name !== 'NotAllowedError') {
        toast({ title: 'Passkey setup failed', description: e.message, variant: 'destructive' });
      }
    } finally {
      setEnrolling(false);
    }
  };

  const count = wallet.passkey_credential_ids?.length || 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Fingerprint className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Wallet Passkeys</h3>
        {count > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
            <Check className="h-3 w-3" /> {count} {count === 1 ? 'passkey' : 'passkeys'}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Passkeys let your device (Face ID, Touch ID, or security key) authorize wallet transactions.
        Add multiple devices for backup recovery.
      </p>
      <button
        onClick={handleAdd}
        disabled={enrolling}
        className="mt-3 flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
      >
        {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {count > 0 ? 'Add Another Passkey' : 'Add Passkey'}
      </button>
    </div>
  );
}