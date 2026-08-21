import React from 'react';
import { Globe, Plane } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';

// ExternalProfileBanner — informational strip shown directly below the banner
// image on a non-member's profile, declaring their Bluesky origin. When the
// external collector has migrated to SwapPulse (migrated_from_bluesky=true in
// the merged profile), shows a 'Moved to SwapPulse' banner instead, signaling
// that this Bluesky profile has been consolidated into a SwapPulse account.
export default function ExternalProfileBanner({ did, handle, migrated }) {
  const t = useT();
  if (!did) return null;

  if (migrated) {
    return (
      <div className="flex items-center gap-2 border border-t-0 border-primary/30 bg-primary/10 px-4 py-2.5 text-sm">
        <Plane className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="flex-1 font-semibold">
          {t('migration.externalMigrated')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 border border-t-0 border-primary/30 bg-primary/10 px-4 py-2.5 text-sm">
      <Globe className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="flex-1 font-semibold">
        {t('migration.externalNotMember')}
      </p>
    </div>
  );
}