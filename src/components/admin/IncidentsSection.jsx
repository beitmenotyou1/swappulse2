import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Send, Trash2, RefreshCw, Loader2, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import SettingSelect from '@/components/settings/SettingSelect';

const SEVERITIES = ['minor', 'major', 'critical'];
const STATUSES = ['investigating', 'identified', 'monitoring', 'resolved'];
const ALL_SERVICES = ['SwapPulse Platform', 'Database', 'TCGDex Catalog', 'Email Service', 'Push Notifications'];

export default function IncidentsSection() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newInc, setNewInc] = useState({
    title: '', severity: 'minor', status: 'investigating',
    affected: [], initialUpdate: '',
  });
  const [updateForms, setUpdateForms] = useState({});
  const [posting, setPosting] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.entities.StatusIncident.list('-started_at', 50);
      setIncidents(res || []);
    } catch (e) {
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newInc.title.trim()) return;
    setCreating(true);
    try {
      await base44.functions.invoke('manage-incident', {
        action: 'create',
        title: newInc.title,
        severity: newInc.severity,
        status: newInc.status,
        affected_services: newInc.affected,
        initial_update: newInc.initialUpdate,
      });
      setNewInc({ title: '', severity: 'minor', status: 'investigating', affected: [], initialUpdate: '' });
      setShowCreate(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to create incident');
    } finally {
      setCreating(false);
    }
  };

  const handleAddUpdate = async (incidentId) => {
    const form = updateForms[incidentId];
    if (!form?.text?.trim()) return;
    setPosting({ ...posting, [incidentId]: true });
    try {
      await base44.functions.invoke('manage-incident', {
        action: 'update',
        incident_id: incidentId,
        text: form.text,
        status: form.status || undefined,
      });
      setUpdateForms({ ...updateForms, [incidentId]: { text: '', status: '' } });
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to post update');
    } finally {
      setPosting({ ...posting, [incidentId]: false });
    }
  };

  const handleDelete = async (incidentId) => {
    if (!confirm('Delete this incident permanently?')) return;
    try {
      await base44.functions.invoke('manage-incident', { action: 'delete', incident_id: incidentId });
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to delete');
    }
  };

  const toggleService = (name) => {
    setNewInc((prev) => ({
      ...prev,
      affected: prev.affected.includes(name)
        ? prev.affected.filter((s) => s !== name)
        : [...prev.affected, name],
    }));
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">Status Incidents</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="mr-1.5 h-4 w-4" /> New Incident
          </Button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-4 space-y-3 rounded-lg border border-border bg-background p-3">
          <input
            value={newInc.title}
            onChange={(e) => setNewInc({ ...newInc, title: e.target.value })}
            placeholder="Incident title (e.g. TCGDex API Latency)"
            required
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <SettingSelect
              value={newInc.severity}
              onChange={(v) => setNewInc({ ...newInc, severity: v })}
              label="Severity"
              options={SEVERITIES.map((s) => ({ value: s, label: s }))}
            />
            <SettingSelect
              value={newInc.status}
              onChange={(v) => setNewInc({ ...newInc, status: v })}
              label="Status"
              options={STATUSES.map((s) => ({ value: s, label: s }))}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_SERVICES.map((svc) => (
              <button
                key={svc}
                type="button"
                onClick={() => toggleService(svc)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  newInc.affected.includes(svc)
                    ? 'bg-primary text-white'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                {svc}
              </button>
            ))}
          </div>
          <textarea
            value={newInc.initialUpdate}
            onChange={(e) => setNewInc({ ...newInc, initialUpdate: e.target.value })}
            placeholder="Initial update message for subscribers…"
            rows={2}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={creating}>
              {creating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Create & Notify Subscribers
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : incidents.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No incidents recorded.</p>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => (
            <AdminIncidentCard
              key={inc.id}
              incident={inc}
              updateForm={updateForms[inc.id] || { text: '', status: '' }}
              setUpdateForm={(form) => setUpdateForms({ ...updateForms, [inc.id]: form })}
              onAddUpdate={() => handleAddUpdate(inc.id)}
              onDelete={() => handleDelete(inc.id)}
              posting={posting[inc.id]}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AdminIncidentCard({ incident, updateForm, setUpdateForm, onAddUpdate, onDelete, posting }) {
  const [expanded, setExpanded] = useState(false);
  const updates = incident.updates || [];

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <button onClick={() => setExpanded(!expanded)} className="flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold">{incident.title}</p>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{incident.severity}</span>
            <span className={`text-xs font-semibold ${
              incident.status === 'resolved' ? 'text-success' : 'text-warning'
            }`}>{incident.status}</span>
            {incident.auto_created && <span className="text-xs text-muted-foreground">auto</span>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(incident.started_at).toLocaleString()}
            {(incident.affected_services || []).length > 0 && ` · ${incident.affected_services.join(', ')}`}
          </p>
        </button>
        <div className="flex items-center gap-1">
          <button aria-label="Toggle incident details" onClick={() => setExpanded(!expanded)} className="rounded p-1 hover:bg-secondary">
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <button aria-label="Delete incident" onClick={onDelete} className="rounded p-1 text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {updates.length > 0 && (
            <div className="space-y-2 border-l-2 border-primary/30 pl-3">
              {updates.map((upd, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{new Date(upd.created_at).toLocaleString()}</span>
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">{upd.status}</span>
                    <span className="text-xs text-muted-foreground">{upd.authored_by}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{upd.text}</p>
                </div>
              ))}
            </div>
          )}

          {incident.status !== 'resolved' && (
            <div className="space-y-2 rounded border border-border p-2">
              <textarea
                value={updateForm.text}
                onChange={(e) => setUpdateForm({ ...updateForm, text: e.target.value })}
                placeholder="Post an update for subscribers…"
                rows={2}
                className="w-full rounded border border-border bg-card px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
              <div className="flex gap-2">
                <SettingSelect
                  value={updateForm.status}
                  onChange={(v) => setUpdateForm({ ...updateForm, status: v })}
                  label="Status"
                  options={[{ value: '', label: 'Keep status' }, ...STATUSES.map((s) => ({ value: s, label: s }))]}
                />
                <Button size="sm" onClick={onAddUpdate} disabled={posting || !updateForm.text?.trim()}>
                  {posting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                  Post Update
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}