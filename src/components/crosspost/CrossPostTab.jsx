import React, { useEffect, useState } from 'react';
import { Plus, Share2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import CrossPostRow from './CrossPostRow';
import CrossPostModal from './CrossPostModal';

// §7 — Cross-Posting settings tab. Lists the user's crossPostConfig records
// as row cards, with an Add Platform button that opens the authorisation
// flow modal.
export default function CrossPostTab() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try {
      const { did } = await ensureUserDid();
      const list = await base44.entities.CrossPostConfig.filter({ did }, '-created_at', 50);
      setConfigs(list);
    } catch {
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (c) => { setEditing(c); setModalOpen(true); };

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Share2 className="h-4 w-4" /> Auto-share your SwapPulse content to external platforms.
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : configs.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No platforms connected yet.</p>
      ) : (
        configs.map((c) => <CrossPostRow key={c.id} config={c} onEdit={() => openEdit(c)} onChanged={load} />)
      )}
      <button
        onClick={openAdd}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary"
        style={{ minHeight: 48 }}
      >
        <Plus className="h-4 w-4" /> Add Platform
      </button>
      <CrossPostModal open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); load(); }} />
    </div>
  );
}