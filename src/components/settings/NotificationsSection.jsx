import React, { useState } from 'react';
import { Bell, Send, Loader2, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import SettingRow from '@/components/settings/SettingRow';
import WhoCanReachYouCard from '@/components/settings/WhoCanReachYouCard';
import StarterPackAutoAcceptCard from '@/components/settings/StarterPackAutoAcceptCard';
import QuietHoursBuilder from '@/components/settings/QuietHoursBuilder';
import NotificationToggle from '@/components/pwa/NotificationToggle';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const CHANNELS = [
  { key: 'push', label: 'Push notifications' },
  { key: 'in-app', label: 'In-app toasts' },
  { key: 'email_digest', label: 'Email digest' },
];

const EVENTS = [
  { key: 'followed_post', label: 'Followed posts', desc: 'New posts from collectors you follow' },
  { key: 'trade_match', label: 'Trade matches', desc: 'Someone lists a card on your wishlist' },
  { key: 'trade_update', label: 'Trade updates', desc: 'Status changes and messages on your trades' },
  { key: 'direct_message', label: 'Direct messages', desc: 'New DMs in your conversations' },
  { key: 'price_alert', label: 'Price alerts', desc: 'Wishlist cards hitting your max price' },
  { key: 'mention', label: 'Mentions & replies', desc: 'When someone mentions or replies to you' },
  { key: 'reaction', label: 'Reactions', desc: 'Reactions on your posts' },
  { key: 'community_label', label: 'Community labels', desc: 'Labels applied to your content' },
  { key: 'achievement', label: 'Achievements', desc: 'Badges and milestones unlocked' },
  { key: 'voice_live', label: 'Friends go live', desc: 'Live stream announcements' },
  { key: 'podcast', label: 'New podcasts', desc: 'New podcast episodes' },
  { key: 'vouch_received', label: 'Vouches', desc: 'When someone vouches for you' },
  { key: 'meetup_announcement', label: 'Meetups', desc: 'Local meetup announcements' },
  { key: 'challenge_update', label: 'Challenges', desc: 'Challenge milestones' },
  { key: 'weekly_digest', label: 'Weekly digest', desc: 'Portfolio summary every week' },
];

export default function NotificationsSection({ settings, update }) {
  const { toast } = useToast();
  const [sendingTest, setSendingTest] = useState(false);
  const n = settings.notifications || {};
  const channels = n.channels || [];
  const events = n.eventTypes || {};

  const toggleChannel = (k) =>
    update({ notifications: { channels: channels.includes(k) ? channels.filter((c) => c !== k) : [...channels, k] } });
  const toggleEvent = (k) =>
    update({ notifications: { eventTypes: { ...events, [k]: events[k] === false ? true : false } } });

  const sendTestPush = async () => {
    setSendingTest(true);
    try {
      const res = await base44.functions.invoke('send-test-push', {});
      if (res.data?.delivered) {
        toast({ title: 'Test notification sent', description: 'Check your device for a push notification.' });
      } else {
        toast({
          title: 'Could not send test push',
          description: res.data?.reason || 'Make sure push is enabled and your browser allows notifications.',
          variant: 'destructive',
        });
      }
    } catch (e) {
      toast({ title: 'Could not send test push', description: e.message, variant: 'destructive' });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-4">
      <NotificationToggle />

      <div className="rounded-xl border border-border bg-card p-3">
        <button
          onClick={sendTestPush}
          disabled={sendingTest}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-60"
        >
          {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send test push notification
        </button>
      </div>

      <WhoCanReachYouCard />

      <StarterPackAutoAcceptCard />

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Bell className="h-4 w-4 text-primary" /> Channels
        </p>
        {CHANNELS.map((c) => (
          <SettingRow key={c.key} label={c.label} checked={channels.includes(c.key)} onChange={() => toggleChannel(c.key)} />
        ))}
      </div>

      <QuietHoursBuilder quietHours={n.quietHours || {}} update={update} />

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-sm font-bold">Event triggers</p>
        <p className="text-xs text-muted-foreground">Choose which events send you notifications — all, a selected few, or none.</p>
        {EVENTS.map((e) => (
          <SettingRow
            key={e.key}
            label={e.label}
            description={e.desc}
            checked={events[e.key] !== false}
            onChange={() => toggleEvent(e.key)}
          />
        ))}
      </div>

      <Link
        to="/download"
        className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition hover:border-primary"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold">Get the mobile app</p>
            <p className="text-xs text-muted-foreground">Android (Play Store, F-Droid, APK) & iOS PWA</p>
          </div>
        </div>
        <Smartphone className="h-5 w-5 text-muted-foreground" />
      </Link>
    </div>
  );
}