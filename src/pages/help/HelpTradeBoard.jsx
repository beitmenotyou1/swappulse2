import React from 'react';
import { ArrowLeftRight, Plus, MessageSquare, Scale } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpTradeBoard() {
  return (
    <HelpArticle title="Trade Board" subtitle="List cards and negotiate trades" slug="trade-board">
      <HelpSection icon={ArrowLeftRight} title="What is the Trade Board?">
        <p>The Trade Board is the open marketplace where collectors list cards they have and cards they want. Browse listings, filter by set or rarity, and open a trade thread with anyone whose listing interests you. Every trade is backed by fairness scoring and reputation.</p>
      </HelpSection>
      <HelpSection icon={Plus} title="Creating a trade listing">
        <HelpSteps>
          <li>Go to the Trade Board and click New Listing.</li>
          <li>Select the card you have from your collection or by search.</li>
          <li>Describe what you want in return (a specific card, or a general want like "any Charizard").</li>
          <li>Optionally scope the listing to one of your circles.</li>
          <li>Publish. Your listing appears on the board and on the relevant card pages.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection title="Browsing and filtering">
        <HelpList>
          <li><b>By card:</b> Filter to listings offering or seeking a specific card.</li>
          <li><b>By circle:</b> Show only listings from collectors in your circles.</li>
          <li><b>By set:</b> Narrow to a specific expansion.</li>
          <li><b>By status:</b> Active listings only, or include pending trades.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={MessageSquare} title="Starting a trade">
        <p>When you find a listing you're interested in, click Start Trade to open a private trade thread with the lister. You'll negotiate the details there, see the next article on Trade Threads.</p>
      </HelpSection>
      <HelpSection icon={Scale} title="Fairness scoring">
        <p>Each trade thread includes a fairness calculator that compares the market values of the cards on both sides. It's a guide, not a rule, but it helps both collectors agree on a balanced swap.</p>
      </HelpSection>
      <HelpSection title="Known limitations" variant="warning">
        <HelpList>
          <li>Listings expire after 90 days by default. Renew if still active.</li>
          <li>Circle-scoped listings are only visible to members of that circle.</li>
          <li>SwapPulse facilitates the connection, it does not handle shipping or escrow.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}