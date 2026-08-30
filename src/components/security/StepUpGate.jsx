import React, { useState } from 'react';
import { Loader2, LockKeyhole, MailCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useT } from '@/lib/i18n/I18nProvider';

// Shared email step-up gate for key-management actions (device recovery, seed
// phrase export/import). The verified management token is short-lived and is
// passed to the render function, so a stolen browser session alone can never
// rotate or reveal signing keys.

export default function StepUpGate({ title, description, children }) {
  const t = useT();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const unlocked = !!token && Date.now() < expiresAt;

  const lock = () => {
    setToken('');
    setExpiresAt(0);
    setCode('');
    setSent(false);
  };

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      await base44.functions.invoke('security-stepup-send', {});
      setSent(true);
      setCode('');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || t('stepUp.sendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6) return;
    setBusy(true);
    setError('');
    try {
      const res = await base44.functions.invoke('security-stepup-verify', { code });
      const managementToken = res?.data?.management_token;
      if (!managementToken) throw new Error(res?.data?.error || t('stepUp.verifyFailed'));
      setToken(managementToken);
      setExpiresAt(Date.now() + Number(res?.data?.expires_in_seconds || 600) * 1000);
      setCode('');
      setSent(false);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || t('stepUp.verifyFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (unlocked) return children({ token, lock });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <LockKeyhole className="h-5 w-5 text-primary" aria-hidden="true" />
        <h3 className="font-bold">{title || t('stepUp.title')}</h3>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">{description || t('stepUp.description')}</p>

      {error && <div className="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</div>}

      {sent ? (
        <div className="space-y-3">
          <Label htmlFor="stepup-code">{t('stepUp.codeLabel')}</Label>
          <div className="flex justify-center sm:justify-start">
            <InputOTP id="stepup-code" maxLength={6} value={code} onChange={setCode} autoComplete="one-time-code">
              <InputOTPGroup>
                <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={verify} disabled={busy || code.length !== 6}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {t('stepUp.verify')}
            </Button>
            <Button variant="outline" onClick={send} disabled={busy}>{t('stepUp.resend')}</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={send} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <MailCheck className="mr-2 h-4 w-4" aria-hidden="true" />}
          {t('stepUp.send')}
        </Button>
      )}
    </div>
  );
}