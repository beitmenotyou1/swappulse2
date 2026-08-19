import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import TurnstileWidget from '@/components/TurnstileWidget';

export default function DonationContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  const [siteKey, setSiteKey] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    base44.functions.invoke('get-turnstile-site-key', {})
      .then((res) => setSiteKey(res?.siteKey || res?.data?.siteKey || ''))
      .catch(() => setSiteKey(''));
  }, []);

  const onVerify = useCallback((token) => setTurnstileToken(token), []);

  const submit = async (e) => {
    e.preventDefault();
    if (!turnstileToken) {
      toast({ title: 'Please complete the bot check', description: 'Verify you\'re human before sending.', variant: 'destructive' });
      return;
    }
    if (!name || !email || !message) {
      toast({ title: 'All fields are required', description: 'Fill in your name, email, and message.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('donation-contact', { name, email, message, turnstileToken });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      setSent(true);
    } catch (e) {
      toast({ title: 'Could not send', description: e?.response?.data?.error || e?.message || 'Please try again later.', variant: 'destructive' });
      setTurnstileToken(null);
      setResetKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success">
        Thanks! Your message has been sent. We'll reply to your email shortly.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <label htmlFor="dc-name" className="mb-1 block text-xs font-semibold text-muted-foreground">Name</label>
        <input
          id="dc-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>
      <div>
        <label htmlFor="dc-email" className="mb-1 block text-xs font-semibold text-muted-foreground">Email</label>
        <input
          id="dc-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={200}
          required
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>
      <div>
        <label htmlFor="dc-message" className="mb-1 block text-xs font-semibold text-muted-foreground">Message</label>
        <textarea
          id="dc-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          required
          rows={4}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="flex justify-center">
        {siteKey ? (
          <TurnstileWidget siteKey={siteKey} onVerify={onVerify} resetKey={resetKey} />
        ) : (
          <div className="h-[65px] w-full animate-pulse rounded-md bg-secondary" />
        )}
      </div>

      <button
        type="submit"
        disabled={loading || !turnstileToken}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4" />}
        Send message
      </button>
    </form>
  );
}