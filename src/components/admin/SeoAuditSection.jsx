import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, TrendingUp, AlertTriangle, Wrench, CheckCircle2, FileSearch } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

// Admin dashboard section: reads recent SeoAudit records and renders the latest
// score, issue counts, auto-fixed vs manual action items, and an 8-week score
// trend chart. Admin-only by the SeoAudit entity's RLS.
export default function SeoAuditSection() {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await base44.entities.SeoAudit.list('-audit_date', 8);
      setAudits(list || []);
    } catch (e) {
      setError(e.message || 'Failed to load SEO audits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const latest = audits[0];

  const trendData = audits
    .slice()
    .reverse()
    .map((a, i) => ({
      label: new Date(a.audit_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      score: a.overall_score || 0,
      index: i,
    }));

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!latest) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-bold">SEO Audits</h2>
        <p className="mt-2 text-sm text-muted-foreground">No audits have run yet. The weekly workflow will create the first record.</p>
      </div>
    );
  }

  const scoreColor = latest.overall_score >= 80 ? 'text-success' : latest.overall_score >= 50 ? 'text-warning' : 'text-destructive';

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">SEO Audits</h2>
        <span className="text-xs text-muted-foreground">{new Date(latest.audit_date).toLocaleString('en-GB')}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={TrendingUp} label="Overall Score" value={`${latest.overall_score}/100`} valueClass={scoreColor} />
        <Stat icon={FileSearch} label="Pages Audited" value={latest.pages_audited || 0} />
        <Stat icon={AlertTriangle} label="Issues Found" value={latest.issues_found || 0} />
        <Stat icon={Wrench} label="Auto-Fixed" value={latest.issues_fixed || 0} />
      </div>

      {trendData.length > 1 && (
        <div className="mt-6 h-48">
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Score Trend</p>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" /> Auto-Fixed ({(latest.auto_fixed_items || []).length})
          </p>
          {(latest.auto_fixed_items || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing was auto-fixed this run.</p>
          ) : (
            <ul className="space-y-1.5">
              {(latest.auto_fixed_items || []).map((item, i) => (
                <li key={i} className="rounded-lg border border-border bg-secondary p-2 text-sm">
                  <span className="font-semibold">{item.page}</span>: {item.issue} → <span className="text-success">{item.fix}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" /> Manual Action Items ({(latest.manual_action_items || []).length})
          </p>
          {(latest.manual_action_items || []).length === 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> No manual action needed.</p>
          ) : (
            <ul className="space-y-1.5">
              {(latest.manual_action_items || []).map((item, i) => (
                <li key={i} className={`rounded-lg border p-2 text-sm ${item.severity === 'critical' ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-secondary'}`}>
                  <span className="font-semibold">{item.page}</span>: {item.issue}
                  {item.recommendation && <p className="mt-0.5 text-xs text-muted-foreground">{item.recommendation}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, valueClass = '' }) {
  return (
    <div className="rounded-xl border border-border bg-secondary p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className={`mt-1 text-xl font-extrabold ${valueClass}`}>{value}</p>
    </div>
  );
}