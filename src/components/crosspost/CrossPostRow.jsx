import React, { useState } from 'react';
import { Pencil, FlaskConical, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { base44 } from '@/api/base44Client';
import { platformMeta, contentTypeMeta, testCrossPost } from '@/lib/crosspost';

// §7 — one cross-post config row: platform badge, handle, enable toggle,
// content-type chips, Test Post + Edit actions.
export default function CrossPostRow({ config, onEdit, onChanged }) {
  const meta = platformMeta(config.platform) || { label: config.platform, color: '#94a3b8', letter: '?' };
  const [status, setStatus] = useState('idle');
  const types = (config.contentTypes || []).map((k) => contentTypeMeta(k)).filter(Boolean);

  const toggle = async (checked) => {
    try {
      await base44.entities.CrossPostConfig.update(config.id, { enabled: checked, updated_at: new Date().toISOString() });
      onChanged();
    } catch { /* */ }
  };

  const test = async () => {
    setStatus('sending');
    try {
      const res = await testCrossPost(config.id);
      const r = res?.data?.results?.[0];
      if (r?.ok) setStatus(r.simulated ? 'simulated' : 'sent');
      else setStatus('error');
    } catch { setStatus('error'); }
    setTimeout(() => setStatus('idle'), 3500);
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3" style={{ minHeight: 64 }}>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: meta.color }}>{meta.letter}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{meta.label}</p>
        <p className="truncate text-xs text-muted-foreground">{config.handle || 'Not linked'}</p>
      </div>
      <Switch checked={!!config.enabled} onCheckedChange={toggle} />
      <div className="hidden max-w-[40%] flex-wrap gap-1 sm:flex">
        {types.map((t) => (
          <span key={t.key} className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'rgba(109,74,255,0.2)', color: '#6d4aff' }}>{t.label}</span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {status !== 'idle' && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {status === 'sending' && <Loader2 className="h-3 w-3 animate-spin" />}
            {status === 'sent' && '✓ Sent'}
            {status === 'simulated' && '✓ Simulated'}
            {status === 'error' && '✗ Failed'}
          </span>
        )}
        <button onClick={test} className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary">
          <FlaskConical className="h-3 w-3" /> Test
        </button>
        <button onClick={onEdit} className="text-sm font-medium hover:opacity-80" style={{ color: '#8b5cf6' }}>Edit</button>
      </div>
    </div>
  );
}