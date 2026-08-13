import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Loader2 } from 'lucide-react';

const SEVERITY_BADGE = {
  critical: 'bg-destructive/15 text-destructive',
  major: 'bg-warning/15 text-warning',
  minor: 'bg-primary/15 text-primary',
};

const STATUS_COLOR = {
  investigating: 'text-destructive',
  identified: 'text-warning',
  monitoring: 'text-primary',
  resolved: 'text-success',
};

export default function IncidentDetail() {
  const { incidentId } = useParams();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!incidentId) return;
    setLoading(true);
    base44.entities.StatusIncident.get(incidentId)
      .then((data) => setIncident(data))
      .catch((e) => setError(e.message || 'Failed to load incident'))
      .finally(() => setLoading(false));
  }, [incidentId]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to="/status" className="rounded-full p-1.5 hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-extrabold tracking-tight">Incident Details</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 p-4">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {incident && (
          <>
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-2xl font-extrabold">{incident.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className={`font-semibold capitalize ${STATUS_COLOR[incident.status] || ''}`}>
                  {incident.status}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_BADGE[incident.severity] || ''}`}>
                  {incident.severity}
                </span>
                <span>Started {new Date(incident.started_at).toLocaleString()}</span>
                {incident.resolved_at && (
                  <span>Resolved {new Date(incident.resolved_at).toLocaleString()}</span>
                )}
              </div>

              {(incident.affected_services || []).length > 0 && (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Affected Services
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {incident.affected_services.map((s, i) => (
                      <span key={i} className="rounded-md bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Incident Timeline
              </h3>
              {(incident.updates || []).length === 0 ? (
                <p className="text-sm italic text-muted-foreground">No updates have been posted yet.</p>
              ) : (
                <div className="space-y-0">
                  {incident.updates.map((upd, i) => {
                    const isLast = i === incident.updates.length - 1;
                    return (
                      <div
                        key={i}
                        className={`relative pl-8 ${!isLast ? 'pb-6 border-l-2 border-primary/30' : 'border-l-2 border-transparent'}`}
                      >
                        <div className={`absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-background ${
                          upd.status === 'resolved' ? 'bg-success'
                          : upd.status === 'monitoring' ? 'bg-primary'
                          : upd.status === 'identified' ? 'bg-warning'
                          : 'bg-destructive'
                        }`} />
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            {new Date(upd.created_at).toLocaleString()}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            upd.status === 'resolved' ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary'
                          }`}>{upd.status}</span>
                          <span className="text-xs text-muted-foreground">by {upd.authored_by}</span>
                        </div>
                        <p className="mt-1 text-sm">{upd.text}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Link to="/status" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> Back to status page
            </Link>
          </>
        )}
      </div>
    </div>
  );
}