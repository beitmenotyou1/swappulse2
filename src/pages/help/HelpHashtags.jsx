import React from 'react';
import { Hash, Plus, Eye } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpHashtags() {
  return (
    <HelpArticle title="Hashtags" subtitle="Follow topics and discover posts" slug="hashtags">
      <HelpSection icon={Hash} title="What are hashtags?">
        <p>Hashtags let you tag posts with topics so others can discover them. Every hashtag has a page at /hashtag/:tag showing all posts using it. Follow a hashtag to see matching posts in your For You feed alongside posts from accounts you follow.</p>
      </HelpSection>
      <HelpSection title="Using hashtags">
        <HelpList>
          <li>Add up to 10 hashtags per post using the # symbol.</li>
          <li>Hashtags are canonicalised: lowercased, trimmed, and deduped for discovery.</li>
          <li>Canonical tags are stored separately from your original casing.</li>
          <li>Click any hashtag in a post to jump to its hashtag page.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Plus} title="Following a hashtag">
        <HelpSteps>
          <li>Open any hashtag page (e.g. /hashtag/charizard).</li>
          <li>Click Follow.</li>
          <li>Posts using that hashtag now appear in your For You feed.</li>
          <li>Unfollow anytime from the same page or your settings.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Eye} title="Hashtag pages">
        <p>Each hashtag page shows a chronological feed of posts using that tag, merged from local SwapPulse posts and federated Bluesky posts. It's a topic-focused way to discover collectors who share your interests.</p>
      </HelpSection>
      <HelpSection title="Tips" variant="primary">
        <HelpList>
          <li>Use specific hashtags (e.g. #shinycharizard) to reach the right audience.</li>
          <li>Following a few key hashtags is a great way to build a relevant feed before you follow many accounts.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}