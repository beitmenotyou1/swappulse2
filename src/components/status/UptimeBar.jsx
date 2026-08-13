import React from 'react';

const STATUS_COLORS = {
  operational: 'bg-success',
  degraded: 'bg-warning',
  outage: 'bg-destructive',
  maintenance: 'bg-primary',
};

export default function UptimeBar({ history = [] }) {
  const segments = 30;
  const recent = history.slice(0, segments).reverse();
  const bars = Array.from({ length: segments }, (_, i) => recent[i]?.status || 'operational');
  const operationalCount = bars.filter((s) => s === 'operational').length;
  const uptimePct = Math.round((operationalCount / segments) * 100);

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-0.5">
          {bars.map((status, i) => (
            <div
              key={i}
              className={`h-5 flex-1 rounded-sm ${STATUS_COLORS[status] || 'bg-success'}`}
              title={status}
            />
          ))}
        </div>
        <span className="text-xs font-semibold text-success">{uptimePct}%</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Last {segments} status checks</p>
    </div>
  );
}