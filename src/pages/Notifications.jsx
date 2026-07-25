import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2, ArrowLeftRight, TrendingDown, Heart, UserPlus, AtSign, Radio, Mic, Star, MessageSquare } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { useNotifications } from '@/hooks/useNotifications';
import Avatar from '@/components/Avatar';
import PageHeader from '@/components/PageHeader';
import { Image } from '@/components/ui/image';

const ACTION_META = {
  trade_match: { Icon: ArrowLeftRight, tint: 'text-primary' },
  price_alert: { Icon: TrendingDown, tint: 'text-success' },
  reaction: { Icon: Heart, tint: 'text-destructive' },
  like: { Icon: Heart, tint: 'text-destructive' },
  follow: { Icon: UserPlus, tint: 'text-primary' },
  mention: { Icon: AtSign, tint: 'text-primary' },
  voice_live: { Icon: Radio, tint: 'text-destructive' },
  podcast: { Icon: Mic, tint: 'text-primary' },
  reputation: { Icon: Star, tint: 'text-accent' },
  message: { Icon: MessageSquare, tint: 'text-primary' },
  pack_pull: { Icon: Star, tint: 'text-accent' },
};

function describe(n) {
  const actor = n.actor_name || 'Someone';
  switch (n.action_type) {
    case 'trade_match': return `${actor} listed a trade matching your wishlist`;
    case 'price_alert': return `Price drop on ${n.target_label || 'a wishlist card'}`;
    case 'reaction':
    case 'like': return `${actor} reacted to your ${n.target_label || 'post'}`;
    case 'follow': return `${actor} followed you`;
    case 'mention': return `${actor} mentioned you`;
    case 'voice_live': return `${actor} went live`;
    case 'podcast': return `${actor} published a new podcast`;
    case 'reputation': return 'Your reputation was updated';
    case 'message': return `${actor} sent you a trade message`;
    case 'pack_pull': return `${actor} pulled a card on your wishlist`;
    default: return `${actor} notified you`;
  }
}

export default function Notifications() {
  const navigate = useNavigate();
  const { items, loading, unreadCount, markRead, markAllRead } = useNotifications();
  const [filterUnread, setFilterUnread] = useState(false);

  const visible = filterUnread ? items.filter((n) => !n.is_read) : items;

  const open = async (n) => {
    if (!n.is_read) await markRead(n.id);
    if (n.target_path) navigate(n.target_path);
  };

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Trade matches, price drops and activity from across SwapPulse">
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary"
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        )}
      </PageHeader>

      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <span className="relative flex h-2.5 w-2.5">
          {unreadCount > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />}
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
        </span>
        <span className="text-sm font-bold">{unreadCount}</span>
        <span className="text-xs text-muted-foreground">unread</span>
        <button
          onClick={() => setFilterUnread((v) => !v)}
          className={`ml-auto rounded-full px-3 py-1.5 text-xs font-semibold ${filterUnread ? 'bg-primary text-primary-foreground' : 'border border-border bg-card'}`}
        >
          {filterUnread ? 'Unread only' : 'All'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Bell className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold">{filterUnread ? 'No unread notifications' : 'No notifications yet'}</p>
          <p className="text-xs text-muted-foreground">Trade matches and price alerts will show up here.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {visible.map((n) => {
            const meta = ACTION_META[n.action_type] || { Icon: Bell, tint: 'text-muted-foreground' };
            const unread = !n.is_read;
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60 ${unread ? 'bg-primary/5' : ''}`}
              >
                <span className="mt-1.5 w-2 shrink-0">
                  {unread && <span className="block h-2 w-2 rounded-full bg-primary" />}
                </span>
                <div className="relative shrink-0">
                  <Avatar name={n.actor_name} src={n.actor_avatar} size={40} />
                  <span className={`absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-background ring-1 ring-border ${meta.tint}`}>
                    <meta.Icon className="h-3 w-3" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">
                    {describe(n)}
                    {n.group_count > 1 && <span className="ml-1 font-semibold text-primary">· {n.group_count}× </span>}
                  </p>
                  {n.actor_handle && <p className="truncate text-xs text-muted-foreground">@{n.actor_handle}</p>}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {n.created_date ? formatDistanceToNowStrict(new Date(n.created_date), { addSuffix: true }) : ''}
                  </p>
                </div>
                {n.target_image && (
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-border">
                    <Image src={n.target_image} alt="" fittingType="fill" className="h-full w-full" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}