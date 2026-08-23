import React, { useEffect, useState } from 'react';
import { Link2, Copy, Check, Loader2, Sparkles } from 'lucide-react';
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