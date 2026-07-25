import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cardImageUrl } from '@/lib/tcgdex';

const SERVICES = [
  { id: 'psa', label: 'PSA' },
  { id: 'bgs', label: 'BGS' },
  { id: 'cgc', label: 'CGC' },
  { id: 'ace', label: 'ACE' },
];

// §4 Grading submission form - creates a GradingSubmission from a collection card.
export default function GradingForm({ collection, onClose, onSaved }) {
  const [selId, setSelId] = useState('');
  const [service, setService] = useState('psa');
  const [tracking, setTracking] = useState('');
  const [declared, setDeclared] = useState('');
  const [expected, setExpected] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const selected = collection.find((c) => c.id === selId);

  const submit = async () => {
    if (!selected) { setErr('Pick a card from your collection'); return; }
    setSaving(true);
    setErr('');
    try {
      const rec = await base44.entities.GradingSubmission.create({
        card_id: selected.card_id,
        card_name: selected.card_name,
        service,
        tracking_number: tracking,
        status: 'submitted',
        declared_value: declared ? Math.round(parseFloat(declared) * 100) : null,
        expected_return: expected || null,
        submitted_at: new Date().toISOString(),
      });
      onSaved(rec);
    } catch (e) {
      setErr(e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">New grading submission</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        <label className="text-xs font-semibold text-muted-foreground">Card from your collection</label>
        <select
          value={selId}
          onChange={(e) => setSelId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
        >
          <option value="">Select a card…</option>
          {collection.map((c) => (
            <option key={c.id} value={c.id}>{c.card_name} · {c.set_name || '-'}</option>
          ))}
        </select>

        {selected && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-secondary p-2">
            {cardImageUrl(selected.card_image) && (
              <img src={cardImageUrl(selected.card_image)} alt="" className="h-12 w-9 rounded object-cover" />
            )}
            <div className="text-xs">
              <p className="font-semibold">{selected.card_name}</p>
              <p className="text-muted-foreground">{selected.set_name}</p>
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="text-xs font-semibold text-muted-foreground">Grading service</label>
          <div className="mt-1 grid grid-cols-4 gap-2">
            {SERVICES.map((s) => (
              <button
                key={s.id}
                onClick={() => setService(s.id)}
                className={`rounded-lg border px-2 py-2 text-sm font-bold ${
                  service === s.id ? 'border-primary bg-primary/15 text-primary' : 'border-border'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Tracking number</label>
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="e.g. RR123456789GB"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Declared value (£)</label>
            <input
              type="number"
              step="0.01"
              value={declared}
              onChange={(e) => setDeclared(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="text-xs font-semibold text-muted-foreground">Expected return date</label>
          <input
            type="date"
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        {err && <p className="mt-3 text-xs text-destructive">{err}</p>}

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold">Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Submit
          </button>
        </div>
      </div>
    </div>
  );
}