import React, { useEffect, useState } from 'react';
import { Link2, Copy, Check, Loader2, Sparkles, Mail, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

// Settings section for generating and sharing personal invite links. Each
// link ties to the current user so that joining via it auto-follows and
// auto-friends the inviter. Lists the user's active codes with copy + revoke.
export default function InviteLinkSection() {
  const { toast } = useToast();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(null);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      const myDid = me?.data?.did || '';
      if (!myDid) { setCodes([]); return; }
      const rows = await base44.entities.InviteCode.filter({ inviter_did: myDid, status: 'active' }, '-created_date', 20).catch(() => []);
      setCodes(rows);
    } catch {
      setCodes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await base44.functions.invoke('create-user-invite', {});
      const data = res?.data || res;
      if (data?.code) {
        toast({ title: 'Invite link created', description: 'Share it with friends — they’ll auto-follow you on join.' });
        load();
      } else if (data?.error) {
        toast({ title: 'Could not create link', description: data.error, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Could not create link', description: e.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const copy = (code) => {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard?.writeText(url);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSendEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const res = await base44.functions.invoke('send-invite-email', { email: trimmed });
      const data = res?.data || res;
      if (data?.error) {
        toast({ title: 'Invite not sent', description: data.error, variant: 'destructive' });
      } else {
        toast({ title: 'Invite email sent', description: `Sent to ${data.sentTo || trimmed}` });
        setEmail('');
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Could not send invite email';
      toast({ title: 'Invite not sent', description: msg, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">Invite friends to SwapPulse</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Share a personal link. When a friend joins via it, they automatically follow you and become your friend — no request needed.
        </p>
        <button
          onClick={handleCreate}
          disabled={creating || codes.length >= 20}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {codes.length >= 20 ? 'Limit reached (20)' : 'Create invite link'}
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">Send an invite email</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Enter a friend's email and we'll send them a personalised invite from you. They'll auto-follow and friend you when they join.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            inputMode="email"
            placeholder="friend@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !sending) handleSendEmail(); }}
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
           aria-label="friend@example.com"/>
          <button
            onClick={handleSendEmail}
            disabled={sending || !email.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send invite
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Up to 10 invite emails per day.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : codes.length > 0 ? (
        <div className="space-y-2">
          {codes.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-semibold">{window.location.origin}/invite/{c.code}</p>
                <p className="text-xs text-muted-foreground">Created {new Date(c.created_at).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => copy(c.code)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
              >
                {copied === c.code ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                {copied === c.code ? 'Copied' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No active invite links yet.</p>
      )}
    </div>
  );
}