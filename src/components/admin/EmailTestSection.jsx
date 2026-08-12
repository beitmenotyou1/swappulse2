import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function EmailTestSection() {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const sendTest = async () => {
    setSending(true);
    setError('');
    setResult(null);
    try {
      const res = await base44.functions.invoke('test-welcome-email', {});
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to send test email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <h3 className="font-bold">Branded Email Test</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Send the redesigned welcome email to your own account to review the branded HTML template.
      </p>
      <button
        onClick={sendTest}
        disabled={sending}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {sending ? 'Sending…' : 'Send test welcome email'}
      </button>
      {result?.ok && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Sent to {result.to}</p>
            <p className="text-xs opacity-80">Message ID: {result.messageId}</p>
          </div>
        </div>
      )}
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Failed to send</p>
            <p className="text-xs opacity-80">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}