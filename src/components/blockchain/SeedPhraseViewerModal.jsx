import React, { useState, useEffect } from 'react';
import { Mail, Smartphone, Fingerprint, KeyRound, Loader2, ShieldCheck, Send, ArrowLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { startAuthentication } from '@simplewebauthn/browser';

// Unified seed phrase verification modal. Lets the collector choose how to
// verify before revealing their 24-word recovery phrase:
//   - Email code (one-time code sent to their registered email, 60s TTL)
//   - Authenticator app (TOTP, reuses the 2FA secret)
//   - Passkey (WebAuthn, if enrolled)
//   - PIN (if set)
// On successful verification, calls onSuccess with the decrypted mnemonic.
export default function SeedPhraseViewerModal({ wallet, open, onClose, onSuccess }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [method, setMethod] = useState(null);
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const hasPasskey = wallet?.has_passkey;
  const hasPin = wallet?.has_pin;
  const has2FA = user?.data?.two_factor_enabled || user?.two_factor_enabled;
  const email = user?.email;

  useEffect(() => {
    if (open) {
      setMethod(null);
      setCode('');
      setPin('');
      setCodeSent(false);
      setVerifying(false);
      setSendingCode(false);
    }
  }, [open]);

  const sendEmailCode = async () => {
    setSendingCode(true);
    try {
      const res = await base44.functions.invoke('send-seed-phrase-code', {});
      if (res.data?.error) {
        toast({ title: 'Failed to send code', description: res.data.error, variant: 'destructive' });
        return;
      }
      setCodeSent(true);
      toast({ title: 'Code sent', description: `Check your email at ${email}` });
    } catch (e) {
      toast({ title: 'Failed to send code', description: e.message, variant: 'destructive' });
    } finally {
      setSendingCode(false);
    }
  };

  const verify = async (credential) => {
    setVerifying(true);
    try {
      const res = await base44.functions.invoke('view-seed-phrase', { unlockCredential: credential });
      if (res.data?.error) {
        toast({ title: 'Verification failed', description: res.data.error, variant: 'destructive' });
        return;
      }
      onSuccess(res.data.mnemonic);
      onClose();
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      toast({ title: 'Verification failed', description: msg, variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  };

  const doPasskeyAuth = async () => {
    setVerifying(true);
    try {
      const res = await base44.functions.invoke('get-wallet-unlock-options', {});
      const { options, challenge, challenge_signature } = res.data;
      const assertion = await startAuthentication(options);
      await verify({ type: 'passkey', assertion, challenge, challenge_signature });
    } catch (e) {
      if (e.name !== 'NotAllowedError') {
        toast({ title: 'Passkey failed', description: e.message, variant: 'destructive' });
      }
    } finally {
      setVerifying(false);
    }
  };

  // Auto-trigger passkey if that's the method chosen
  useEffect(() => {
    if (method === 'passkey' && !verifying) {
      doPasskeyAuth();
    }
  }, [method]);

  const methods = [
    { key: 'email', label: 'Email Code', icon: Mail, desc: `Send a code to ${email || 'your email'}`, available: !!email },
    { key: 'totp', label: 'Authenticator App', icon: Smartphone, desc: 'Enter a code from your authenticator', available: !!has2FA },
    { key: 'passkey', label: 'Passkey', icon: Fingerprint, desc: 'Use Face ID / Touch ID / security key', available: !!hasPasskey },
    { key: 'pin', label: 'PIN', icon: KeyRound, desc: 'Enter your wallet PIN', available: !!hasPin },
  ].filter((m) => m.available);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            View Seed Phrase
          </DialogTitle>
          <DialogDescription>
            Verify your identity to reveal your 24-word recovery phrase.
          </DialogDescription>
        </DialogHeader>

        {verifying ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verifying...</p>
          </div>
        ) : !method ? (
          <div className="space-y-2">
            {methods.map((m) => (
              <button
                key={m.key}
                onClick={() => setMethod(m.key)}
                className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition hover:bg-secondary"
              >
                <m.icon className="h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-bold">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </div>
              </button>
            ))}
            {methods.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No verification methods available. Contact support.
              </p>
            )}
          </div>
        ) : method === 'email' ? (
          <div className="space-y-4">
            <button onClick={() => { setMethod(null); setCodeSent(false); setCode(''); }} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            {!codeSent ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  We'll send a 6-digit code to <strong>{email}</strong>. The code expires in 60 seconds.
                </p>
                <button
                  onClick={sendEmailCode}
                  disabled={sendingCode}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {sendingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {sendingCode ? 'Sending...' : 'Send Code'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-center text-sm font-semibold">Enter the 6-digit code</p>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={code} onChange={(v) => setCode(v)}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <button
                  onClick={() => verify({ type: 'email_code', code })}
                  disabled={code.length !== 6}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  Verify
                </button>
                <button onClick={sendEmailCode} disabled={sendingCode} className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground">
                  Resend code
                </button>
              </div>
            )}
          </div>
        ) : method === 'totp' ? (
          <div className="space-y-4">
            <button onClick={() => { setMethod(null); setCode(''); }} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <p className="text-center text-sm font-semibold">Enter the 6-digit code from your authenticator app</p>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={(v) => setCode(v)}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <button
              onClick={() => verify({ type: 'totp', code })}
              disabled={code.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              Verify
            </button>
          </div>
        ) : method === 'pin' ? (
          <div className="space-y-4">
            <button onClick={() => { setMethod(null); setPin(''); }} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <p className="text-center text-sm font-semibold">Enter your wallet PIN</p>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={pin} onChange={(v) => setPin(v)}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <button
              onClick={() => verify({ type: 'pin', pin })}
              disabled={pin.length < 4}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              Verify
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}