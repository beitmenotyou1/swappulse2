import React from 'react';
import { Shield, Clock, KeyRound } from 'lucide-react';
import DomainHandleCard from '@/components/profile/DomainHandleCard';
import SettingRow from '@/components/settings/SettingRow';

export default function AccountSection({ settings, update }) {
  const sec = settings.security || {};
  return (
    <div className="space-y-4">
      <DomainHandleCard />

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="flex items-center gap-2 text-sm font-bold"><Shield className="h-4 w-4 text-primary" /> Authentication</p>
        <SettingRow
          label="Two-factor authentication"
          description="Require a second factor at login (TOTP / U2F enrolment coming soon)."
          checked={!!sec.mfaEnabled}
          onChange={(v) => update({ security: { mfaEnabled: v } })}
        />
        <div className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4 text-muted-foreground" /> Session timeout</p>
            <p className="text-xs text-muted-foreground">Auto-logout after inactivity.</p>
          </div>
          <select
            value={sec.sessionTimeout || 86400}
            onChange={(e) => update({ security: { sessionTimeout: Number(e.target.value) } })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value={3600}>1 hour</option>
            <option value={21600}>6 hours</option>
            <option value={86400}>24 hours</option>
            <option value={604800}>7 days</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
        <p className="mb-1 flex items-center gap-2 font-semibold text-foreground"><KeyRound className="h-4 w-4" /> Planned</p>
        U2F/WebAuthn key enrolment, encrypted backup codes, active-session revocation and account deletion are on the roadmap. Your toggles above are saved to your repository and ready for when those land.
      </div>
    </div>
  );
}