import React from 'react';
import { Package, Camera, Sparkles, Users } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpPackOpenings() {
  return (
    <HelpArticle title="Pack Openings" subtitle="Share your pulls and see others'" slug="pack-openings">
      <HelpSection icon={Package} title="What are Pack Openings?">
        <p>Pack Openings is a feed of pull posts from the community. When you open a pack and get a great card, share it as a pack-opening post with the card attached. Follow collectors to see their fresh pulls in your feed, and discover trending pulls from across SwapPulse.</p>
      </HelpSection>
      <HelpSection title="Sharing a pull">
        <HelpSteps>
          <li>Open Compose and set the post type to Pack Opening.</li>
          <li>Attach the card you pulled.</li>
          <li>Write about the pull, the set, how it felt.</li>
          <li>Post. It appears in the Pack Openings feed and on the card's page.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Camera} title="What makes a good pull post">
        <HelpList>
          <li>Attach the actual card so it renders richly and links to the card page.</li>
          <li>Mention the set and whether it was a pack, tin, or ETB.</li>
          <li>Add hashtags like #pull or the set name for discovery.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Sparkles} title="Discovering pulls">
        <p>The Pack Openings page shows the latest pull posts from the community. Filter by set or rarity to find specific pulls. Each pull links to the card's social page where you can see more posts and trades for that card.</p>
      </HelpSection>
      <HelpSection icon={Users} title="Following collectors">
        <p>Follow collectors whose pulls you enjoy. Their pack-opening posts appear in your home feed so you never miss a great pull.</p>
      </HelpSection>
    </HelpArticle>
  );
}