import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { Bell, ArrowLeftRight, TrendingDown, Heart, UserPlus, AtSign, Radio, Mic, Star, MessageSquare, MessageCircle, Repeat2, Quote, Globe } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { base44 } from '@/api/base44Client';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/lib/AuthContext';

const ACTION_META = {
  trade_match: { Icon: ArrowLeftRight, tint: 'text-primary' },
  price_alert: { Icon: TrendingDown, tint: 'text-success' },
  reaction: { Icon: Heart, tint: 'text-destructive' },
  like: { Icon: Heart, tint: 'text-destructive' },
  repost: { Icon: Repeat2, tint: 'text-emerald-500' },
  quote: { Icon: Quote, tint: 'text-primary' },
  comment: { Icon: MessageCircle, tint: 'text-primary' },
  follow: { Icon: UserPlus, tint: 'text-primary' },
  mention: { Icon: AtSign, tint: 'text-primary' },
  voice_live: { Icon: Radio, tint: 'text-destructive' },
  podcast: { Icon: Mic, tint: 'text-primary' },
  reputation: { Icon: Star, tint: 'text-accent' },
  message: { Icon: MessageSquare, tint: 'text-primary' },
  pack_pull: { Icon: Star, tint: 'text-accent' },
};

function actionText(n) {
  switch (n.action_type) {
    case 'trade_match': return 'listed a trade matching your wishlist';
    case 'price_alert': return `Price drop on ${n.target_label || 'a wishlist card'}`;
    case 'reaction': return 'reacted to your post';
    case 'like': return `liked your ${n.target_label || 'post'}`;
    case 'quote': return 'quoted your post';
    case 'comment': return `commented on your ${n.target_label || 'post'}`;
    case 'follow': return 'followed you';
    case 'mention': return 'mentioned you';
    case 'voice_live': return 'went live';
    case 'podcast': return 'published a new podcast';
    case 'reputation': return n.target_label || 'Your reputation was updated';
    case 'message': return 'sent you a message';
    case 'pack_pull': return 'pulled a card on your wishlist';
    default: return 'notified you';
  }
}

// Bell-icon preview popover. The parent supplies the trigger (a
// <PopoverTrigger asChild>…</PopoverTrigger>) so desktop and mobile can style
// the bell button differently. `onNavigate` closes any parent sheet when the
// user navigates away from the popover.
export default function NotificationPopover({ trigger, onNavigate, side = 'right', align = 'start' }) {
  const { user } = useAuth();
  const did = user?.did;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!did) return;
    setLoading(true);
    try {
      const list = await base44.entities.Notification.filter({ did }, '-created_date', 8);
      setItems(list || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [did]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleOpen = async (n) => {
    setOpen(false);
    if (!n.is_read) {
      try {
        await base44.entities.Notification.update(n.id, { is_read: true, read_at: new Date().toISOString() });
      } catch {}
    }
    const route = n.target_path || '/notifications';
    navigate(route.startsWith('/') ? route : `/${route}`);
    onNavigate?.();
  };

  const viewAll = () => {
    setOpen(false);
    navigate('/notifications');
    onNavigate?.();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {trigger}
      <PopoverContent
        side={side}
        align={align}
        sideOffset={8}
        className="w-[340px] max-w-[calc(100vw-2rem)] p-0 md:w-[360px]"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-bold">Notifications</p>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close notifications"
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-7 w-7 opacity-40" />
              No notifications yet
            </div>
          ) : (
            items.map((n) => {
              const meta = ACTION_META[n.action_type] || { Icon: Bell, tint: 'text-muted-foreground' };
              const unread = !n.is_read;
              const actor = n.actor_name || 'Someone';
              const isSystem = n.action_type === 'price_alert' || (n.action_type === 'reputation' && !n.metadata?.kind);
              return (
                <button
                  key={n.id}
                  onClick={() => handleOpen(n)}
                  className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60 ${unread ? 'bg-primary/5' : ''}`}
                >
                  <div className="relative shrink-0">
                    <Avatar name={n.actor_name} src={n.actor_avatar} size={32} />
                    <span className={`absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-background ring-1 ring-border ${meta.tint}`}>
                      <meta.Icon className="h-2.5 w-2.5" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-snug">
                      {!isSystem && <span className="font-bold">{actor}</span>}{' '}
                      {actionText(n)}
                      {n.group_count > 1 && <span className="ml-1 font-semibold text-primary">· {n.group_count}×</span>}
                    </p>
                    {(n.action_type === 'comment' || n.action_type === 'quote') && n.metadata?.[n.action_type === 'comment' ? 'commentText' : 'quoteText'] && (
                      <p className="mt-0.5 line-clamp-1 text-[11px] italic text-muted-foreground">
                        &ldquo;{n.metadata[n.action_type === 'comment' ? 'commentText' : 'quoteText']}&rdquo;
                      </p>
                    )}
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {n.actor_handle && <span className="truncate text-[10px] text-muted-foreground">@{n.actor_handle}</span>}
                      {n.metadata?.origin === 'remote' && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 px-1 py-0.5 text-[9px] font-semibold text-primary">
                          <Globe className="h-2 w-2" /> Bluesky
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {n.created_date ? formatDistanceToNowStrict(new Date(n.created_date), { addSuffix: true }) : ''}
                      </span>
                    </div>
                  </div>
                  {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </button>
              );
            })
          )}
        </div>
        <button
          onClick={viewAll}
          className="w-full border-t border-border px-4 py-3 text-center text-sm font-semibold text-primary transition-colors hover:bg-secondary"
        >
          View all notifications
        </button>
      </PopoverContent>
    </Popover>
  );
}