import React from 'react';
import { Plus, X } from 'lucide-react';
import { Field } from './EditorControls';
import FieldVisibilitySelect from './FieldVisibilitySelect';

const TRADE_DETAIL_ROWS = [
  { key: 'trade_values', label: 'Card values' },
  { key: 'trade_partners', label: 'Trade partners' },
  { key: 'trade_dates', label: 'Trade dates' },
];

// ContactLinksTab — location, website, contact email, a dynamic list of social
// links, and trade-history detail privacy — each with per-field visibility.
export default function ContactLinksTab({ draft, update }) {
  const fv = draft.field_visibility || {};
  const setVis = (field, v) => update({ field_visibility: { ...fv, [field]: v } });
  const links = draft.social_links || [];

  const setLink = (i, patch) => update({ social_links: links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  const addLink = () => update({ social_links: [...links, { platform: '', url: '', label: '' }] });
  const removeLink = (i) => update({ social_links: links.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <Field label="Location" visibility={fv.location} onVis={(v) => setVis('location', v)}>
        <input value={draft.location || ''} onChange={(e) => update({ location: e.target.value })} maxLength={100} placeholder="e.g. London, UK" className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"  aria-label="e.g. London, UK"/>
      </Field>

      <Field label="Website" visibility={fv.website} onVis={(v) => setVis('website', v)}>
        <input value={draft.website || ''} onChange={(e) => update({ website: e.target.value })} maxLength={200} placeholder="https://…" className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"  aria-label="https://…"/>
      </Field>

      <Field label="Contact email" visibility={fv.contact_email} onVis={(v) => setVis('contact_email', v)}>
        <input type="email" value={draft.contact_email || ''} onChange={(e) => update({ contact_email: e.target.value })} maxLength={200} placeholder="you@example.com" className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"  aria-label="you@example.com"/>
      </Field>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="text-xs font-semibold text-muted-foreground">Social links</label>
          <FieldVisibilitySelect value={fv.social_links} onChange={(v) => setVis('social_links', v)} />
        </div>
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input value={l.label || ''} onChange={(e) => setLink(i, { label: e.target.value })} placeholder="Label (e.g. Twitter)" className="w-1/3 rounded-xl border border-border bg-secondary px-2 py-2 text-sm outline-none focus:border-primary"  aria-label="Label (e.g. Twitter)"/>
              <input value={l.url || ''} onChange={(e) => setLink(i, { url: e.target.value })} placeholder="https://…" className="flex-1 rounded-xl border border-border bg-secondary px-2 py-2 text-sm outline-none focus:border-primary"  aria-label="https://…"/>
              <button type="button" onClick={() => removeLink(i)} className="rounded-xl border border-border px-2 hover:bg-secondary" aria-label="Remove link"><X className="h-4 w-4" /></button>
            </div>
          ))}
          <button type="button" onClick={addLink} className="inline-flex items-center gap-1 rounded-xl border border-dashed border-border px-3 py-2 text-xs font-semibold hover:bg-secondary">
            <Plus className="h-3.5 w-3.5" /> Add link
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-secondary/40 p-3">
        <p className="text-xs font-semibold text-muted-foreground">Trade history details</p>
        <p className="mb-3 mt-0.5 text-[11px] text-muted-foreground">Control who sees specific details within your trade history tab. Hidden details show as ••• rather than disappearing.</p>
        <div className="space-y-2">
          {TRADE_DETAIL_ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2">
              <span className="text-sm font-medium">{row.label}</span>
              <FieldVisibilitySelect value={fv[row.key] || 'followers'} onChange={(v) => setVis(row.key, v)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}