import React from 'react';
import { Plane } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';

// MovedFromBlueskyBadge — a public badge shown on a collector's profile header
// when they have migrated their presence from Bluesky to SwapPulse. Visible to
// all visitors (logged in or not). Signals that this collector has consolidated
// their home base on SwapPulse.
export default function MovedFromBlueskyBadge({ size = 'sm' }) {
  const t = useT();
  const sizeClasses = size === 'md'
    ? 'text-xs px-2.5 py-1 gap-1.5'
    : 'text-[11px] px-2 py-0.5 gap-1';
  const iconSize = size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3';

  return (
    <span
      className={`inline-flex items-center rounded-full bg-primary/10 text-primary font-semibold ${sizeClasses}`}
      title={t('migration.badgeTooltip')}
    >
      <Plane className={iconSize} aria-hidden="true" />
      {t('migration.badgeLabel')}
    </span>
  );
}