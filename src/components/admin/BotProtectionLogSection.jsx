import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, ShieldAlert, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const OUTCOME_STYLE = {
  allowed: 'bg-secondary text-muted-foreground',
  challenged: 'bg-warning/15 text-warning',
  blocked: 'bg-destructive/15 text-destructive',
  challenge_passed: 'bg-success/15 text-success',
  challenge_failed: 'bg-destructive/15 text-destructive',
};

const FLAGGED = ['challenged', 'blocked', 'challenge_failed'];

export default function BotProtectionLogSection() {
  const [attempts, setAttempts] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [outcomeFilter, setOutcomeFilter] = useState('flagged');

  const load = async () => {
    setLoading(true);
    try {
      const query =
        outcomeFilter === 'flagged'
          ? { outcome: { $in: FLAGGED } }
          : outcomeFilter
            ? { outcome: outcomeFilter }
            : {};
      const res = await base44.entities.BotAttempt.filter(query, '-created_date', 50);
      const list = res || [];
      setAttempts(list);

      // Resolve actor details in one bulk User lookup.
      const ids = Array.from(new Set(list.map((a) => a.user_id).filter(Boolean)));
      if (ids.length) {
        const ulist = await base44.entities.User.list().catch(() => []);
        const map = {};
        for (const u of ulist || []) map[u.id] = u;
        setUsers(map);
      } else {
        setUsers({});
      }
    } catch (e) {
      console.error('BotProtectionLogSection load failed', e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [outcomeFilter]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Bot Protection Log</h2>
          <p className="text-sm text-muted-foreground">
            Flagged write actions caught by the bot-protection system, with the actor behind each.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="flagged">Flagged only</option>
            <option value="">All outcomes</option>
            <option value="blocked">Blocked</option>
            <option value="challenged">Challenged</option>
            <option value="challenge_failed">Challenge failed</option>
            <option value="challenge_passed">Challenge passed</option>
            <option value="allowed">Allowed (borderline)</option>
          </select>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : attempts.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No flagged actions recorded.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Outcome</th>
                <th className="px-3 py-2">Risk</th>
                <th className="px-3 py-2">Signals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {attempts.map((a) => {
                const u = a.user_id ? users[a.user_id] : null;
                return (
                  <tr key={a.id} className="hover:bg-secondary/50">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(a.created_date).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      {u ? (
                        <div className="space-y-0.5">
                          <div className="font-medium">{u.full_name || '—'}</div>
                          <div className="text-xs text-muted-foreground">{u.email || ''}</div>
                          {a.did && <div className="text-xs text-muted-foreground">{a.did}</div>}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {a.anon_id || (a.user_id ? `user ${a.user_id.slice(0, 8)}` : '—')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">{a.action_type}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${OUTCOME_STYLE[a.outcome] || 'bg-secondary'}`}>
                        {a.outcome}
                      </span>
                    </td>
                    <td className="px-3 py-2">{a.risk_score}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{(a.reasons || []).join(', ')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}