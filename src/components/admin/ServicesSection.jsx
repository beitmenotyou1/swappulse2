import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { RefreshCw, ChevronDown, Loader2, Save, Activity } from 'lucide-react';
import SettingSelect from '@/components/settings/SettingSelect';

const STATUS_OPTIONS = [
  { value: 'operational', label: 'Operational', color: 'text-success' },
  { value: 'degraded', label: 'Degraded', color: 'text-warning' },
  { value: 'outage', label: 'Outage', color: 'text-destructive' },
  { value: 'maintenance', label: 'Maintenance', color: 'text-primary' },
];

const STATUS_DOT = {
  operational: 'bg-success',
  degraded: 'bg-warning',
  outage: 'bg-destructive',
  maintenance: 'bg-primary',
};

export default function ServicesSection() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [editMsg, setEditMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.entities.StatusService.list('sort_order', 100);
      setServices(res || []);
    } catch (e) {
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async (service) => {
    if (!editStatus || !editMsg.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await base44.functions.invoke('manage-service', {
        action: 'update_status',
        serviceId: service.id,
        status: editStatus,
        message: editMsg.trim(),
      });
      if (res.data?.ok) {
        setFeedback({ type: 'success', text: `${service.name} updated to ${editStatus}` });
        setExpandedId(null);
        setEditStatus('');
        setEditMsg('');
        await load();
      } else {
        setFeedback({ type: 'error', text: res.data?.error || 'Update failed' });
      }
    } catch (e) {
      setFeedback({ type: 'error', text: e.response?.data?.error || e.message || 'Update failed' });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (service) => {
    setExpandedId(expandedId === service.id ? null : service.id);
    setEditStatus(service.current_status || 'operational');
    setEditMsg('');
    setFeedback(null);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-extrabold">Service Status Management</h2>
        </div>
        <button onClick={load} disabled={loading} className="text-sm text-primary hover:underline disabled:opacity-50">
          <RefreshCw className={`inline h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {feedback && (
        <div className={`mb-3 rounded-lg p-2 text-sm ${feedback.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
          {feedback.text}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : services.length === 0 ? (
        <p className="text-sm text-muted-foreground">No services found.</p>
      ) : (
        <div className="space-y-2">
          {services.map((svc) => {
            const isOpen = expandedId === svc.id;
            return (
              <div key={svc.id} className="rounded-xl border border-border">
                <button
                  onClick={() => openEdit(svc)}
                  className="flex w-full items-center justify-between p-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[svc.current_status] || 'bg-muted'}`} />
                    <div>
                      <p className="text-sm font-bold">{svc.name}</p>
                      <p className="text-xs text-muted-foreground">{svc.slug} · {svc.criticality}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${(STATUS_OPTIONS.find(o => o.value === svc.current_status) || {}).color || 'text-muted-foreground'}`}>
                      {svc.current_status}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border p-3">
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">New Status</label>
                    <SettingSelect
                      value={editStatus}
                      onChange={setEditStatus}
                      label="New Status"
                      options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                      className="mb-3"
                    />
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">Message</label>
                    <textarea
                      value={editMsg}
                      onChange={(e) => setEditMsg(e.target.value)}
                      placeholder="e.g. Investigating elevated latency on the collection service…"
                      rows={2}
                      className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => handleUpdate(svc)}
                      disabled={saving || !editMsg.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Apply Update
                    </button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      This will create a manual status update record and auto-manage incidents.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}