import React from 'react';
import { Eye, Trash2 } from 'lucide-react';

const SCOPE_STYLE = {
  read_only: { label: 'Read-only', cls: 'bg-success/15 text-success' },
  read_write: { label: 'Read & write', cls: 'bg-warning/15 text-warning-foreground' },
  full_access: { label: 'Full access', cls: 'bg-destructive/15 text-destructive' },
};

export default function AppPasswordRow({ item, onReveal, onDelete }) {
  const style = SCOPE_STYLE[item.scope] || SCOPE_STYLE.read_only;
  const created = new Date(item.created_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const lastUsed = item.last_used_at
    ? new Date(item.last_used_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : 'Never';

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{item.label}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${style.cls}`}>{style.label}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">Created {created} · Last used {lastUsed}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <button onClick={() => onReveal(item)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Reveal password" aria-label={`Reveal password for ${item.label}`}>
          <Eye className="h-4 w-4" />
        </button>
        <button onClick={() => onDelete(item)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete password" aria-label={`Delete password for ${item.label}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}