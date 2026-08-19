import React from 'react';
import { BookOpen, PenLine, Image, Tag, ThumbsUp } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpJournals() {
  return (
    <HelpArticle title="Journals" subtitle="Long-form collector writing" slug="journals">
      <HelpSection icon={BookOpen} title="What are Journals?">
        <p>Journals are long-form articles written by collectors, up to 50,000 characters of markdown. They're more than a post: cover images, embedded cards, frozen collection stat snapshots, tags, and full visibility controls. Each journal is mirrored to your AT Protocol PDS and also published as a site.standard.document for interoperable long-form discovery.</p>
      </HelpSection>
      <HelpSection title="What you can include">
        <HelpList>
          <li><b>Title and subtitle:</b> Up to 200 and 300 characters.</li>
          <li><b>Body:</b> Markdown-formatted content up to 50,000 characters.</li>
          <li><b>Cover image:</b> A banner image for the journal.</li>
          <li><b>Embedded cards:</b> Up to 20 card references rendered inline.</li>
          <li><b>Stat snapshot:</b> Frozen collection stats at publication time (value, completion, total cards, rarest card).</li>
          <li><b>Tags:</b> Up to 10 tags for discovery.</li>
          <li><b>Visibility:</b> Public, followers, or private.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={PenLine} title="Writing a journal">
        <HelpSteps>
          <li>Go to your profile's Journals tab and click New Journal.</li>
          <li>Write your title, subtitle, and body in the markdown editor.</li>
          <li>Add a cover image and embed cards if you like.</li>
          <li>Set visibility and tags.</li>
          <li>Publish. Your journal gets its own page at /journal/:journalId.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Image} title="Embedded cards">
        <p>Reference up to 20 cards in your journal. They render inline with images and link to the card pages. Great for set reviews, pull stories, or collection milestones.</p>
      </HelpSection>
      <HelpSection icon={Tag} title="Tags and discovery">
        <p>Tags help readers find your journal. Published journals also get a site.standard.document record, so they're discoverable across the ATmosphere and can be recommended and subscribed to independently of your social profile.</p>
      </HelpSection>
      <HelpSection icon={ThumbsUp} title="Recommendations and subscriptions">
        <p>Readers can recommend your journal (a site.standard.graph.recommend) and subscribe to your writing (site.standard.graph.subscription) separately from following your social profile. This lets collectors follow your long-form output without following your everyday posts.</p>
      </HelpSection>
    </HelpArticle>
  );
}