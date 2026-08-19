import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2, RefreshCw } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { resolveNotificationRoute } from '@/lib/notificationRoutes';
import PageHeader from '@/components/PageHeader';
import AchievementNotificationCard from '@/components/notifications/AchievementNotificationCard';
import NotificationFilterTabs from '@/components/notifications/NotificationFilterTabs';
import NotificationGroup from '@/components/notifications/NotificationGroup';
import NotificationCard from '@/components/notifications/NotificationCard';
import GuideFooterLink from '@/components/help/GuideFooterLink';

const isAchievement = (n) => n.action_type === 'reputation' && n.metadata?.kind;

function groupByDate(items) {
  const today = [];
  const earlier = [];
  const now = new Date();
  for (const n of items) {
    const d = new Date(n.created_date);
    if (d.toDateString() === now.toDateString()) today.push(n);
    else earlier.push(n);
  }
  return { today, earlier };
}

const EMPTY_MSG = {
  all: 'No notifications yet',
  unread: 'No unread notifications',
  mentions: 'No mentions',
  follows: 'No new follows',
};

export default function Notifications() {
  const navigate = useNavigate();
  const { items, loading, unreadCount, refresh, markRead, markAllRead } = useNotifications();
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const counts = useMemo(() => ({
    all: items.length,
    unread: items.filter((n) => !n.is_read).length,
    mentions: items.filter((n) => n.action_type === 'mention').length,
    follows: items.filter((n) => n.action_type === 'follow').length,
  }), [items]);

  const visible = useMemo(() => {
    switch (filter) {
      case 'unread': return items.filter((n) => !n.is_read);
      case 'mentions': return items.filter((n) => n.action_type === 'mention');
      case 'follows': return items.filter((n) => n.action_type === 'follow');
      default: return items;
    }
  }, [items, filter]);

  const { today, earlier } = useMemo(() => groupByDate(visible), [visible]);

  const open = async (n) => {
    if (isAchievement(n)) return;
    if (!n.is_read) await markRead(n.id);
    const route = resolveNotificationRoute(n);
    if (route && route !== '/notifications') navigate(route);
  };

  const dismiss = async (id) => { await markRead(id); };

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  };

  const renderCard = (n) => {
    if (isAchievement(n)) {
      return (
        <div key={n.id} className={!n.is_read ? 'bg-primary/5' : ''}>
          <AchievementNotificationCard n={n} onDismiss={dismiss} />
        </div>
      );
    }
    return <NotificationCard key={n.id} n={n} onOpen={open} onDismiss={dismiss} />;
  };

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Trade matches, price drops and activity from across SwapPulse">
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center rounded-full border border-border bg-card p-2 hover:bg-secondary disabled:opacity-50"
            aria-label="Refresh notifications"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary"
            >
              <CheckCheck className="h-4 w-4" /> Mark all read
            </button>
          )}
        </div>
      </PageHeader>

      <NotificationFilterTabs active={filter} onChange={setFilter} counts={counts} />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Bell className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold">{EMPTY_MSG[filter] || 'No notifications yet'}</p>
          <p className="text-xs text-muted-foreground">Trade matches and price alerts will show up here.</p>
        </div>
      ) : (
        <div>
          <NotificationGroup title="Today">{today.map(renderCard)}</NotificationGroup>
          <NotificationGroup title="Earlier">{earlier.map(renderCard)}</NotificationGroup>
        </div>
      )}
      <GuideFooterLink slug="notifications" />
    </div>
  );
}