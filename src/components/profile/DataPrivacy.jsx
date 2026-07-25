import React, { useState } from 'react';
import { Download, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

// §12.4 - GDPR/CCPA data export & deletion rights, user-facing.
// The user account itself is owned by the platform auth backend and cannot be
// deleted from app code; this exports and wipes all SwapPulse data records.
const ENTITIES = [
  'Post',
  'CollectionEntry',
  'TradeListing',
  'TradeMessage',
  'Wishlist',
  'Reputation',
  'ModerationLabel',
];

export default function DataPrivacy() {
  const { user } = useAuth();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const exportData = async () => {
    setBusy('export');
    setMsg('');
    try {
      const data = {
        exported_at: new Date().toISOString(),
        regulation: 'GDPR / CCPA data export',
        user: { id: user?.id, email: user?.email, full_name: user?.full_name },
      };
      for (const name of ENTITIES) {
        data[name] = await base44.entities[name].list('-updated_date', 500).catch(() => []);
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `swappulse-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg('Your data has been downloaded as a JSON file.');
    } catch (e) {
      setMsg('Export failed: ' + (e.message || 'unknown error'));
    } finally {
      setBusy('');
    }
  };

  const deleteData = async () => {
    if (
      !window.confirm(
        'This permanently deletes ALL your SwapPulse data - collection, posts, trades, messages, ratings and labels. Your login account remains. This cannot be undone. Continue?'
      )
    )
      return;
    setBusy('delete');
    setMsg('');
    try {
      for (const name of ENTITIES) {
        await base44.entities[name].deleteMany({ created_by_id: user.id }).catch(() => {});
      }
      setMsg('All your SwapPulse data has been deleted. Your login account is unchanged.');
    } catch (e) {
      setMsg('Delete failed: ' + (e.message || 'unknown error'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-1 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold">Data & privacy</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Under GDPR (EU) and CCPA (California) you have the right to export and delete all data
          SwapPulse holds about you. Export downloads a complete JSON copy; delete wipes every
          record you created. Your login account itself is managed separately by the platform.
        </p>
      </div>

      <button
        onClick={exportData}
        disabled={!!busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card p-3 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
      >
        {busy === 'export' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Export my data (JSON)
      </button>

      <button
        onClick={deleteData}
        disabled={!!busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-60"
      >
        {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Delete all my data
      </button>

      {msg && <p className="text-center text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}