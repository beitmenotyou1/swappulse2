import React, { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Avatar from '@/components/Avatar';
import { useT } from '@/lib/i18n/I18nProvider';
import { getSafeHttpUrl } from '@/lib/externalLink';

// Discovery bar of live streams, surfaced on the home feed. Each entry links
// directly to the collector's external stream URL.
export default function SpaceBar() {
  const t = useT();
  const [spaces, setSpaces] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const all = await base44.entities.VoiceSpace.filter({ status: 'live' }, '-created_date', 30);
        setSpaces(all.filter((s) => getSafeHttpUrl(s.stream_url)).slice(0, 10));
      } catch {
        setSpaces([]);
      }
    })();
  }, []);

  if (!spaces.length) return null;
  return (
    <div className="border-b border-border bg-card/60">
      <div className="flex items-center gap-2 overflow-x-auto px-3 py-3">
        <div className="flex shrink-0 items-center gap-1.5 pr-2 text-xs font-bold uppercase tracking-wide text-destructive">
          <Radio className="h-4 w-4 animate-pulse" /> {t('feed.liveBadge')}
        </div>
        {spaces.map((s) => (
          <a
            key={s.id}
            href={getSafeHttpUrl(s.stream_url) || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 flex-col items-center gap-1"
          >
            <span className="relative inline-block">
              <span className="absolute -inset-0.5 animate-pulse rounded-full bg-destructive/60" />
              <Avatar name={s.host_name} src={s.host_avatar} size={48} className="relative" />
            </span>
            <span className="max-w-[64px] truncate text-[11px] font-semibold">{s.title}</span>
            <span className="text-[10px] text-destructive">● {t('feed.liveDot')}</span>
          </a>
        ))}
      </div>
    </div>
  );
}