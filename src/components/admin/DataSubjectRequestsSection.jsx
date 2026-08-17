import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';

const TYPE_LABELS = {
  access: 'Access',
  rectification: 'Rectification',
  erasure: 'Erasure',
  objection: 'Objection',
  restriction: 'Restriction',
  consent_withdrawal: 'Consent Withdrawal',
  portability: 'Portability',
};

const STATUS_STYLES = {
  pending: 'bg-warning/10 text-warning',
  completed: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
};

export default function DataSubjectRequestsSection() {
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);
  const [notes, setNotes] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [bulkNote, setBulkNote] = useState('');
  const [bulkResolving, setBulkResolving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.DataSubjectRequest.filter({}, '-created_date', 100).catch(() => []);
      setRequests(all || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resolve = async (id, status) => {
    setResolving(id);
    try {
      await base44.entities.DataSubjectRequest.update(id, {
        status,
        resolved_at: new Date().toISOString(),
        resolution_notes: notes[id] || '',
      });
      toast({ title: `Request ${status}` });
      setNotes({ ...notes, [id]: '' });
      load();
    } catch (e) {
      toast({ title: 'Failed', description: e?.message || '', variant: 'destructive' });
    } finally {
      setResolving(null);
    }
  };

  const pending = requests.filter((r) => r.status === 'pending');
  const resolved = requests.filter((r) => r.status !== 'pending');
  const allPendingSelected = pending.length > 0 && pending.every((r) => selected.has(r.id));

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (allPendingSelected) {
      const next = new Set(selected);
      pending.forEach((r) => next.delete(r.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      pending.forEach((r) => next.add(r.id));
      setSelected(next);
    }
  };

  const clearSelection = () => {
    setSelected(new Set());
    setBulkNote('');
  };

  const bulkResolve = async (status) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkResolving(true);
    const stamp = new Date().toISOString();
    let ok = 0, fail = 0;
    await Promise.all(ids.map(async (id) => {
      try {
        await base44.entities.DataSubjectRequest.update(id, {
          status,
          resolved_at: stamp,
          resolution_notes: bulkNote || '',
        });
        ok++;
      } catch {
        fail++;
      }
    }));
    setBulkResolving(false);
    clearSelection();
    toast({
      title: `${ok} request${ok === 1 ? '' : 's'} ${status}`,
      description: fail > 0 ? `${fail} failed` : undefined,
      variant: fail > 0 ? 'destructive' : 'default',
    });
    load();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-bold"><FileText className="h-4 w-4 text-primary" /> Data Subject Requests</p>
      <p className="mt-1 text-xs text-muted-foreground">
        GDPR / CCPA / UK DPA requests submitted by collectors. Respond within 30 days.
      </p>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : requests.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No data subject requests yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {pending.length > 0 && (
            <>
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={allPendingSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all pending"
                />
                Pending ({pending.length})
              </label>
              {pending.map((r) => (
                <div key={r.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={() => toggleSelect(r.id)}
                      aria-label={`Select request ${r.id}`}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status]}`}>
                            {TYPE_LABELS[r.request_type] || r.request_type}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(r.created_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      {r.details && <p className="mt-2 text-sm">{r.details}</p>}
                      <Textarea
                        value={notes[r.id] || ''}
                        onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                        placeholder="Resolution notes…"
                        className="mt-2 min-h-[60px]"
                      />
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="default" onClick={() => resolve(r.id, 'completed')} disabled={resolving === r.id}>
                          <CheckCircle className="h-4 w-4" /> Mark completed
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => resolve(r.id, 'rejected')} disabled={resolving === r.id}>
                          <XCircle className="h-4 w-4" /> Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {selected.size > 0 && (
                <div className="sticky bottom-4 z-10 mt-4 rounded-xl border border-primary/30 bg-card p-3 shadow-elevated">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    {selected.size} selected, apply to all
                  </p>
                  <Textarea
                    value={bulkNote}
                    onChange={(e) => setBulkNote(e.target.value)}
                    placeholder="Shared resolution notes (optional)…"
                    className="mb-2 min-h-[50px]"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="default" onClick={() => bulkResolve('completed')} disabled={bulkResolving}>
                      <CheckCircle className="h-4 w-4" /> Approve {selected.size}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => bulkResolve('rejected')} disabled={bulkResolving}>
                      <XCircle className="h-4 w-4" /> Delete {selected.size}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={clearSelection} disabled={bulkResolving}>
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
          {resolved.length > 0 && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resolved ({resolved.length})</p>
              {resolved.slice(0, 10).map((r) => (
                <div key={r.id} className="rounded-lg border border-border bg-background p-3 opacity-75">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status]}`}>
                      {TYPE_LABELS[r.request_type] || r.request_type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  {r.details && <p className="mt-1 text-sm">{r.details}</p>}
                  {r.resolution_notes && <p className="mt-1 text-xs text-muted-foreground">Notes: {r.resolution_notes}</p>}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}