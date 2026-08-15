import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Bell, TrendingUp, Repeat2, Mic, MessageCircle, Heart, Trophy, Gift, Star } from 'lucide-react';
import { parseDeepLink, navigateFromDeepLink } from '@/lib/deepLinks';
import { base44 } from '@/api/base44Client';

const AUTO_DISMISS_MS = 30000;

const TYPE_ICONS = {
  trade_match: Repeat2,
  trade_listing: Repeat2,
  price_alert: TrendingUp,
  pack_opening: Gift,
  pack_pull: Gift,
  voice_live: Mic,
  voice_space: Mic,
  podcast: Mic,
  podcast_episode: Mic,
  comment_reply: MessageCircle,
  comment_reaction: MessageCircle,
  reaction: Heart,
  like: Heart,
  mention: MessageCircle,
  vouch_received: Star,
  challenge_update: Trophy,
  goes_live: Mic,
};

const TYPE_COLORS = {
  trade_match: 'text-warning bg-warning/10',
  trade_listing: 'text-warning bg-warning/10',
  price_alert: 'text-success bg-success/10',
  pack_opening: 'text-primary bg-primary/10',
  pack_pull: 'text-primary bg-primary/10',
  voice_live: 'text-destructive bg-destructive/10',
  voice_space: 'text-destructive bg-destructive/10',
  podcast: 'text-primary bg-primary/10',
  podcast_episode: 'text-primary bg-primary/10',
  comment_reply: 'text-primary bg-primary/10',
  comment_reaction: 'text-primary bg-primary/10',
  reaction: 'text-primary bg-primary/10',
  like: 'text-primary bg-primary/10',
  mention: 'text-primary bg-primary/10',
  vouch_received: 'text-warning bg-warning/10',
  challenge_update: 'text-warning bg-warning/10',
  goes_live: 'text-destructive bg-destructive/10',
};

export default function InAppBanner({ notification, onDismiss }) {
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const dismissed = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    onDismiss(notification.id);
  }, [notification.id, onDismiss]);

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [dismiss]);

  const handleTap = () => {
    const route = notification.data?.route;
    if (route) {
      navigateFromDeepLink(navigate, route);
      // Mark as opened
      if (notification.data?.notificationId) {
        base44.functions.invoke('mark-notification-opened', {
          notificationId: notification.data.notificationId,
        }).catch(() => {});
      }
    }
    dismiss();
  };

  const Icon = TYPE_ICONS[notification.data?.notificationType] || Bell;
  const colorClass = TYPE_COLORS[notification.data?.notificationType] || 'text-primary bg-primary/10';

  return (
    <div
      role="alert"
      className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-elevated animate-slide-up cursor-pointer"
      onClick={handleTap}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{notification.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{notification.body}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-secondary"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}