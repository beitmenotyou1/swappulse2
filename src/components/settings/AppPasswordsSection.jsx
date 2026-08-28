import React, { useState, useEffect, useCallback } from 'react';
import { KeyRound, Loader2, Info, ShieldAlert } from 'lucide-react';
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
      const res = await base44.functions.invoke('list-app-passwords', {});
      setPasswords(res?.data?.items || []);
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
          <h3 className="font-bold">Legacy SwapPulse App Passwords</h3>
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            This older SwapPulse-specific credential system is being retired in favour of standard AT Protocol OAuth.
            New passwords can no longer be created or revealed. Existing credentials continue to work temporarily and
            can be revoked below.
          </span>
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>For Bluesky/PDS linking, use the AT Protocol section. Do not share your primary account password.</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : passwords.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <KeyRound className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold">No legacy app passwords</p>
          <p className="mt-1 text-xs text-muted-foreground">Nothing to revoke. New legacy credentials are disabled.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {passwords.map((pw) => (
            <AppPasswordRow
              key={pw.id}
              item={pw}
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