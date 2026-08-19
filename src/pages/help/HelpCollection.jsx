import React from 'react';
import { Layers, Plus, Copy, FileDown, TrendingUp } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpCollection() {
  return (
    <HelpArticle title="Collection" subtitle="Track every card you own" slug="collection">
      <HelpSection icon={Layers} title="What is the Collection page?">
        <p>Your collection is the heart of SwapPulse. Track every card you own with condition, variant, and quantity. See your total portfolio value, set completion percentages, duplicates, and export everything for insurance or backup.</p>
      </HelpSection>
      <HelpSection icon={Plus} title="Adding cards">
        <HelpSteps>
          <li>Search for a card from Explore or open any card detail page.</li>
          <li>Click Add to Collection.</li>
          <li>Choose the condition (mint, near mint, excellent, good, damaged), variant (normal, holo, reverse holo), and quantity.</li>
          <li>Save. The card appears in your collection and updates your portfolio value and set completion.</li>
        </HelpSteps>
        <p>You can also bulk import via CSV from the Bulk Import/Export panel on the Collection page.</p>
      </HelpSection>
      <HelpSection title="What you can see">
        <HelpList>
          <li><b>Portfolio value:</b> Total estimated value of your collection based on TCGDex market prices.</li>
          <li><b>Set completion:</b> Percentage complete for each set you own cards from.</li>
          <li><b>Duplicates tab:</b> Cards you own multiple copies of, flagged for potential trades.</li>
          <li><b>Analytics:</b> Breakdowns by rarity, set, condition, and value distribution.</li>
          <li><b>Collection analytics dashboard:</b> Charts showing your collection growth and value over time.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Copy} title="Managing duplicates">
        <p>The Duplicates tab shows cards you own more than one of. These are prime candidates for trading. From there you can jump straight to creating a trade listing for any duplicate.</p>
      </HelpSection>
      <HelpSection icon={FileDown} title="Exporting your collection">
        <HelpList>
          <li><b>CSV export:</b> Download your full collection as a spreadsheet for backup or import elsewhere.</li>
          <li><b>Insurance export:</b> Generate a formatted PDF with card details and values for insurance purposes.</li>
          <li><b>Bulk import:</b> Import a CSV to add many cards at once.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={TrendingUp} title="Collection value">
        <p>Portfolio value is estimated from TCGDex pricing data and updates when prices sync. It's an estimate, not a guarantee of resale value. Condition and variant affect real-world value significantly.</p>
      </HelpSection>
      <HelpSection title="Known limitations" variant="warning">
        <HelpList>
          <li>Portfolio value depends on TCGDex pricing availability, some cards may not have price data.</li>
          <li>Bulk import requires a specific CSV format, see the import panel for the template.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}