import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { PLATFORMS, CONTENT_TYPES, TEMPLATES } from '@/lib/crosspost';
import SettingSelect from '@/components/settings/SettingSelect';

// §7 - add/edit cross-post platform configuration modal.
export default function CrossPostModal({ open, editing, onClose, onSaved }) {
  const [platform, setPlatform] = useState('discord_webhook');
  const [handle, setHandle] = useState('');
  const [credential, setCredential] = useState('');
  const [extra, setExtra] = useState('');
  const [contentTypes, setContentTypes] = useState(['pack_opening']);
  const [template, setTemplate] = useState('');
  const [includeCard, setIncludeCard] = useState(true);
  const [includeLink, setIncludeLink] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setPlatform(editing.platform || 'discord_webhook');
      setHandle(editing.handle || '');
      setCredential(editing.credential || '');
      setExtra(editing.extra_credential || '');
      setContentTypes(editing.contentTypes || ['pack_opening']);
      setTemplate(editing.template || '');
      setIncludeCard(editing.includeCard !== false);
      setIncludeLink(editing.includeLink !== false);
      setEnabled(editing.enabled !== false);
    } else {
      setPlatform('discord_webhook'); setHandle(''); setCredential(''); setExtra('');
      setContentTypes(['pack_opening']); setTemplate(''); setIncludeCard(true); setIncludeLink(true); setEnabled(true);
    }
    setError('');
  }, [open, editing]);

  if (!open) return null;
  const meta = PLATFORMS.find((p) => p.key === platform) || PLATFORMS[0];

  const toggleType = (k) => setContentTypes((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const save = async () => {
    if (!contentTypes.length) return setError('Select at least one content type');
    if (!credential.trim()) return setError(`Enter your ${meta.credLabel}`);
    setSaving(true); setError('');
    try {
      const { did, signingKey } = await ensureUserDid();
      const now = new Date().toISOString();
      const payload = {
        platform,
        handle: handle.trim(),
        contentTypes,
        template: template.trim() || undefined,
        includeCard,
        includeLink,
        credential: credential.trim(),
        extra_credential: extra.trim() || undefined,
        enabled,
        updated_at: now,
        created_at: editing?.created_at || now,
      };
      const stamped = await stampRecord(payload, NSID.CROSS_POST_CONFIG, did, signingKey);
      if (editing) await base44.entities.CrossPostConfig.update(editing.id, stamped);
      else await base44.entities.CrossPostConfig.create(stamped);
      onSaved?.();
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mt-6 w-full max-w-lg animate-slide-up rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-bold">{editing ? 'Edit platform' : 'Add platform'}</h2>
          <button onClick={onClose} className="relative rounded-full p-1.5 hover:bg-secondary before:content-[''] before:absolute before:-inset-1.5"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-4">
          <div className="block text-sm">
            <span className="text-muted-foreground">Platform</span>
            <div className="mt-1">
              <SettingSelect
                value={platform}
                onChange={setPlatform}
                label="Platform"
                options={PLATFORMS.map((p) => ({ value: p.key, label: p.label }))}
              />
            </div>
          </div>
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Handle / display name (e.g. @collector)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          <input value={credential} onChange={(e) => setCredential(e.target.value)} placeholder={meta.credLabel} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          {meta.extraLabel && (
            <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={meta.extraLabel} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          )}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Content types</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {CONTENT_TYPES.map((c) => (
                <button key={c.key} onClick={() => toggleType(c.key)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${contentTypes.includes(c.key) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary'}`}>{c.label}</button>
              ))}
            </div>
          </div>
          <textarea value={template} onChange={(e) => setTemplate(e.target.value)} maxLength={500} rows={2} placeholder={`Custom template (default: ${TEMPLATES[contentTypes[0]] || TEMPLATES.pack_opening})`} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
            <span className="text-sm">Include card image reference</span>
            <Switch checked={includeCard} onCheckedChange={setIncludeCard} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
            <span className="text-sm">Include link back to SwapPulse</span>
            <Switch checked={includeLink} onCheckedChange={setIncludeLink} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
            <span className="text-sm">Enabled</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}