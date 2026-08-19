import React from 'react';
import { Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';
import HelpArticle, { HelpSection, HelpList } from '@/components/help/HelpArticle';

export default function HelpMarketWatchAssistant() {
  return (
    <HelpArticle title="Market Watch Assistant" subtitle="AI analysis of price trends" slug="market-watch-assistant">
      <HelpSection icon={Sparkles} title="What is the Market Watch Assistant?">
        <p>The Market Watch Assistant is an AI agent that analyses price trends and market opportunities for your tracked cards and collection. It helps you spot rising cards, potential buys, and cards that might be overvalued.</p>
      </HelpSection>
      <HelpSection title="What it can help with">
        <HelpList>
          <li><b>Trend analysis:</b> Which tracked cards are trending up or down.</li>
          <li><b>Opportunity spotting:</b> Cards that may be undervalued or heating up.</li>
          <li><b>Alert suggestions:</b> Where to set price alerts based on recent movement.</li>
          <li><b>Portfolio insights:</b> Which parts of your collection are gaining or losing value.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={TrendingUp} title="How it works">
        <p>The assistant reads your tracked cards, collection value, and TCGDex pricing history, then generates insights. It's conversational, so you can ask about specific cards or market segments.</p>
      </HelpSection>
      <HelpSection icon={AlertTriangle} title="Important" variant="warning">
        <HelpList>
          <li>AI market analysis is advisory only, not financial advice.</li>
          <li>Card prices are volatile and depend on many factors beyond historical data.</li>
          <li>Never make financial decisions based solely on AI suggestions.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}