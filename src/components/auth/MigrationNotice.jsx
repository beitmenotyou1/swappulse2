import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Mail } from 'lucide-react';

// §11.2/11.3 — informs legacy Google users that login is now password-only,
// and routes them into the email-reset migration flow (Option B).
export default function MigrationNotice() {
  return (
    <div className="mb-6 rounded-xl border border-warning/30 bg-warning/10 p-4">
      <div className="mb-1 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-warning" />
        <p className="text-sm font-bold">Google sign-in has moved to passwords</p>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        SwapPulse now uses password-only login for self-sovereign identity. If you signed
        in with Google before, set a password to keep full access — your collection,
        trades and reputation are preserved.
      </p>
      <Link
        to="/forgot-password?migration=1"
        className="inline-flex items-center gap-1.5 rounded-full bg-warning px-3 py-1.5 text-xs font-bold text-warning-foreground hover:opacity-90"
      >
        <Mail className="h-3.5 w-3.5" /> Migrate my account
      </Link>
    </div>
  );
}