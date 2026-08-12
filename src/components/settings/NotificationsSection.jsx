import React from 'react';
import { Bell, Moon } from 'lucide-react';
import SettingRow from '@/components/settings/SettingRow';

const CHANNELS = [
  { key: 'push', label: 'Push notifications' },
  { key: 'in-app', label: 'In-app toasts' },
  { key: 'email_digest', label: 'Email digest' },
];

const EVENTS = [
  { key: 'trade_match', label: 'Trade matches', desc: 'Someone lists a card on your wishlist' },
  { key: 'trade_listing', label: 'New trade listings', desc: 'New trades in your circles' },
  { key: 'price_alert', label: 'Price alerts', desc: 'Wishlist cards hitting your max price' },
  { key: 'mention', label: 'Mentions', desc: 'When someone mentions you' },
  { key: 'reaction', label: 'Reactions', desc: 'Reactions on your posts' },
  { key: 'comment_reply', label: 'Comment replies', desc: 'Replies to your comments' },
  { key: 'voice_live', label: 'Friends go live', desc: 'Live stream announcements' },
  { key: 'podcast', label: 'New podcasts', desc: 'New podcast episodes' },
  { key: 'vouch_received', label: 'Vouches', desc: 'When someone vouches for you' },
  { key: 'meetup_announcement', label: 'Meetups', desc: 'Local meetup announcements' },
  { key: 'challenge_update', label: 'Challenges', desc: 'Challenge milestones' },
  { key: 'weekly_digest', label: 'Weekly digest', desc: 'Portfolio summary every week' },
];

export default function NotificationsSection({ settings, update }) {
  const n = settings.notifications || {};
  const channels = n.channels || [];
  const events = n.eventTypes || {};
  const quiet = n.quietHours || { start: '22:00', end: '08:00' };

  const toggleChannel = (k) => update({ notifications: { channels: channels.includes(k) ? channels.filter((c) => c !== k) : [...channels, k] } });
  const toggleEvent = (k) => update({ notifications: { eventTypes: { ...events, [k]: !events[k] } } });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="flex items-center gap-2 text-sm font-bold"><Bell className="h-4 w-4 text-primary" /> Channels</p>
        {CHANNELS.map((c) => (
          <SettingRow key={c.key} label={c.label} checked={channels.includes(c.key)} onChange={() => toggleChannel(c.key)} />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="flex items-center gap-2 text-sm font-bold"><Moon className="h-4 w-4 text-primary" /> Quiet hours</p>
        <p className="text-xs text-muted-foreground">No non-critical notifications during this window.</p>
        <div className="mt-2 flex items-center gap-3">
          <input type="time" value={quiet.start || '22:00'} onChange={(e) => update({ notifications: { quietHours: { ...quiet, start: e.target.value } } })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <span className="text-muted-foreground">to</span>
          <input type="time" value={quiet.end || '08:00'} onChange={(e) => update({ notifications: { quietHours: { ...quiet, end: e.target.value } } })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-sm font-bold">Event triggers</p>
        {EVENTS.map((e) => (
          <SettingRow key={e.key} label={e.label} checked={!!events[e.key]} onChange={() => toggleEvent(e.key)} />
        ))}
      </div>
    </div>
  );
}