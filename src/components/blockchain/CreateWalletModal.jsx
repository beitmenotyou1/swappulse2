import React, { useState } from 'react';
import { Wallet, Loader2, Fingerprint, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { startRegistration } from '@simplewebauthn/browser';
import SeedPhraseModal from './SeedPhraseModal';

// Handles the full wallet creation flow:
// 1. Calls create-custodial-wallet to generate the keypair
// 2. Shows the seed phrase (SeedPhraseModal)
// 3. Prompts to enroll a passkey (optional but recommended)
// 4. Closes and notifies the parent to refresh
export default function CreateWalletModal({ onClose }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState('intro'); // 'intro' | 'creating' | 'seed' | 'passkey' | 'done'
  const [mnemonic, setMnemonic] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [enrollingPasskey, setEnrollingPasskey] = useState(false);

  const handleCreate = async () => {
    setStep('creating');
    try {
      const res = await base44.functions.invoke('create-custodial-wallet', {});
      setMnemonic(res.data.mnemonic);
      setWalletAddress(res.data.wallet.address);
      setStep('seed');
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      toast({ title: 'Wallet creation failed', description: msg, variant: 'destructive' });
      setStep('intro');
    }
  };

  const handleSeedConfirmed = () => {
    setStep('passkey');
  };

  const handleEnrollPasskey = async () => {
    setEnrollingPasskey(true);
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
      toast({ title: 'Passkey added', description: 'Your wallet is now secured by your device.' });
      setStep('done');
    } catch (e) {
      if (e.name !== 'NotAllowedError') {
        toast({ title: 'Passkey setup failed', description: e.message, variant: 'destructive' });
      }
      // Allow skipping even if passkey enrollment fails
    } finally {
      setEnrollingPasskey(false);
    }
  };

  const handleSkipPasskey = () => {
    setStep('done');
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        {step === 'intro' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Create Your SwapPulse Wallet
              </DialogTitle>
              <DialogDescription>
                Your SwapPulse account becomes your Polygon wallet. No browser extensions needed —
                we'll generate and securely store your keys.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">What you'll get:</p>
                <ul className="mt-1.5 space-y-1">
                  <li>• A Polygon wallet address for receiving crypto and NFTs</li>
                  <li>• A 24-word recovery phrase (write it down!)</li>
                  <li>• Optional passkey protection (Face ID / Touch ID)</li>
                </ul>
              </div>
              <Button onClick={handleCreate} className="w-full" size="lg">
                Create My Wallet
              </Button>
            </div>
          </>
        )}

        {step === 'creating' && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Generating your wallet...</p>
          </div>
        )}

        {step === 'seed' && (
          <SeedPhraseModal
            open={true}
            mnemonic={mnemonic}
            title="Your Recovery Phrase"
            onClose={handleSeedConfirmed}
          />
        )}

        {step === 'passkey' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5 text-primary" />
                Secure Your Wallet
              </DialogTitle>
              <DialogDescription>
                Add a passkey so only you can authorize transactions. Your device (Face ID, Touch ID,
                or security key) will be required to mint or transfer NFTs.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Button
                onClick={handleEnrollPasskey}
                disabled={enrollingPasskey}
                className="w-full"
                size="lg"
              >
                {enrollingPasskey ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Waiting for device...</>
                ) : (
                  <><Fingerprint className="h-4 w-4 mr-2" /> Add Passkey</>
                )}
              </Button>
              <button
                onClick={handleSkipPasskey}
                className="w-full text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Skip for now (less secure)
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-success" />
                Wallet Ready!
              </DialogTitle>
              <DialogDescription>
                Your SwapPulse wallet is set up and ready to use.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Wallet Address</p>
                <p className="mt-0.5 break-all font-mono text-xs">{walletAddress}</p>
              </div>
              <Button onClick={handleClose} className="w-full" size="lg">
                Go to Wallet <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}