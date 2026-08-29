import React, { useEffect, useState } from 'react';
import { Loader2, Flag, ExternalLink, CheckCircle2, XCircle, ImageOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Image } from '@/components/ui/image';
import Avatar from '@/components/Avatar';
import { getSafeHttpUrl } from '@/lib/externalLink';

const REASON_LABELS = {
  misgraded: 'Misgraded card',
  wrong_card: 'Wrong card sent',
  damaged: 'Card damaged',
  not_received: 'Never received',
  scam: 'Suspected scam',
  other: 'Other',
};

const STATUS_STYLES = {
  pending: 'bg-destructive/15 text-destructive',
  reviewed: 'bg-accent/15 text-accent',
  resolved: 'bg-success/15 text-success',
  dismissed: 'bg-secondary text-muted-foreground',
};

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function TradeDisputesSection() {
  const { toast } = useToast();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);
  const [decision, setDecision] = useState(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.TradeDispute.filter({}, '-created_date', 100);
      setDisputes(list);
    } catch (e) {
      console.error('load disputes failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const unsub = base44.entities.TradeDispute.subscribe(() => { load(); });
    return unsub;
  }, []);

  const openResolve = (d, dec) => {
    setResolving(d);
    setDecision(dec);
    setNotes('');
  };

  const confirmResolve = async () => {
    if (!resolving || !decision) return;
    setBusy(true);
    try {
      const status = decision === 'resolved' ? 'resolved' : 'dismissed';
      await base44.entities.TradeDispute.update(resolving.id, {
        status,
        resolution_notes: notes.trim(),
        resolved_by: (await base44.auth.me())?.id || '',
        resolved_at: new Date().toISOString(),
      });
      toast({ title: `Dispute ${status}`, description: 'The filer will see the updated status.' });
      setResolving(null);
      setDecision(null);
      setNotes('');
      load();
    } catch (e) {
      toast({ title: 'Could not resolve', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const pending = disputes.filter((d) => d.status === 'pending');
  const reviewed = disputes.filter((d) => d.status === 'reviewed');
  const resolved = disputes.filter((d) => d.status === 'resolved' || d.status === 'dismissed');

  const renderRow = (d) => (
    <div key={d.id} className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Avatar name={d.filed_by_name} src={d.filed_by_avatar} size={32} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{d.filed_by_name || 'Collector'}</p>
            <p className="text-[11px] text-muted-foreground">@{d.filed_by_handle || 'collector'} · {timeAgo(d.created_date)}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[d.status] || STATUS_STYLES.pending}`}>
          {d.status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 font-semibold text-destructive">
          <Flag className="mr-1 inline h-3 w-3" />{REASON_LABELS[d.reason] || d.reason}
        </span>
        <Link to={`/trade/${d.trade_id}`} className="flex items-center gap-1 text-primary hover:underline">
          View trade <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <p className="mt-2 text-sm">{d.description}</p>

      {d.photo_urls?.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {d.photo_urls.map((url) => {
            const safeUrl = getSafeHttpUrl(url);
            if (!safeUrl) return null;
            return (
              <a key={safeUrl} href={safeUrl} target="_blank" rel="noopener noreferrer">
                <Image src={safeUrl} alt="Evidence" className="h-24 w-24 rounded-lg object-cover ring-1 ring-border" fittingType="fill" />
              </a>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
          <ImageOff className="h-3 w-3" /> No photos attached
        </p>
      )}

      {d.status === 'pending' && (
        <div className="mt-3 flex gap-2 border-t border-border pt-3">
          <Button size="sm" onClick={() => openResolve(d, 'resolved')} className="bg-success text-white hover:bg-success/90">
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Resolve
          </Button>
          <Button size="sm" variant="outline" onClick={() => openResolve(d, 'dismissed')}>
            <XCircle className="mr-1.5 h-4 w-4" /> Dismiss
          </Button>
        </div>
      )}

      {(d.status === 'resolved' || d.status === 'dismissed') && d.resolution_notes && (
        <div className="mt-3 rounded-lg bg-secondary px-3 py-2 text-xs">
          <p className="font-semibold text-muted-foreground">Moderator notes:</p>
          <p className="mt-0.5">{d.resolution_notes}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Pending</p>
          <p className="mt-1 text-2xl font-extrabold text-destructive">{pending.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Reviewed</p>
          <p className="mt-1 text-2xl font-extrabold text-accent">{reviewed.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Closed</p>
          <p className="mt-1 text-2xl font-extrabold text-success">{resolved.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : disputes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          <Flag className="mx-auto mb-2 h-8 w-8 opacity-40" />
          No trade disputes filed.
        </div>
      ) : (
        <div className="space-y-3">
          {pending.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-destructive">Pending Review ({pending.length})</h3>
              <div className="space-y-3">{pending.map(renderRow)}</div>
            </section>
          )}
          {reviewed.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-accent">Reviewed ({reviewed.length})</h3>
              <div className="space-y-3">{reviewed.map(renderRow)}</div>
            </section>
          )}
          {resolved.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Closed ({resolved.length})</h3>
              <div className="space-y-3">{resolved.map(renderRow)}</div>
            </section>
          )}
        </div>
      )}

      <Dialog open={!!resolving} onOpenChange={(v) => { if (!v) { setResolving(null); setDecision(null); setNotes(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decision === 'resolved' ? 'Resolve dispute' : 'Dismiss dispute'}
            </DialogTitle>
            <DialogDescription>
              Add optional notes explaining the decision. The filer will see the status update and your notes.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
            placeholder="Resolution notes (optional)…"
            rows={4}
            className="w-full resize-none rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setResolving(null); setDecision(null); setNotes(''); }} disabled={busy}>Cancel</Button>
            <Button
              onClick={confirmResolve}
              disabled={busy}
              className={decision === 'resolved' ? 'bg-success text-white hover:bg-success/90' : ''}
            >
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Confirm {decision === 'resolved' ? 'Resolve' : 'Dismiss'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}