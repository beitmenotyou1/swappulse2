import React, { useEffect } from 'react';
import { Accessibility as AccessIcon, EyeOff, Type, Contrast } from 'lucide-react';
import SettingRow from '@/components/settings/SettingRow';
import { applyAccessibility } from '@/hooks/useSettings';

export default function AccessibilitySection({ settings, update }) {
  const a = settings.accessibility || {};
  // Apply immediately on change so toggles are reflected without a reload.
  useEffect(() => { applyAccessibility(a); }, [a]);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="flex items-center gap-2 text-sm font-bold"><AccessIcon className="h-4 w-4 text-primary" /> Theme</p>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl border border-border bg-secondary p-1">
          {['dark', 'light', 'system'].map((t) => (
            <button key={t} onClick={() => update({ accessibility: { theme: t } })} className={`rounded-lg py-2 text-xs font-semibold capitalize transition-colors ${a.theme === t ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-background'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="flex items-center gap-2 text-sm font-bold"><EyeOff className="h-4 w-4 text-primary" /> Motion & contrast</p>
        <SettingRow label="Reduce motion" description="Disable parallax, fades and pack-opening animations." checked={!!a.reduceMotion} onChange={(v) => update({ accessibility: { reduceMotion: v } })} />
        <SettingRow label="High contrast" description="Boost contrast across the interface." checked={!!a.highContrast} onChange={(v) => update({ accessibility: { highContrast: v } })} />
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="flex items-center gap-2 text-sm font-bold"><Type className="h-4 w-4 text-primary" /> Font size</p>
        <div className="mt-2 grid grid-cols-4 gap-1 rounded-xl border border-border bg-secondary p-1">
          {['small', 'medium', 'large', 'xl'].map((s) => (
            <button key={s} onClick={() => update({ accessibility: { fontSize: s } })} className={`rounded-lg py-2 text-xs font-semibold capitalize transition-colors ${a.fontSize === s ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-background'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}