import React from 'react';
import { LayoutDashboard, Truck, Eye } from 'lucide-react';
import HelpArticle, { HelpSection, HelpList } from '@/components/help/HelpArticle';

export default function HelpTradeStatusBoard() {
  return (
    <HelpArticle title="Trade Status Board" subtitle="A community-wide view of active trades" slug="trade-status-board">
      <HelpSection icon={LayoutDashboard} title="What is the Trade Status Board?">
        <p>The Trade Status Board is a community-wide dashboard showing active and recent trades across SwapPulse. It gives you a live sense of what's being traded, shipping progress, and recently completed swaps, without exposing private negotiation details.</p>
      </HelpSection>
      <HelpSection title="What you can see">
        <HelpList>
          <li><b>Active trades:</b> Trades currently being negotiated or awaiting shipment.</li>
          <li><b>Shipping status:</b> Whether cards have been sent, received, or are in transit.</li>
          <li><b>Recently completed:</b> Finished trades, useful for seeing what the community is swapping.</li>
          <li><b>Trade counts:</b> Aggregate activity metrics for the community.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Truck} title="Shipping status">
        <p>Trade participants update shipping status as cards move: prepared, sent, received. The Status Board reflects these updates so the community can see trade progress at a glance. Only the two trading parties see the full private thread and addresses.</p>
      </HelpSection>
      <HelpSection icon={Eye} title="Privacy">
        <p>The Status Board shows trade summaries (cards involved, status, participants) but never private negotiation messages, addresses, or tracking numbers. Those stay in your private trade thread.</p>
      </HelpSection>
      <HelpSection title="Tips" variant="primary">
        <HelpList>
          <li>Use the Status Board to find active traders before posting your own listing.</li>
          <li>Completed trades contribute to both parties' reputation and trust scores.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}