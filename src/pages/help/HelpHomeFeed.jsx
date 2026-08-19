import React from 'react';
import { Home, TrendingUp, Users, Sparkles } from 'lucide-react';
import HelpArticle, { HelpSection, HelpList } from '@/components/help/HelpArticle';

export default function HelpHomeFeed() {
  return (
    <HelpArticle title="Home Feed" subtitle="Your personalised collector feed" slug="home-feed">
      <HelpSection icon={Home} title="What is the Home Feed?">
        <p>The Home Feed is your personalised stream of collector activity. It blends posts from people you follow, pack openings, trending cards, stories, live voice spaces, and community highlights into one scrollable page.</p>
      </HelpSection>
      <HelpSection title="What you'll see">
        <HelpList>
          <li><b>For You feed:</b> Posts from followed accounts, hashtag follows, and recommended content.</li>
          <li><b>Stories bar:</b> Ephemeral 24-hour stories from collectors you follow, at the top.</li>
          <li><b>Trending Cards rail:</b> The most talked-about cards right now, ranked by community activity.</li>
          <li><b>Live spaces:</b> Active voice spaces with a pulsing live ring when someone is broadcasting.</li>
          <li><b>Pack openings:</b> Fresh pull posts from the community.</li>
          <li><b>Card of the Day:</b> A featured card rotated daily.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={TrendingUp} title="Trending Cards">
        <p>The Trending Cards rail ranks cards by recent social activity: posts, discussions, and mentions. Tap any card to jump to its social detail page and see what the community is saying.</p>
      </HelpSection>
      <HelpSection icon={Users} title="Who to Follow">
        <p>The sidebar suggests collectors to follow based on your collection, trades, and interests. Follow collectors to see their posts, pack openings, and stories in your feed.</p>
      </HelpSection>
      <HelpSection icon={Sparkles} title="Making it yours">
        <p>Your feed improves as you follow more collectors, follow hashtags, and interact with posts. The more you engage, the better SwapPulse gets at surfacing content you'll enjoy.</p>
      </HelpSection>
    </HelpArticle>
  );
}