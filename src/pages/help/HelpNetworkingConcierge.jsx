import React from 'react';
import { Sparkles, Users, Handshake } from 'lucide-react';
import HelpArticle, { HelpSection, HelpList } from '@/components/help/HelpArticle';

export default function HelpNetworkingConcierge() {
  return (
    <HelpArticle title="Networking Concierge" subtitle="AI introductions to collectors" slug="networking-concierge">
      <HelpSection icon={Sparkles} title="What is the Networking Concierge?">
        <p>The Networking Concierge is an AI agent that introduces you to collectors with shared interests and complementary collections. It analyses your collection, trades, and circles to suggest people worth connecting with.</p>
      </HelpSection>
      <HelpSection title="What it can help with">
        <HelpList>
          <li><b>Match suggestions:</b> Collectors with overlapping collection focus or set goals.</li>
          <li><b>Complementary traders:</b> Collectors who have cards you want and want cards you have.</li>
          <li><b>Circle recommendations:</b> Circles you might enjoy based on your activity.</li>
          <li><b>Icebreakers:</b> Suggested conversation starters based on shared interests.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Users} title="How it works">
        <p>The concierge reads your collection, wishlist, trade history, and circle memberships, then finds collectors with complementary profiles. It's conversational, so you can ask for introductions by set, rarity, or region.</p>
      </HelpSection>
      <HelpSection icon={Handshake} title="Making connections">
        <p>Use the concierge's suggestions to follow collectors, start trade threads, or join the same circles. Building a network of trusted collectors makes trading and the hobby more enjoyable.</p>
      </HelpSection>
    </HelpArticle>
  );
}