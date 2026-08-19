import React from 'react';
import { Sparkles, MessageCircle, TrendingUp } from 'lucide-react';
import HelpArticle, { HelpSection, HelpList } from '@/components/help/HelpArticle';

export default function HelpSentimentAssistant() {
  return (
    <HelpArticle title="Sentiment Assistant" subtitle="AI for community sentiment" slug="sentiment-assistant">
      <HelpSection icon={Sparkles} title="What is the Sentiment Assistant?">
        <p>The Sentiment Assistant is a conversational AI that analyses community sentiment polls and market mood. It helps you understand how the community feels about cards, sets, and the meta, and surfaces trends across predictions and discussions.</p>
      </HelpSection>
      <HelpSection title="What it can help with">
        <HelpList>
          <li><b>Sentiment trends:</b> How community opinion on a card or set is shifting over time.</li>
          <li><b>Poll analysis:</b> Summaries of active and past prediction polls.</li>
          <li><b>Mood insights:</b> Whether the community is bullish or bearish on specific cards.</li>
          <li><b>Discussion summaries:</b> Key themes from posts and discussions about a topic.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={MessageCircle} title="How it works">
        <p>The assistant reads sentiment polls, votes, and related posts, then generates conversational insights. Ask it about a specific card, set, or topic to get a sentiment read.</p>
      </HelpSection>
      <HelpSection icon={TrendingUp} title="Using the insights">
        <p>Sentiment analysis is a tool for understanding community mood, not a prediction of future prices. Use it alongside market data and your own judgement.</p>
      </HelpSection>
    </HelpArticle>
  );
}