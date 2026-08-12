import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Check, X, ShieldAlert, Bot } from 'lucide-react';

const actionIcon = { approve: Check, dismiss: X, escalate: ShieldAlert, 'auto-resolve': Bot, 'auto-escalate': Bot };
const actionColor = {
  approve: 'text-success',
  dismiss: 'text-muted-foreground',
  escalate: 'text-destructive',
  'auto-resolve': 'text-muted-foreground',
  'auto-escalate': 'text-warning',
};

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ActivityFeed({ logs, onRefresh }) {
  return (
    <Card className="h-fit p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold">Moderator Activity</h2>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-3">
        {logs.length === 0 && <p className="text-xs text-muted-foreground">No recent activity.</p>}
        {logs.map((log) => {
          const Icon = actionIcon[log.action] || Bot;
          return (
            <div key={log.id} className="border-l-2 border-border pl-3">
              <div className="flex items-center gap-2 text-xs">
                <Icon className={`h-3.5 w-3.5 ${actionColor[log.action] || 'text-muted-foreground'}`} />
                <span className="font-semibold">{log.auto_generated ? 'Auto' : log.moderator_name}</span>
                <span className="text-muted-foreground">{log.action}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                @{log.target_author || 'unknown'} • {timeAgo(log.created_date)}
              </p>
              {log.notes && <p className="mt-0.5 text-xs italic text-muted-foreground">"{log.notes}"</p>}
              {log.labels_affected && log.labels_affected.length > 0 && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">Labels: {log.labels_affected.join(', ')}</p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}