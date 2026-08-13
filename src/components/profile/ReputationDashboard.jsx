import React, { useMemo } from 'react';
import { Star, TrendingUp, CheckCircle2, XCircle, Award, MessageSquare } from 'lucide-react';
import { timeAgo } from '@/lib/format';
import Avatar from '@/components/Avatar';

export default function ReputationDashboard({ reputation, trades }) {
  const stats = useMemo(() => {
    const totalTrades = trades.length;
    const completed = trades.filter((t) => t.status === 'completed').length;
    const cancelled = trades.filter((t) => t.status === 'cancelled').length;
    const active = totalTrades - completed - cancelled;
    const completionRate = (completed + cancelled) > 0
      ? Math.round((completed / (completed + cancelled)) * 100)
      : 0;

    const avg = reputation.length
      ? (reputation.reduce((s, r) => s + (r.rating || 0), 0) / reputation.length).toFixed(1)
      : null;

    const positive = reputation.filter((r) => r.rating >= 4);
    const fiveStar = reputation.filter((r) => r.rating === 5).length;
    const dist = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: reputation.filter((r) => r.rating === star).length,
    }));
    const maxDist = Math.max(...dist.map((d) => d.count), 1);

    return { totalTrades, completed, cancelled, active, completionRate, avg, positive, fiveStar, dist, maxDist };
  }, [reputation, trades]);

  const hasData = reputation.length > 0 || trades.length > 0;

  if (!hasData) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No reputation data yet. Complete trades and collect feedback to build your trust score.
      </p>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Top stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-1.5">
            <Star className="h-4 w-4 text-accent" />
            <span className="text-xs font-semibold uppercase text-muted-foreground">Avg Rating</span>
          </div>
          <p className="mt-1.5 text-2xl font-extrabold text-accent">{stats.avg || '—'}</p>
          {reputation.length > 0 && (
            <p className="text-xs text-muted-foreground">{reputation.length} review{reputation.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-1.5">
            <Award className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase text-muted-foreground">5-Star</span>
          </div>
          <p className="mt-1.5 text-2xl font-extrabold">{stats.fiveStar}</p>
          <p className="text-xs text-muted-foreground">top marks</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-success" />
            <span className="text-xs font-semibold uppercase text-muted-foreground">Completed</span>
          </div>
          <p className="mt-1.5 text-2xl font-extrabold">{stats.completed}</p>
          <p className="text-xs text-muted-foreground">of {stats.totalTrades} trades</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-xs font-semibold uppercase text-muted-foreground">Success Rate</span>
          </div>
          <p className="mt-1.5 text-2xl font-extrabold text-success">{stats.completionRate}%</p>
          <p className="text-xs text-muted-foreground">completion</p>
        </div>
      </div>

      {/* Trade completion breakdown */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold">Trade Completion</h3>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-secondary">
          {stats.completed > 0 && (
            <div className="h-full bg-success" style={{ width: `${(stats.completed / stats.totalTrades) * 100}%` }} title={`${stats.completed} completed`} />
          )}
          {stats.active > 0 && (
            <div className="h-full bg-primary" style={{ width: `${(stats.active / stats.totalTrades) * 100}%` }} title={`${stats.active} active`} />
          )}
          {stats.cancelled > 0 && (
            <div className="h-full bg-destructive" style={{ width: `${(stats.cancelled / stats.totalTrades) * 100}%` }} title={`${stats.cancelled} cancelled`} />
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Completed ({stats.completed})</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Active ({stats.active})</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Cancelled ({stats.cancelled})</span>
        </div>
      </div>

      {/* Star distribution */}
      {reputation.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold">Rating Distribution</h3>
          <div className="mt-3 space-y-1.5">
            {stats.dist.map((d) => (
              <div key={d.star} className="flex items-center gap-2">
                <span className="flex w-3 text-xs text-muted-foreground">{d.star}</span>
                <Star className="h-3 w-3 fill-accent text-accent" />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-accent/60" style={{ width: `${(d.count / stats.maxDist) * 100}%` }} />
                </div>
                <span className="w-4 text-right text-xs text-muted-foreground">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent positive feedback */}
      {stats.positive.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">Recent Positive Feedback</h3>
          </div>
          <div className="mt-3 space-y-3">
            {stats.positive.slice(0, 5).map((r) => (
              <div key={r.id} className="flex gap-2.5 border-t border-border pt-3 first:border-0 first:pt-0">
                <Avatar name={r.rater_name} size={32} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{r.rater_name || 'Collector'}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(r.created_date)}</span>
                  </div>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-3 w-3 ${n <= r.rating ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} />
                    ))}
                  </div>
                  {r.comment && <p className="mt-1 text-xs text-muted-foreground">{r.comment}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}