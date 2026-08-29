import React, { useState } from 'react';
import { Mail, Loader2, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

// Weekly email digest toggle - stored on the user record via auth.updateMe.
export default function WeeklyDigestToggle() {
  const { user } = useAuth();
  const [on, setOn] = useState(!!user?.weekly_digest);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const toggle = async () => {
    const next = !on;
    setSaving(true);
    setMsg('');
    try {
      await base44.auth.updateMe({ weekly_digest: next });
      setOn(next);
      setMsg(next ? 'Digest enabled - you’ll get a summary every week.' : 'Digest turned off.');
    } catch (e) {
      setMsg('Could not update preference: ' + (e.message || 'unknown error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold">Weekly email digest</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Get a weekly summary of your portfolio value, recent additions, wishlist and open trades
            delivered to {user?.email || 'your inbox'}.
          </p>
        </div>
        <button aria-label="Weekly digest emails"
          onClick={toggle}
          disabled={saving}
          role="switch"
          aria-checked={on}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-secondary'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      {saving && <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</div>}
      {msg && !saving && (
        <p className={`mt-2 flex items-center gap-1 text-xs ${on ? 'text-success' : 'text-muted-foreground'}`}>
          <Check className="h-3 w-3" /> {msg}
        </p>
      )}
    </div>
  );
}