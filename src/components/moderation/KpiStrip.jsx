import React from 'react';
import { Card } from '@/components/ui/card';
import { Clock, CheckCircle2, AlertTriangle, Gauge, ShieldAlert, Activity } from 'lucide-react';

const items = [
  { key: 'pending', label: 'Pending Reviews', icon: Clock, color: 'text-primary' },
  { key: 'resolvedToday', label: 'Resolved Today', icon: CheckCircle2, color: 'text-success' },
  { key: 'highSeverity', label: 'High Severity', icon: AlertTriangle, color: 'text-destructive' },
  { key: 'avgResponseMin', label: 'Avg Response', suffix: 'm', icon: Gauge, color: 'text-muted-foreground' },
  { key: 'escalations', label: 'Escalations', icon: ShieldAlert, color: 'text-warning' },
  { key: 'autoResolved', label: 'Auto-Resolved', icon: Activity, color: 'text-muted-foreground' },
];

export default function KpiStrip({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {items.map((it) => {
        const Icon = it.icon;
        const val = stats[it.key] ?? 0;
        return (
          <Card key={it.key} className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className={`h-4 w-4 ${it.color}`} />
              <span className="truncate">{it.label}</span>
            </div>
            <p className="mt-1 text-2xl font-bold">
              {val}
              {it.suffix || ''}
            </p>
          </Card>
        );
      })}
    </div>
  );
}