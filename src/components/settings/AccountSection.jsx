import React from 'react';
import { Fingerprint, Copy, Check } from 'lucide-react';
import DomainHandleCard from '@/components/profile/DomainHandleCard';
import ChainIdentityCard from '@/components/settings/ChainIdentityCard';
import AgeEligibilityCard from '@/components/settings/AgeEligibilityCard';
import DeleteAccountSection from '@/components/settings/DeleteAccountSection';
import { useAuth } from '@/lib/AuthContext';

export default function AccountSection() {
  const { user } = useAuth();
  const [copied, setCopied] = React.useState(false);

  const copyAccountId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-4">
      <DomainHandleCard />
      <AgeEligibilityCard />
      <ChainIdentityCard />

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="flex items-center gap-2 text-sm font-bold"><Fingerprint className="h-4 w-4 text-primary" /> Permanent Account ID</p>
        <p className="mt-1 text-xs text-muted-foreground">This immutable identifier is tied to your account permanently. It never changes, even if you update your email or username. Keep it private, it's visible only to you here in Settings.</p>
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <code className="flex-1 truncate font-mono text-xs text-muted-foreground">{user?.id || '–'}</code>
          <button
            onClick={copyAccountId}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Copy account ID"
          >
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <DeleteAccountSection />
    </div>
  );
}