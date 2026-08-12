import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

const SEVERITIES = [
  { value: 'warn', label: 'Warn' },
  { value: 'escalate', label: 'Escalate' },
  { value: 'inform', label: 'Inform' },
];

const LABEL_TYPES = [
  'hashtag-spam',
  'hashtag-stuffing',
  'hashtag-hijack',
  'hashtag-flooding',
  'hashtag-coordinated-spam',
  'hashtag-misleading',
];

const TIMEFRAMES = [
  { value: '24h', label: 'Last 24h' },
  { value: '7d', label: 'Last 7d' },
  { value: '30d', label: 'Last 30d' },
  { value: 'all', label: 'All Time' },
];

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'escalated', label: 'Escalated' },
];

export default function FilterSidebar({ filters, onChange }) {
  const toggleArr = (key, val) => {
    const arr = filters[key] || [];
    const next = arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
    onChange({ ...filters, [key]: next });
  };

  const reset = () =>
    onChange({ severity: [], labelType: [], timeframe: '7d', authorDid: '', status: ['pending'], confidenceMin: 0 });

  return (
    <Card className="h-fit p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold">Filters</h2>
        <Button variant="ghost" size="sm" onClick={reset}>
          Reset
        </Button>
      </div>

      <div className="space-y-5">
        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">Severity</Label>
          <div className="space-y-1.5">
            {SEVERITIES.map((s) => (
              <label key={s.value} className="flex items-center gap-2 text-sm">
                <Checkbox checked={filters.severity.includes(s.value)} onCheckedChange={() => toggleArr('severity', s.value)} />
                {s.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">Label Type</Label>
          <div className="space-y-1.5">
            {LABEL_TYPES.map((l) => (
              <label key={l} className="flex items-center gap-2 text-sm">
                <Checkbox checked={filters.labelType.includes(l)} onCheckedChange={() => toggleArr('labelType', l)} />
                <span className="truncate">{l.replace('hashtag-', '')}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">Timeframe</Label>
          <div className="space-y-1.5">
            {TIMEFRAMES.map((t) => (
              <label key={t.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={filters.timeframe === t.value}
                  onCheckedChange={() => onChange({ ...filters, timeframe: t.value })}
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">Author (DID / handle)</Label>
          <Input
            value={filters.authorDid}
            onChange={(e) => onChange({ ...filters, authorDid: e.target.value })}
            placeholder="did:plc:... or @handle"
          />
        </div>

        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">Status</Label>
          <div className="space-y-1.5">
            {STATUSES.map((s) => (
              <label key={s.value} className="flex items-center gap-2 text-sm">
                <Checkbox checked={filters.status.includes(s.value)} onCheckedChange={() => toggleArr('status', s.value)} />
                {s.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
            Min Confidence: {filters.confidenceMin}%
          </Label>
          <Slider
            value={[filters.confidenceMin]}
            min={0}
            max={100}
            step={5}
            onValueChange={(v) => onChange({ ...filters, confidenceMin: v[0] })}
          />
        </div>
      </div>
    </Card>
  );
}