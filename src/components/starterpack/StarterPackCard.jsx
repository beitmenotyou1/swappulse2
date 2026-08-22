import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Sparkles, Rss } from 'lucide-react';
import LiveAvatar from '@/components/LiveAvatar';

const CATEGORY_TONE = {
  vintage: 'text-rarity-holo',
  modern: 'text-rarity-rare',
  competitive: 'text-rarity-ex',
  investment: 'text-success',
  sealed: 'text-accent',
  japanese: 'text-rarity-secret',
  trading: 'text-primary',
  general: 'text-muted-foreground',
};

export default function StarterPackCard({ pack }) {
  const memberCount = (pack.member_dids || []).length;
  const circleCount = (pack.circle_ids || []).length;
  const feedCount = (pack.feed_uris || []).length;
  return (
    <Link
      to={`/starter-packs/${pack.id}`}
      className="block overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/40 hover:shadow-raised"
    >
      {pack.cover_image_url ? (
        <div className="h-20 w-full overflow-hidden bg-secondary">
          <img src={pack.cover_image_url} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="h-20 w-full bg-gradient-to-br from-primary/15 to-accent/10" />
      )}
      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className={`rounded-full bg-secondary px-2 py-0.5 text-xs font-bold capitalize ${CATEGORY_TONE[pack.category] || 'text-muted-foreground'}`}>
            {pack.category}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">{pack.subscriber_count || 0} subs</span>
        </div>
        <h3 className="mt-2 font-bold leading-tight">{pack.name}</h3>
        {pack.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{pack.description}</p>}
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {memberCount}</span>
          {circleCount > 0 && <span className="flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" /> {circleCount}</span>}
          {feedCount > 0 && <span className="flex items-center gap-1"><Rss className="h-3.5 w-3.5" /> {feedCount}</span>}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <LiveAvatar did={pack.did} name={pack.author_name} src={pack.author_avatar} size={18} />
          <span className="truncate text-xs text-muted-foreground">{pack.author_name || 'Collector'}</span>
        </div>
      </div>
    </Link>
  );
}