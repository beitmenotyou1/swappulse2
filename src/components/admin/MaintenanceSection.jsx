import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { RefreshCw, Trash2, Plus, Loader2, Wrench, Calendar } from 'lucide-react';

export default function MaintenanceSection() {
  const [windows, setWindows] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    starts_at: '',
    ends_at: '',
    affected_services: [],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [winRes, svcRes] = await Promise.all([
        base44.entities.StatusMaintenanceWindow.list('-starts_at', 50),
        base44.entities.StatusService.list('sort_order', 100),
      ]);
      setWindows(winRes || []);
      setServices(svcRes || []);
    } catch (e) {
      setWindows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm({ title: '', description: '', starts_at: '', ends_at: '', affected_services: [] });
    setShowForm(false);
    setError('');
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.starts_at || !form.ends_at) {
      setError('Title, start time, and end time are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await base44.functions.invoke('manage-service', {
        action: 'create_maintenance',
        title: form.title.trim(),
        description: form.description.trim(),
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        affected_services: form.affected_services,
      });
      if (res.data?.ok) {
        resetForm();
        await load();
      } else {
        setError(res.data?.error || 'Failed to create maintenance window.');
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to create maintenance window.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this maintenance window?')) return;
    try {
      await base44.functions.invoke('manage-service', { action: 'delete_maintenance', windowId: id });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Delete failed.');
    }
  };

  const toggleService = (slug) => {
    setForm((f) => ({
      ...f,
      affected_services: f.affected_services.includes(slug)
        ? f.affected_services.filter((s) => s !== slug)
        : [...f.affected_services, slug],
    }));
  };

  const formatDate = (iso) => new Date(iso).toLocaleString();

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-extrabold">Maintenance Windows</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="text-sm text-primary hover:underline disabled:opacity-50">
            <RefreshCw className={`inline h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      {showForm && (
        <div className="mb-4 space-y-3 rounded-xl border border-border p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Database maintenance window"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional details about the maintenance"
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Starts At</label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Ends At</label>
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Affected Services</label>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleService(s.slug)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border ${
                    form.affected_services.includes(s.slug)
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Window
            </button>
            <button
              onClick={resetForm}
              className="rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : windows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No maintenance windows scheduled.</p>
      ) : (
        <div className="space-y-2">
          {windows.map((w) => {
            const now = new Date();
            const isUpcoming = new Date(w.starts_at) > now;
            const isOngoing = new Date(w.starts_at) <= now && new Date(w.ends_at) > now;
            return (
              <div key={w.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{w.title}</p>
                      {isOngoing && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">Ongoing</span>}
                      {isUpcoming && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">Upcoming</span>}
                    </div>
                    {w.description && <p className="mt-1 text-xs text-muted-foreground">{w.description}</p>}
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(w.starts_at)} → {formatDate(w.ends_at)}
                    </p>
                    {(w.affected_services || []).length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">Affected: {w.affected_services.join(', ')}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(w.id)}
                    className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                    aria-label="Delete maintenance window"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}