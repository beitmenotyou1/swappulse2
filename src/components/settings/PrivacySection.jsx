import React from 'react';
import { Eye, MapPin, Gauge } from 'lucide-react';
import SettingRow from '@/components/settings/SettingRow';

function Segmented({ value, options, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-secondary p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg py-2 text-xs font-semibold transition-colors ${value === o.value ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-background'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function PrivacySection({ settings, update }) {
  const p = settings.privacy || {};
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="flex items-center gap-2 text-sm font-bold"><Eye className="h-4 w-4 text-primary" /> Collection visibility</p>
        <p className="mb-2 text-xs text-muted-foreground">Who can see your full collection.</p>
        <Segmented
          value={p.collectionVisibility || 'showcase'}
          options={[{ value: 'public', label: 'Public' }, { value: 'showcase', label: 'Showcase' }, { value: 'private', label: 'Private' }]}
          onChange={(v) => update({ privacy: { collectionVisibility: v } })}
        />
        <div className="mt-3">
          <SettingRow label="Hide monetary values" description="Blur prices even when the collection is public." checked={!!p.valueHidden} onChange={(v) => update({ privacy: { valueHidden: v } })} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-sm font-bold">Trade listings visibility</p>
        <p className="mb-2 text-xs text-muted-foreground">Who can see what you're trading.</p>
        <Segmented
          value={p.tradeVisibility || 'public'}
          options={[{ value: 'public', label: 'Public' }, { value: 'wishlist_only', label: 'Wishlist' }, { value: 'circle_scoped', label: 'Circle' }]}
          onChange={(v) => update({ privacy: { tradeVisibility: v } })}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="flex items-center gap-2 text-sm font-bold"><MapPin className="h-4 w-4 text-primary" /> Location precision</p>
        <p className="mb-2 text-xs text-muted-foreground">How precise your location is on your profile.</p>
        <Segmented
          value={p.locationPrecision || 'approximate'}
          options={[{ value: 'approximate', label: 'City' }, { value: 'exact', label: 'Neighbourhood' }, { value: 'hidden', label: 'Hidden' }]}
          onChange={(v) => update({ privacy: { locationPrecision: v } })}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="flex items-center gap-2 text-sm font-bold"><Gauge className="h-4 w-4 text-primary" /> Data saver</p>
        <SettingRow label="Enable data saver" description="Load placeholders, reduce price sync, disable auto-play." checked={!!p.dataSaver} onChange={(v) => update({ privacy: { dataSaver: v } })} />
      </div>
    </div>
  );
}