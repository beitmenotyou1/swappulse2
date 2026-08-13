import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2, XCircle, AlertCircle, Wrench, ChevronDown, Loader2,
} from 'lucide-react';
import UptimeBar from './UptimeBar';

const STATUS_STYLES = {
  operational: { icon: CheckCircle2, color: 'text-success', label: 'Operational' },
  degraded: { icon: AlertCircle, color: 'text-warning', label: 'Degraded' },
  outage: { icon: XCircle, color: 'text-destructive', label: 'Outage' },
  maintenance: { icon: Wrench, color: 'text-primary', label: 'Maintenance' },
};

export default function ServiceRow({ service, liveStatus, latency, criticalityLabel }) {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [fetched, setFetched] = useState(false);

  const status = liveStatus || service.current_status || 'operational';
  const style = STATUS_STYLES[status] || STATUS_STYLES.operational;
  const Icon = style.icon;

  const handleExpand = async () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    if (newExpanded && !fetched) {
      setLoadingHistory(true);
      try {
        const records = await base44.entities.StatusUpdate.filter(
          { service_slug: service.slug },
          '-created_date',
          30,
        );
        setHistory(records || []);
      } catch (e) {
        setHistory([]);
      } finally {
        setLoadingHistory(false);
        setFetched(true);
      }
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        onClick={handleExpand}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 shrink-0 ${style.color}`} />
          <div>
            <p className="text-sm font-bold">{service.name}</p>
            <p className="text-xs text-muted-foreground">{service.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className={`text-sm font-semibold ${style.color}`}>{style.label}</p>
            {latency != null && <p className="text-xs text-muted-foreground">{latency}ms</p>}
            <span className="text-xs text-muted-foreground">{criticalityLabel}</span>
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border p-4">
          <div className="mb-4">
            <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">Recent Uptime</p>
            <UptimeBar history={history} />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Status History</p>
          {loadingHistory ? (
            <div className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No status changes recorded yet. This service has been operational since monitoring began.
            </p>
          ) : (
            <div className="space-y-2.5">
              {history.map((upd) => {
                const updStyle = STATUS_STYLES[upd.status] || STATUS_STYLES.operational;
                const UpdIcon = updStyle.icon;
                return (
                  <div key={upd.id} className="flex items-start gap-2 text-xs">
                    <UpdIcon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${updStyle.color}`} />
                    <div className="flex-1">
                      <p className="text-muted-foreground">{upd.message}</p>
                      <p className="mt-0.5 text-muted-foreground/70">
                        {new Date(upd.created_date).toLocaleString()} · by {upd.authored_by} · {upd.type}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}