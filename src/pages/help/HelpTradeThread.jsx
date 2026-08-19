import React from 'react';
import { MessageSquare, Scale, Link2, Flag, Truck } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpTradeThread() {
  return (
    <HelpArticle title="Trade Threads" subtitle="Negotiate trades in private chats" slug="trade-threads">
      <HelpSection icon={MessageSquare} title="What is a trade thread?">
        <p>A trade thread is a private, end-to-end encrypted chat between two collectors negotiating a trade. You discuss the cards, agree on terms, use the fairness calculator, optionally build a multi-party trade chain, and track shipping, all in one place.</p>
      </HelpSection>
      <HelpSection title="Starting a thread">
        <HelpSteps>
          <li>Find a listing on the Trade Board or a card page that interests you.</li>
          <li>Click Start Trade. A private thread opens with the lister.</li>
          <li>Discuss what cards are on each side and any conditions.</li>
          <li>Use the fairness calculator to check the balance.</li>
          <li>When both sides agree, mark the trade as accepted and proceed to shipping.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Scale} title="Fairness calculator">
        <p>The fairness calculator compares the total market value of cards on each side and shows a balance indicator. It pulls live TCGDex prices. It's advisory, both collectors decide what's fair, but it helps avoid lopsided trades.</p>
      </HelpSection>
      <HelpSection icon={Link2} title="Trade chains">
        <p>For circular trades involving 3 to 5 collectors (A wants B's card, B wants C's, C wants A's), SwapPulse supports trade chains. Each link ships to the next, and the chain coordinator tracks the whole sequence. This unlocks trades that wouldn't work as a simple two-way swap.</p>
      </HelpSection>
      <HelpSection icon={Truck} title="Shipping">
        <p>Once accepted, update the shipping status in the thread: prepared, sent, received. Both parties can see the status. Addresses and tracking details are shared only within the private thread.</p>
      </HelpSection>
      <HelpSection icon={Flag} title="Disputes and feedback">
        <p>If something goes wrong, you can open a dispute from the trade thread. After completion, leave trading feedback to build the other collector's reputation. Honest feedback keeps the community trustworthy.</p>
      </HelpSection>
      <HelpSection title="Known limitations" variant="warning">
        <HelpList>
          <li>Trade messages are end-to-end encrypted, clearing your browser data may lose access to the thread on that device.</li>
          <li>SwapPulse does not handle escrow or payment, trades are card-for-card or card-for-cash arranged privately.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}