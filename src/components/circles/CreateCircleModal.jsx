import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { bridgeCircle } from '@/lib/federatedBridge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const THEMES = [
  ['general', 'General'],
  ['vintage', 'Vintage'],
  ['competitive', 'Competitive'],
  ['shiny', 'Shiny'],
  ['investment', 'Investment'],
  ['local_region', 'Local Region'],
  ['artist', 'Artist'],
];

const VIS = [
  ['private', 'Private'],
  ['members_visible', 'Members visible'],
  ['public', 'Public'],
];

export default function CreateCircleModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState('general');
  const [visibility, setVisibility] = useState('public');
  const [region, setRegion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!name.trim()) return setError('Name required');
    setSubmitting(true);
    setError('');
    try {
      const { did, signingKey } = await ensureUserDid();
      const me = await base44.auth.me();
      const profile = { did, name: me?.full_name || '', handle: me?.email?.split('@')[0] || '', avatar: '' };
      const stamped = await stampRecord(
        {
          name: name.trim(),
          description: description.trim(),
          theme,
          visibility,
          region: theme === 'local_region' ? region.trim() : '',
          member_dids: [did],
          member_profiles: [profile],
          member_count: 1,
          author_name: me?.full_name || '',
          author_handle: me?.email?.split('@')[0] || '',
        },
        NSID.CIRCLE,
        did,
        signingKey,
      );
      const created = await base44.entities.Circle.create(stamped);
      bridgeCircle(stamped).then((res) => {
        if (res.bridged) base44.entities.Circle.update(created.id, res).catch(() => {});
      }).catch(() => {});
      onCreated?.(created);
      setName('');
      setDescription('');
      setRegion('');
      setTheme('general');
      setVisibility('public');
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to create circle');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const pill = (active) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium transition ${
      active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mt-8 w-full max-w-lg animate-slide-up rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-bold">New Circle</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="e.g. South-East Shiny Hunters"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={2}
              className="w-full resize-none rounded-xl border border-border bg-secondary p-2.5 text-sm outline-none focus:border-primary"
              placeholder="What is this circle about?"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Theme</Label>
            <div className="flex flex-wrap gap-2">
              {THEMES.map(([k, l]) => (
                <button key={k} onClick={() => setTheme(k)} className={pill(theme === k)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visibility</Label>
            <div className="grid grid-cols-3 gap-2">
              {VIS.map(([k, l]) => (
                <button key={k} onClick={() => setVisibility(k)} className={pill(visibility === k)}>{l}</button>
              ))}
            </div>
          </div>
          {theme === 'local_region' && (
            <div>
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Region</Label>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="e.g. UK-South-East"
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create circle
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}