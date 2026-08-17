import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Loader2, Sparkles } from 'lucide-react';

export default function InviteCodesSection() {
  const { toast } = useToast();
  const [count, setCount] = useState(10);
  const [batch, setBatch] = useState('');
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.InviteCode.list('-created_date', 50);
      setCodes(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('generate-invites', { count: Number(count), batch: batch.trim() || undefined });
      toast({ title: `Generated ${res.data?.count || 0} codes`, description: res.data?.batch });
      setBatch('');
      await load();
    } catch (e) {
      toast({ title: 'Generation failed', description: e.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const copy = (code) => {
    navigator.clipboard?.writeText(code);
    toast({ title: 'Copied', description: code });
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 font-bold">Invite Codes</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="count">Count</Label>
          <Input id="count" type="number" min={1} max={500} value={count} onChange={(e) => setCount(e.target.value)} className="w-24" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="batch">Batch label (optional)</Label>
          <Input id="batch" value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="e.g. wave-1" className="w-48" />
        </div>
        <Button onClick={generate} disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
          Generate
        </Button>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No codes yet. Generate some to start onboarding.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {codes.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-border bg-secondary p-2">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-semibold">{c.code}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.status === 'used' ? `used by ${c.used_by_did || '–'}` : c.status}
                    {c.batch ? ` · ${c.batch}` : ''}
                  </p>
                </div>
                {c.status === 'active' && (
                  <button onClick={() => copy(c.code)} className="rounded p-1 hover:bg-background" aria-label="Copy code">
                    <Copy className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}