import React, { useState } from 'react';
import { BadgeCheck, Globe } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import DomainHandleModal from '@/components/profile/DomainHandleModal';

// Settings card shown under the Profile Privacy tab. Surfaces the current
// handle (platform default or a verified custom domain) and opens the
// migration/claim modal.
export default function DomainHandleCard() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const custom = user?.custom_handle;
  const verified = user?.handle_verified;
  const defaultHandle = `${user?.email?.split('@')[0] || 'collector'}.swappulse.org`;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Custom Domain Handle</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              @{custom || defaultHandle}
              {verified && <BadgeCheck className="h-3.5 w-3.5 text-success" />}
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
        >
          {custom ? 'Update' : 'Claim domain'}
        </button>
      </div>
      {open && <DomainHandleModal onClose={() => setOpen(false)} />}
    </div>
  );
}