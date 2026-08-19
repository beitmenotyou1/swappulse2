import React from 'react';
import { Sparkles, Scale, TrendingUp, AlertTriangle } from 'lucide-react';
import HelpArticle, { HelpSection, HelpList } from '@/components/help/HelpArticle';

export default function HelpTradeAssistant() {
  return (
    <HelpArticle title="Trade Assistant" subtitle="AI-powered trade suggestions" slug="trade-assistant">
      <HelpSection icon={Sparkles} title="What is the Trade Assistant?">
        <p>The Trade Assistant is an AI agent that analyses your collection and active trade listings to suggest fair trades, flag high-value opportunities, and help you negotiate. It uses live TCGDex pricing and your collection data to generate personalised, actionable suggestions.</p>
      </HelpSection>
      <HelpSection title="What it can help with">
        <HelpList>
          <li><b>Trade suggestions:</b> Cards you could offer or seek based on your collection and wishlist.</li>
          <li><b>Fairness analysis:</b> Whether a proposed trade is balanced based on market values.</li>
          <li><b>Opportunity flags:</b> High-value trade opportunities in your collection.</li>
          <li><b>Negotiation tips:</b> Suggested talking points for a trade thread.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Scale} title="How it works">
        <p>The assistant reads your collection entries, active listings, and TCGDex pricing, then asks an LLM to generate suggestions. It's conversational, so you can ask follow-up questions and refine its advice.</p>
      </HelpSection>
      <HelpSection icon={TrendingUp} title="Using the suggestions">
        <p>The assistant's output is advisory, not professional advice. Always use your own judgement for trading decisions. Use it as a second opinion and a way to spot opportunities you might have missed.</p>
      </HelpSection>
      <HelpSection icon={AlertTriangle} title="Important" variant="warning">
        <HelpList>
          <li>AI suggestions are advisory only, not financial or professional advice.</li>
          <li>Market values fluctuate, always double-check current prices before agreeing to a trade.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}