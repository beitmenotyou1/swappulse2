import React from 'react';
import { User, Edit, Camera, Link2, BarChart3 } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpYourProfile() {
  return (
    <HelpArticle title="Your Profile" subtitle="Set up your collector identity" slug="your-profile">
      <HelpSection icon={User} title="What is Your Profile?">
        <p>Your profile is your public collector identity on SwapPulse. Set your avatar, display name, handle, bio, and location, and choose what's visible. Your profile is the first thing other collectors see, so make it yours.</p>
      </HelpSection>
      <HelpSection icon={Edit} title="Editing your profile">
        <HelpSteps>
          <li>Go to your profile page (Profile in the navigation).</li>
          <li>Click Edit Profile.</li>
          <li>Set your display name, avatar, bio, and location.</li>
          <li>Choose whether your collection stats are public.</li>
          <li>Save. Changes sync to your AT Protocol PDS.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Camera} title="Avatar">
        <p>Upload an avatar image. It appears across the site: in posts, trade listings, spaces, and your profile header. Keep it friendly and recognisable.</p>
      </HelpSection>
      <HelpSection icon={Link2} title="Handle and domain">
        <p>Your handle is your identity (e.g. @collector.swappulse.org). You can verify a custom domain in Settings to get @yourdomain.com with an elevated trust badge. Handles are portable across AT Protocol instances, you're not locked in.</p>
      </HelpSection>
      <HelpSection icon={BarChart3} title="Profile tabs">
        <p>Your profile has tabs for Posts, Binders, Journals, Trade History, Collection (if public), Podcasts, and Activity. Each shows a different side of your collecting life. You control what's public.</p>
      </HelpSection>
      <HelpSection title="Tips" variant="primary">
        <HelpList>
          <li>A clear bio helps other collectors find you and start trades.</li>
          <li>Verify a custom domain for an elevated trust badge and a memorable handle.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}