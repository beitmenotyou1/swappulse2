import React from 'react';
import { ShieldAlert, Flag, Bot, Gavel } from 'lucide-react';
import HelpArticle, { HelpSection, HelpList } from '@/components/help/HelpArticle';

export default function HelpModeration() {
  return (
    <HelpArticle title="Moderation" subtitle="Keeping the community safe" slug="moderation">
      <HelpSection icon={ShieldAlert} title="What is Moderation?">
        <p>The Moderation page is the toolkit for SwapPulse moderators. It surfaces flagged posts, bot protection logs, trade disputes, and enforcement actions. Moderators review reports, apply labels, and take action to keep the community safe and welcoming.</p>
      </HelpSection>
      <HelpSection title="What moderators handle">
        <HelpList>
          <li><b>Flagged posts:</b> Posts reported by users or flagged by AI moderation, queued for review.</li>
          <li><b>Bot protection:</b> Logs of bot detection attempts and risk states.</li>
          <li><b>Trade disputes:</b> Disputes opened by trade participants that need mediation.</li>
          <li><b>Enforcement:</b> Suspensions, shadow bans, and forced deletions for rule breakers.</li>
          <li><b>Bulk actions:</b> Tools to handle multiple items efficiently.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Flag} title="How reporting works">
        <p>When a user reports a post, it enters the moderation queue with the reporter's reason. AI moderation also scans posts automatically and applies labels (inform, warn, escalate) based on content. Moderators review and decide: dismiss, warn, hide, or escalate.</p>
      </HelpSection>
      <HelpSection icon={Bot} title="AI moderation">
        <p>SwapPulse uses an AI moderation agent that scans posts and trade listings for harmful content. It applies labels with confidence scores and recommended actions. Moderators review AI-flagged content and confirm or override the AI's decision, and their feedback trains the model.</p>
      </HelpSection>
      <HelpSection icon={Gavel} title="Enforcement">
        <p>Moderators can suspend accounts, shadow-ban repeat offenders, or force-delete content. Enforcement actions are logged for accountability. Severe cases may involve account deletion.</p>
      </HelpSection>
      <HelpSection title="Tips" variant="primary">
        <HelpList>
          <li>Report harmful content rather than engaging with it, moderators will handle it.</li>
          <li>Honest feedback on AI moderation helps improve the system for everyone.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}