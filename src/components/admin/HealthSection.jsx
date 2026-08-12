import React from 'react';
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

function Status({ label, status, error }) {
  const up = status === 'up';
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        {up ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-destructive" />}
        <span className="font-medium">{label}</span>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold ${up ? 'text-success' : 'text-destructive'}`}>{up ? 'Operational' : 'Down'}</p>
        {!up && error && <p className="text-xs text-muted-foreground">{error}</p>}
      </div>
    </div>
  );
}

export default function HealthSection({ health, generatedAt, onRefresh }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">System Health</h2>
        <Button size="sm" variant="ghost" onClick={onRefresh}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Status label="TCGDex API" status={health?.tcgdex?.status} error={health?.tcgdex?.error} />
        <Status label="Database" status={health?.database?.status} error={health?.database?.error} />
      </div>
      {generatedAt && <p className="mt-2 text-xs text-muted-foreground">Checked {new Date(generatedAt).toLocaleString()}</p>}
    </section>
  );
}