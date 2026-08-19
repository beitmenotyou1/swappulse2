import React from 'react';
import { Share2, Link2, Copy, Send } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpShare() {
  return (
    <HelpArticle title="Share" subtitle="Share cards, posts, and links" slug="share">
      <HelpSection icon={Share2} title="What is Share?">
        <p>The Share page lets you share SwapPulse content, cards, posts, and profile links, inside the platform and to external apps. Generate a clean link to any page and send it to friends or post it on social media.</p>
      </HelpSection>
      <HelpSection title="What you can share">
        <HelpList>
          <li><b>Cards:</b> A link to any card detail page.</li>
          <li><b>Posts:</b> A link to any post, which renders richly on Bluesky too.</li>
          <li><b>Profiles:</b> A link to any collector's profile.</li>
          <li><b>Binders & Journals:</b> Links to your showcase content.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Link2} title="Generating a share link">
        <HelpSteps>
          <li>Open the page you want to share (card, post, profile).</li>
          <li>Click the Share button or go to the Share page.</li>
          <li>Copy the link to your clipboard.</li>
          <li>Paste it anywhere: chat, social media, email.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Copy} title="External link confirmation">
        <p>When you click an external link on SwapPulse, a confirmation dialog shows you where you're going before you leave the site. This protects you from misleading links.</p>
      </HelpSection>
      <HelpSection icon={Send} title="Sharing to Bluesky">
        <p>Because SwapPulse is built on the AT Protocol, posts with attached cards render as rich link cards on Bluesky. Sharing a SwapPulse card link on Bluesky shows a preview with the card image and name.</p>
      </HelpSection>
    </HelpArticle>
  );
}