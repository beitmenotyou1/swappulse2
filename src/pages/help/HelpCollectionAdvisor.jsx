import React from 'react';
import { Sparkles, Layers, AlertTriangle } from 'lucide-react';
import HelpArticle, { HelpSection, HelpList } from '@/components/help/HelpArticle';

export default function HelpCollectionAdvisor() {
  return (
    <HelpArticle title="Collection Advisor" subtitle="AI advice on your collection" slug="collection-advisor">
      <HelpSection icon={Sparkles} title="What is the Collection Advisor?">
        <p>The Collection Advisor is an AI agent that analyses your collection to identify gaps, duplicates, and high-value trade opportunities. It helps you decide what to keep, what to trade, and what to pursue next.</p>
      </HelpSection>
      <HelpSection title="What it can help with">
        <HelpList>
          <li><b>Gap analysis:</b> Which cards you need to complete sets you're close on.</li>
          <li><b>Duplicate strategy:</b> Which duplicates are worth trading and for what.</li>
          <li><b>Value opportunities:</b> Cards in your collection that have gained value and might be worth trading.</li>
          <li><b>Collection goals:</b> Suggestions for what to focus on next based on your activity.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Layers} title="How it works">
        <p>The advisor reads your collection entries, set completion data, and TCGDex pricing, then generates tailored advice. It's conversational, so you can ask about specific sets, cards, or strategies.</p>
      </HelpSection>
      <HelpSection icon={AlertTriangle} title="Important" variant="warning">
        <HelpList>
          <li>AI advice is advisory only, not professional financial advice.</li>
          <li>Always use your own judgement when deciding what to trade or keep.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}