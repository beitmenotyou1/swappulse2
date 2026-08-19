import React from 'react';
import { UserPlus, Sparkles, UserCheck } from 'lucide-react';
import HelpArticle, { HelpSection, HelpList } from '@/components/help/HelpArticle';

export default function HelpWhoToFollow() {
  return (
    <HelpArticle title="Who to Follow" subtitle="Discover collectors to follow" slug="who-to-follow">
      <HelpSection icon={UserPlus} title="What is Who to Follow?">
        <p>The Who to Follow page suggests collectors you might enjoy following, based on your collection, trades, circles, and interests. It's a great way to build a relevant feed when you're new to SwapPulse.</p>
      </HelpSection>
      <HelpSection title="How recommendations work">
        <HelpList>
          <li><b>Collection overlap:</b> Collectors who own similar cards or work on the same sets.</li>
          <li><b>Trade partners:</b> Collectors you've traded with or who trade in your circles.</li>
          <li><b>Circle members:</b> Collectors in your circles you don't yet follow.</li>
          <li><b>Interest match:</b> Collectors posting about cards and topics you engage with.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Sparkles} title="Improving your suggestions">
        <p>The more you use SwapPulse, adding cards to your collection, joining circles, and interacting with posts, the better your recommendations become. If suggestions aren't relevant yet, add more cards and follow a few hashtags first.</p>
      </HelpSection>
      <HelpSection icon={UserCheck} title="Following from the page">
        <p>Follow collectors directly from the Who to Follow page with one click. The sidebar on the home feed also shows a few suggestions at a time.</p>
      </HelpSection>
    </HelpArticle>
  );
}