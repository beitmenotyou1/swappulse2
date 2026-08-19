import React from 'react';
import { Mic, Scissors, Rss, Edit3 } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpPodcasts() {
  return (
    <HelpArticle title="Podcasts" subtitle="Publish recorded spaces as episodes" slug="podcasts">
      <HelpSection icon={Mic} title="What are Podcasts?">
        <p>When you record an in-platform voice space, you can save it as a podcast episode with a title, description, chapters, and show notes. Each host gets a public RSS feed URL that can be submitted to Apple Podcasts, Spotify, or any podcast app. Find your feed link on your profile's Podcasts tab.</p>
      </HelpSection>
      <HelpSection title="From recording to episode">
        <HelpSteps>
          <li>Host an in-platform voice space and enable recording.</li>
          <li>When the space ends, open Save as Podcast.</li>
          <li>Edit the title, description, cover image, and show notes.</li>
          <li>Add chapter marks to jump to key moments.</li>
          <li>Optionally trim the start and end of the recording.</li>
          <li>Publish. The episode appears on your profile and in your RSS feed.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Scissors} title="Trimming">
        <p>Set start and end trim points to cut dead air or off-topic intro/outro. The trimmed audio re-encodes and replaces the published audio. The original is retained so you can re-trim or restore later.</p>
      </HelpSection>
      <HelpSection icon={Rss} title="Your RSS feed">
        <p>Your podcast RSS feed is at /api/functions/podcast-rss-feed?did=&lt;yourDID&gt;. Copy it from your profile's Podcasts tab. Submit it to Apple Podcasts, Spotify, or any podcast app. The feed returns 404 until you have at least one published episode. Podcast apps may take a few hours to index a newly submitted feed.</p>
      </HelpSection>
      <HelpSection icon={Edit3} title="Editing episodes">
        <p>Edit an episode's metadata (title, description, cover, tags, chapters, show notes) anytime. Play count tracks listens on SwapPulse. Episodes are mirrored to your AT Protocol PDS as portable records.</p>
      </HelpSection>
      <HelpSection title="Tips" variant="primary">
        <HelpList>
          <li>Add chapter marks for cards discussed so listeners can jump to specific topics.</li>
          <li>Use show notes to link to cards, profiles, and resources mentioned in the episode.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}