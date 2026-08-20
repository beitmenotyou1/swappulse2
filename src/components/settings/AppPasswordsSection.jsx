import React, { useState, useEffect, useCallback } from 'react';
import { KeyRound, Plus, Loader2, Info } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AppPasswordRow from './AppPasswordRow';
import AppPasswordModal from './AppPasswordModal';

export default function AppPasswordsSection() {
  const [passwords, setPasswords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.AppPassword.list('-created_date', 100);
      setPasswords(list || []);
    } catch {
      setPasswords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h3 className="font-bold">App Passwords</h3>
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            App passwords let external AT Protocol apps (like Bluesky clients or third-party tools) access your
            collector data using your SwapPulse identity. Each password is scoped and can be revoked anytime. Use a
            separate password for each app.
          </span>
        </p>
        <button
          onClick={() => setModal({ action: 'create' })}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Create app password
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : passwords.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <KeyRound className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold">No app passwords yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Create one to connect external apps to your SwapPulse account.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {passwords.map((pw) => (
            <AppPasswordRow
              key={pw.id}
              item={pw}
              onReveal={(item) => setModal({ action: 'reveal', target: item })}
              onDelete={(item) => setModal({ action: 'delete', target: item })}
            />
          ))}
        </div>
      )}

      {modal && (
        <AppPasswordModal
          action={modal.action}
          target={modal.target}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}