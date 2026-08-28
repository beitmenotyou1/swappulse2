import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Copy, Check, KeyRound, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SCOPES = [
  { value: 'read_only', label: 'Read-only', desc: 'Can read your data only — no writes' },
  { value: 'read_write', label: 'Read & write', desc: 'Can create and edit records — no account changes' },
  { value: 'full_access', label: 'Full access', desc: 'Can do everything except delete your account' },
];

export default function AppPasswordModal({ action, target, onClose, onSuccess }) {
  const [step, setStep] = useState(action === 'create' ? 'form' : 'code');
  const [label, setLabel] = useState('');
  const [scope, setScope] = useState('read_only');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  // Auto-send code for reveal/delete on open.
  useEffect(() => {
    if (action !== 'create' && target) {
      sendCode();
    }
     
  }, []);

  const sendCode = async () => {
    setSending(true);
    setError('');
    try {
      const res = await base44.functions.invoke('send-app-password-code', { action, target_id: target?.id });
      if (res?.data?.error) throw new Error(res.data.error);
      setCodeSent(true);
      setStep('code');
    } catch (e) {
      setError(e.message || 'Failed to send code');
    } finally {
      setSending(false);
    }
  };

  const verifyAndProceed = async () => {
    if (code.length < 6) { setError('Enter the 6-digit code.'); return; }
    setVerifying(true);
    setError('');
    try {
      const verifyRes = await base44.functions.invoke('verify-app-password-code', { action, code, target_id: target?.id });
      if (verifyRes?.data?.error) throw new Error(verifyRes.data.error);
      const actionToken = verifyRes.data.action_token;
      const manageRes = await base44.functions.invoke('manage-app-password', {
        action, action_token: actionToken, label, scope, target_id: target?.id,
      });
      if (manageRes?.data?.error) throw new Error(manageRes.data.error);
      if (action === 'delete') {
        onSuccess();
      } else {
        setResult(manageRes.data);
        setStep('result');
      }
    } catch (e) {
      setError(e.message || 'Operation failed');
    } finally {
      setVerifying(false);
    }
  };

  const copyPassword = () => {
    if (result?.password) {
      navigator.clipboard.writeText(result.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const title = action === 'create' ? 'Create app password' : action === 'reveal' ? 'Reveal app password' : 'Delete app password';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> {title}
          </DialogTitle>
          {step !== 'result' && (
            <DialogDescription>
              {action === 'create'
                ? 'Generate a scoped password for an external app.'
                : action === 'reveal'
                  ? `Reveal the password for "${target?.label}".`
                  : `Permanently delete the password for "${target?.label}". Any app using it will lose access immediately.`}
            </DialogDescription>
          )}
        </DialogHeader>

        {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        {step === 'form' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ap-label">Label</Label>
              <Input id="ap-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Bluesky app" maxLength={60} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Permission scope</Label>
              <div className="space-y-2">
                {SCOPES.map((s) => (
                  <button key={s.value} onClick={() => setScope(s.value)}
                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${scope === s.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary'}`}>
                    <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${scope === s.value ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`} />
                    <div>
                      <p className="text-sm font-semibold">{s.label}</p>
                      <p className="text-xs text-muted-foreground">{s.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={sendCode} disabled={sending || !label.trim()} className="w-full">
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Send verification code
            </Button>
          </div>
        )}

        {step === 'code' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {codeSent
                ? `We sent a 6-digit code to your email. Enter it below to ${action === 'delete' ? 'confirm deletion' : 'continue'}.`
                : 'Sending code…'}
            </p>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus>
                <InputOTPGroup>
                  <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                  <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="flex gap-2">
              {action === 'create' && (
                <Button variant="outline" className="flex-1" onClick={() => { setStep('form'); setCode(''); setError(''); }}>Back</Button>
              )}
              <Button className="flex-1" onClick={verifyAndProceed} disabled={verifying || code.length < 6}>
                {verifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {action === 'delete' ? 'Delete password' : 'Verify & continue'}
              </Button>
            </div>
            <button onClick={sendCode} disabled={sending} className="w-full text-xs text-muted-foreground hover:text-foreground">
              {sending ? 'Sending…' : 'Resend code'}
            </button>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p>Copy this password now. You'll need to verify by email again to reveal it later.</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary p-3">
              <code className="flex-1 break-all font-mono text-sm">{result.password}</code>
              <button onClick={copyPassword} className="shrink-0 rounded-lg p-2 hover:bg-background" title="Copy" aria-label="Copy password">
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <Button onClick={onSuccess} className="w-full">I've saved it</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}