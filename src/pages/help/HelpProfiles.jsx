import React from 'react';
import { User, Edit, Link2, BarChart3 } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpProfiles() {
  return (
    <HelpArticle title="Profiles" subtitle="Collector profiles and what's on them" slug="profiles">
      <HelpSection icon={User} title="What is a profile?">
        <p>Every collector has a profile at /profile/:did (or /u/:handle). It's your public collector identity: avatar, handle, bio, stats, binders, journals, trade history, podcasts, and activity. SwapPulse profiles work for both local members and external federated Bluesky users.</p>
      </HelpSection>
      <HelpSection title="What's on a profile">
        <HelpList>
          <li><b>Header:</b> Avatar, display name, handle, bio, and follow/message buttons.</li>
          <li><b>Stats:</b> Collection count, trades, vouches, followers, and following.</li>
          <li><b>Posts tab:</b> The collector's posts and pack openings.</li>
          <li><b>Binders tab:</b> Their public showcase binders.</li>
          <li><b>Journals tab:</b> Long-form journal entries.</li>
          <li><b>Trade history tab:</b> Completed trades and feedback.</li>
          <li><b>Collection tab:</b> Shared collection highlights (if made public).</li>
          <li><b>Podcasts tab:</b> Published podcast episodes and RSS feed link.</li>
          <li><b>Activity tab:</b> Recent community activity.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Edit} title="Editing your profile">
        <HelpSteps>
          <li>Go to your profile and click Edit Profile.</li>
          <li>Set your display name, avatar, bio, and location.</li>
          <li>Choose whether your collection stats are public.</li>
          <li>Save. Changes sync to your AT Protocol PDS.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Link2} title="Handles and domains">
        <p>Your handle is your identity (e.g. @collector.swappulse.org). You can verify a custom domain in Settings to get @yourdomain.com with an elevated trust badge. Handles are portable across AT Protocol instances.</p>
      </HelpSection>
      <HelpSection icon={BarChart3} title="External profiles">
        <p>SwapPulse can display profiles for external Bluesky users who aren't SwapPulse members. Their data is fetched from the Bluesky App View and merged with any local activity. Some tabs may be limited for external users.</p>
      </HelpSection>
    </HelpArticle>
  );
}