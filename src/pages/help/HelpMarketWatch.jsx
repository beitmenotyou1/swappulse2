import React from 'react';
import { BarChart3, Bell, TrendingUp, Wallet } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpMarketWatch() {
  return (
    <HelpArticle title="Market Watch" subtitle="Track card prices and set alerts" slug="market-watch">
      <HelpSection icon={BarChart3} title="What is Market Watch?">
        <p>Market Watch is your Pokémon TCG price dashboard. Track cards you're interested in, watch price trends over time, set alerts for price drops or spikes, and see your portfolio's total value at a glance. Prices are sourced from the TCGDex open catalogue.</p>
      </HelpSection>
      <HelpSection title="What you can do">
        <HelpList>
          <li><b>Track cards:</b> Add any card to your watchlist to follow its price.</li>
          <li><b>Price charts:</b> View price history charts for normal, holo, and reverse holo variants.</li>
          <li><b>Set alerts:</b> Get notified when a card's price crosses your target threshold.</li>
          <li><b>Market movers:</b> See the biggest gainers and losers across the community.</li>
          <li><b>Portfolio value:</b> Your collection's total estimated market value, updated with prices.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Bell} title="Setting a price alert">
        <HelpSteps>
          <li>Open Market Watch and find a tracked card, or add a new one.</li>
          <li>Click Set Alert.</li>
          <li>Choose whether you want to be notified when the price rises above or falls below a threshold.</li>
          <li>Enter your target price.</li>
          <li>Save. You'll get a notification when the condition is met.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={TrendingUp} title="Market movers">
        <p>The movers section shows cards with the biggest price changes over the selected period. Use it to spot trends, find buying opportunities, or identify cards that are heating up in the community.</p>
      </HelpSection>
      <HelpSection icon={Wallet} title="Portfolio value">
        <p>Your portfolio value is the sum of your collection's current market prices. It updates when pricing data syncs. Remember, this is an estimate based on TCGDex data, actual resale value depends on condition, variant, and market demand.</p>
      </HelpSection>
      <HelpSection title="Known limitations" variant="warning">
        <HelpList>
          <li>Price data depends on TCGDex availability, some older or obscure cards may lack pricing.</li>
          <li>Alerts check on a sync cycle, not in real time, so there may be a short delay.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}