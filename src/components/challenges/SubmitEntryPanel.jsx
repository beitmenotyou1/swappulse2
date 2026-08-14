import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { bridgeChallengeEntry } from '@/lib/federatedBridge';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import OptInPrompt from './OptInPrompt';

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'holo', 'secret_rare', 'ex', 'v', 'vmax', 'rainbow'];
const COND_IDX = { damaged: 0, poor: 1, fair: 2, good: 3, excellent: 4, near_mint: 5, mint: 6 };

function passes(c, filters) {
  if (!filters) return true;
  if (filters.min_rarity) {
    const r = RARITY_ORDER.indexOf((c.rarity || '').toLowerCase());
    if (r < RARITY_ORDER.indexOf(filters.min_rarity.toLowerCase())) return false;
  }
  if (filters.element_types?.length && !filters.element_types.includes(c.category)) return false;
  if (filters.condition_min) {
    if ((COND_IDX[(c.condition || '').toLowerCase()] ?? -1) < (COND_IDX[filters.condition_min.toLowerCase()] ?? -1)) return false;
  }
  return true;
}

export default function SubmitEntryPanel({ challenge }) {
  const { user } = useAuth();
  const [cards, setCards] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    base44.entities.CollectionEntry.list('-updated_date', 200)
      .then((rows) => setCards(rows.filter((c) => passes(c, challenge.goal?.filters))))
      .catch(() => setCards([]));
  }, [challenge.id]);

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const submit = async () => {
    if (!selected.size) return;
    setSubmitting(true); setResult(null);
    try {
      const res = await base44.functions.invoke('submitChallengeEntry', {
        challengeId: challenge.id,
        contributionUris: [...selected],
        notes,
        category: challenge.category,
      });
      setResult(res.data);
      // Bridge to AT Protocol PDS as a real org.swappulse.challengeEntry record
      if (res.data?.entry?.id) {
        bridgeChallengeEntry(res.data.entry).then((bridgeRes) => {
          if (bridgeRes.bridged) base44.entities.ChallengeEntry.update(res.data.entry.id, bridgeRes).catch(() => {});
        }).catch(() => {});
      }
      setSelected(new Set()); setNotes('');
    } catch (e) { setResult({ error: e?.message || 'Submit failed' }); }
    finally { setSubmitting(false); }
  };

  if (!user) return <p className="text-sm text-muted-foreground">Sign in to submit an entry.</p>;

  return (
    <div className="space-y-3">
      {challenge.mode === 'competitive' && <OptInPrompt />}
      <div className="space-y-3 rounded-lg border border-border p-3">
        <p className="text-sm font-semibold">Submit an entry</p>
        {!cards ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your qualifying cards…</div>
          : cards.length === 0 ? <p className="text-sm text-muted-foreground">No cards in your collection qualify for this challenge's filters.</p>
          : (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {cards.map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded-lg bg-secondary/40 px-2 py-1.5 text-sm">
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="accent-primary" />
                  <span className="flex-1 truncate">{c.card_name}</span>
                  <span className="text-xs capitalize text-muted-foreground">{c.rarity || '—'}</span>
                </label>
              ))}
            </div>
          )}
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional, max 500 chars)" maxLength={500} rows={2} />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={submit} disabled={!selected.size || submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit {selected.size > 0 && `(${selected.size})`}</Button>
          {result?.entry && <span className="flex items-center gap-1 text-sm text-success"><CheckCircle2 className="h-4 w-4" />{result.entry.status === 'approved' ? `Approved · ${result.entry.contribution_count} counted` : 'Rejected'}</span>}
          {result?.error && <span className="text-sm text-destructive">{result.error}</span>}
        </div>
      </div>
    </div>
  );
}