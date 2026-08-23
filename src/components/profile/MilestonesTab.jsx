import React from 'react';
import { Plus, X } from 'lucide-react';
import FieldVisibilitySelect from './FieldVisibilitySelect';
import SettingSelect from '@/components/settings/SettingSelect';

const TYPES = [
  { value: 'first_card', label: 'First card' },
  { value: 'first_trade', label: 'First trade' },
  { value: 'set_completion', label: 'Set completion' },
  { value: 'grading', label: 'Grading achievement' },
  { value: 'custom', label: 'Custom milestone' },
];

// MilestonesTab — editor for the collecting-journey timeline. Add/remove
// milestones with a type, date, title and description. The whole list shares
// one visibility selector.
export default function MilestonesTab({ draft, update }) {
  const fv = draft.field_visibility || {};
  const ms = draft.milestones || [];

  const setM = (i, patch) => update({ milestones: ms.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) });
  const addM = () => update({
    milestones: [...ms, { id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()), title: '', description: '', date: '', milestone_type: 'custom' }],
  });
  const removeM = (i) => update({ milestones: ms.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-muted-foreground">Collecting journey milestones</label>
        <FieldVisibilitySelect value={fv.milestones} onChange={(v) => update({ field_visibility: { ...fv, milestones: v } })} />
      </div>
      <p className="text-[11px] text-muted-foreground">Mark the moments that define your collection — first card, first trade, set completions, grading achievements and more.</p>

      <div className="space-y-3">
        {ms.map((m, i) => (
          <div key={m.id || i} className="space-y-2 rounded-xl border border-border bg-secondary p-3">
            <div className="flex gap-2">
              <input value={m.title || ''} onChange={(e) => setM(i, { title: e.target.value })} placeholder="Milestone title" className="flex-1 rounded-lg border border-border bg-card px-2 py-1.5 text-sm outline-none focus:border-primary" />
              <button type="button" onClick={() => removeM(i)} className="rounded-lg border border-border px-2 hover:bg-card" aria-label="Remove milestone"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <SettingSelect value={m.milestone_type || 'custom'} options={TYPES} onChange={(v) => setM(i, { milestone_type: v })} label="Milestone type" />
              </div>
              <input type="date" value={m.date || ''} onChange={(e) => setM(i, { date: e.target.value })} className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm outline-none focus:border-primary" />
            </div>
            <textarea value={m.description || ''} onChange={(e) => setM(i, { description: e.target.value })} rows={2} placeholder="What happened?" className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-sm outline-none focus:border-primary" />
          </div>
        ))}
        <button type="button" onClick={addM} className="inline-flex items-center gap-1 rounded-xl border border-dashed border-border px-3 py-2 text-xs font-semibold hover:bg-secondary">
          <Plus className="h-3.5 w-3.5" /> Add milestone
        </button>
      </div>
    </div>
  );
}