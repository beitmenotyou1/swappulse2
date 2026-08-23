import React from 'react';
import { Bell, ArrowLeftRight, TrendingDown, Heart, UserPlus, AtSign, Radio, Mic, Star, MessageSquare, MessageCircle, Repeat2, Quote, Globe } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import Avatar from '@/components/Avatar';
import { Image } from '@/components/ui/image';
import InteractionActions from '@/components/notifications/InteractionActions';
import FollowBackButton from '@/components/notifications/FollowBackButton';
import StarterPackRequestActions from '@/components/starterpack/StarterPackRequestActions';

const REACTION_EMOJI = {
  insane_pull: '🔥', jealous: '😏', congrats: '🎉', trade_interest: '🤝',
  gratz_set: '🏆', better_luck: '🍀', wow: '🤯',
};

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
  starter_pack: { Icon: UserPlus, tint: 'text-primary' },
};

const SYSTEM_TYPES = new Set(['price_alert']);

function actionText(n) {
  switch (n.action_type) {
    case 'trade_match': return 'listed a trade matching your wishlist';
    case 'price_alert': return `Price drop on ${n.target_label || 'a wishlist card'}`;
    case 'reaction': {
      const emoji = n.metadata?.reactionType ? REACTION_EMOJI[n.metadata.reactionType] || '' : '';
      return `reacted ${emoji ? emoji + ' ' : ''}to your ${n.target_label || 'post'}`;
    }
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
    case 'starter_pack': {
      const kind = n.metadata?.kind;
      if (kind === 'accepted') return 'accepted your starter pack request';
      if (kind === 'denied') return 'declined your starter pack request';
      return `added you to ${n.metadata?.packName || 'a starter pack'}`;
    }
    default: return 'notified you';
  }
}

export default function NotificationCard({ n, onOpen, onDismiss }) {
  const meta = ACTION_META[n.action_type] || { Icon: Bell, tint: 'text-muted-foreground' };
  const unread = !n.is_read;
  const isSystem = SYSTEM_TYPES.has(n.action_type) || (n.action_type === 'reputation' && !n.metadata?.kind);
  const isInteraction = ['like', 'repost', 'comment'].includes(n.action_type);
  const isFollow = n.action_type === 'follow';
  const isStarterPackRequest = n.action_type === 'starter_pack' && n.metadata?.kind === 'request';
  const actor = n.actor_name || 'Someone';

  return (
    <div className={unread ? 'bg-primary/5' : ''}>
      <div
        onClick={() => onOpen(n)}
        className="flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60"
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
            {!isSystem && <span className="font-bold">{actor}</span>}{' '}
            {actionText(n)}
            {n.group_count > 1 && <span className="ml-1 font-semibold text-primary">· {n.group_count}×</span>}
          </p>
          {n.action_type === 'comment' && n.metadata?.commentText && (
            <p className="mt-1 line-clamp-2 rounded-lg bg-secondary/60 px-2.5 py-1.5 text-xs italic text-muted-foreground">
              &ldquo;{n.metadata.commentText}&rdquo;
            </p>
          )}
          {n.action_type === 'quote' && n.metadata?.quoteText && (
            <p className="mt-1 line-clamp-2 rounded-lg bg-secondary/60 px-2.5 py-1.5 text-xs italic text-muted-foreground">
              &ldquo;{n.metadata.quoteText}&rdquo;
            </p>
          )}
          <div className="mt-0.5 flex items-center gap-1.5">
            {n.actor_handle && <span className="truncate text-xs text-muted-foreground">@{n.actor_handle}</span>}
            {n.metadata?.origin === 'remote' && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                <Globe className="h-2.5 w-2.5" /> Bluesky
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {n.created_date ? formatDistanceToNowStrict(new Date(n.created_date), { addSuffix: true }) : ''}
            </span>
          </div>
        </div>
        {n.target_image && (
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-border">
            <Image src={n.target_image} alt="" fittingType="fill" className="h-full w-full" />
          </div>
        )}
      </div>
      {(isInteraction || isFollow || isStarterPackRequest) && (
        <div className="px-4 pb-2" onClick={(e) => e.stopPropagation()}>
          {isInteraction && <InteractionActions n={n} onResponded={() => onDismiss(n.id)} />}
          {isFollow && <FollowBackButton n={n} onResponded={() => onDismiss(n.id)} />}
          {isStarterPackRequest && <StarterPackRequestActions n={n} onResponded={() => onDismiss(n.id)} />}
        </div>
      )}
    </div>
  );
}