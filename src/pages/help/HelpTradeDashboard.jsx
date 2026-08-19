import React from 'react';
import { LayoutDashboard, ListChecks, History, Truck } from 'lucide-react';
import HelpArticle, { HelpSection, HelpList } from '@/components/help/HelpArticle';

export default function HelpTradeDashboard() {
  return (
    <HelpArticle title="Trade Dashboard" subtitle="Manage all your trades in one place" slug="trade-dashboard">
      <HelpSection icon={LayoutDashboard} title="What is the Trade Dashboard?">
        <p>The Trade Dashboard is your personal command centre for trading. See every trade you're involved in, active and historical, track shipping status, manage listings, and review your trade stats, all from one screen.</p>
      </HelpSection>
      <HelpSection icon={ListChecks} title="Active trades">
        <p>The active trades panel shows every trade thread you're currently part of, with its current status: negotiating, accepted, shipping, or awaiting feedback. Jump straight into any thread to continue the conversation.</p>
      </HelpSection>
      <HelpSection icon={Truck} title="Shipping tracking">
        <p>For accepted trades, the dashboard shows shipping status at a glance: which trades are prepared, in transit, or received. Update your own shipping status from here or from within the trade thread.</p>
      </HelpSection>
      <HelpSection icon={History} title="Trade history">
        <p>Your completed trades are listed with final outcomes and feedback. Use this to review past swaps, see which collectors you've traded with, and track your trading activity over time.</p>
      </HelpSection>
      <HelpSection title="What you can manage">
        <HelpList>
          <li><b>Your listings:</b> Edit, renew, or cancel your active trade listings.</li>
          <li><b>Active trades:</b> Open, update, or dispute any ongoing trade thread.</li>
          <li><b>Feedback:</b> Leave feedback for completed trades and view feedback received.</li>
          <li><b>Stats:</b> Total trades, completion rate, and reputation summary.</li>
        </HelpList>
      </HelpSection>
      <HelpSection title="Tips" variant="primary">
        <HelpList>
          <li>Leave feedback promptly after receiving cards, it helps the other collector's reputation and yours.</li>
          <li>Update shipping status as soon as you send or receive so your partner stays informed.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}