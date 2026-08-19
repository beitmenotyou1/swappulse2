import React from 'react';
import { Bell, Filter, CheckCheck, Settings } from 'lucide-react';
import HelpArticle, { HelpSection, HelpList } from '@/components/help/HelpArticle';

export default function HelpNotifications() {
  return (
    <HelpArticle title="Notifications" subtitle="All your activity in one feed" slug="notifications">
      <HelpSection icon={Bell} title="What is the Notifications page?">
        <p>The Notifications page is your unified feed of activity: likes, replies, mentions, trade matches, price alerts, follows, and more. Filter by type, mark as read, and stay on top of everything happening across your SwapPulse account.</p>
      </HelpSection>
      <HelpSection title="What you'll see">
        <HelpList>
          <li><b>Interactions:</b> Likes, reactions, replies, reposts, and quotes on your posts.</li>
          <li><b>Mentions:</b> Posts that @mention you.</li>
          <li><b>Follows:</b> New followers.</li>
          <li><b>Trade matches:</b> When a new listing matches your wishlist.</li>
          <li><b>Price alerts:</b> When a tracked card crosses your alert threshold.</li>
          <li><b>Achievements:</b> When you earn a new badge.</li>
          <li><b>System events:</b> Platform-wide announcements.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Filter} title="Filtering">
        <p>Use the filter tabs to show only the notification types you care about: All, Mentions, Trades, Alerts, or Follows. This helps you focus when your feed is busy.</p>
      </HelpSection>
      <HelpSection icon={CheckCheck} title="Marking as read">
        <p>Notifications are marked as opened when you view them or click through. The unread badge in the navigation shows your unread count.</p>
      </HelpSection>
      <HelpSection icon={Settings} title="Notification preferences">
        <p>Control what you get notified about in Settings, including push notifications, quiet hours, and per-event-type toggles. You can enable web push (no app install required) and set quiet hours to pause non-critical alerts.</p>
      </HelpSection>
    </HelpArticle>
  );
}