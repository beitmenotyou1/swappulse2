import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Heart, Repeat2, List, Users, Bell, RefreshCw,
  CheckCircle2, Loader2, XCircle, Circle, Info,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';

// SyncDashboard — surfaces per-category AT Protocol sync status so users can
// see exactly what's synced (posts, likes, reposts, lists, follows,
// notifications) and retry any failed category. Reads from get-sync-status
// and auto-refreshes every 30s while mounted.

const CATEGORIES = [
  { key: 'posts', label: 'Posts', icon: FileText, fn: 'backfill-author-posts' },
  { key: 'likes', label: 'Likes', icon: Heart, fn: 'backfill-likes' },
  { key: 'reposts', label: 'Reposts', icon: Repeat2, fn: 'backfill-reposts' },
  { key: 'lists', label: 'Lists & Starter Packs', icon: List, fn: 'backfill-lists' },
  { key: 'follows', label: 'Social Graph', icon: Users, fn: 'import-atproto-graph' },
  { key: 'notifications', label: 'Notifications', icon: Bell, fn: 'import-notification-snapshot' },
];

const STATUS_META = {
  complete: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', label: 'Complete' },
  in_progress: { icon: Loader2, color: 'text-primary', bg: 'bg-primary/10', label: 'In progress' },
  failed: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Failed' },
  not_started: { icon: Circle, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Not started' },
};

function formatNumber(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.not_started;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.color}`}>
      <Icon className={`h-3 w-3 ${status === 'in_progress' ? 'animate-spin' : ''}`} />
      {meta.label}
    </span>
  );
}

function CategoryRow({ category, state, onRetry, retrying }) {
  const Icon = category.icon;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{category.label}</span>
          <StatusBadge status={state?.status || 'not_started'} />
        </div>
        {state?.error && state.status === 'failed' && (
          <p className="mt-0.5 text-[11px] text-destructive/80 truncate">{state.error}</p>
        )}
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-foreground">{formatNumber(state?.count || 0)}</p>
        <p className="text-[10px] text-muted-foreground">synced</p>
      </div>
      {state?.status === 'failed' && (
        <button
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
        >
          {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Retry
        </button>
      )}
    </div>
  );
}

export default function SyncDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('get-sync-status', {});
      const data = res?.data ?? res;
      if (data?.ok) setStatus(data);
    } catch (e) {
      console.error('SyncDashboard: fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleRetry = async (category) => {
    setRetrying(category.key);
    try {
      let hasMore = true;
      let safety = 0;
      while (hasMore && safety < 50) {
        const res = await base44.functions.invoke(category.fn, {});
        const result = res?.data ?? res;
        hasMore = !!result?.hasMore;
        safety++;
        if (!result?.ok) break;
      }
      toast({ title: `${category.label} sync complete` });
      await fetchStatus();
    } catch (e) {
      toast({ title: 'Retry failed', description: e?.message || '', variant: 'destructive' });
    } finally {
      setRetrying('');
    }
  };

  if (!user?.bsky_handle) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4">
        <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Info className="h-4 w-4" /> Link your Bluesky account above to start syncing.
        </p>
      </div>
    );
  }

  if (loading && !status) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-bold">Sync Status</p>
        <div className="space-y-3">
          {CATEGORIES.map((c) => (
            <div key={c.key} className="flex items-center gap-3 py-2">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-secondary animate-pulse" />
              <div className="flex-1">
                <div className="h-3 w-24 rounded bg-secondary animate-pulse" />
              </div>
              <div className="h-3 w-10 rounded bg-secondary animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const categories = status?.categories || {};

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold">Sync Status</p>
        <button
          onClick={fetchStatus}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Your Bluesky history syncs to SwapPulse automatically. Counts update every 30 seconds.
      </p>
      <div className="divide-y divide-border">
        {CATEGORIES.map((c) => (
          <CategoryRow
            key={c.key}
            category={c}
            state={categories[c.key]}
            onRetry={() => handleRetry(c)}
            retrying={retrying === c.key}
          />
        ))}
      </div>
      {status?.profile_sync?.fail_count > 0 && (
        <p className="mt-3 text-[11px] text-warning">
          Profile sync has failed {status.profile_sync.fail_count} time(s) — the next workflow cycle will retry automatically.
        </p>
      )}
    </div>
  );
}