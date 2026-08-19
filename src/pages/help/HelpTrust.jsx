import React from 'react';
import { ShieldCheck, ThumbsUp, Award, AlertTriangle } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpTrust() {
  return (
    <HelpArticle title="Trust & Reputation" subtitle="How trust works on SwapPulse" slug="trust">
      <HelpSection icon={ShieldCheck} title="What is Trust?">
        <p>Trust is SwapPulse's reputation system. It helps you decide who to trade with by surfacing vouches, trading feedback, and a trusted-trader score for every collector. Trust is earned through honest participation, not bought.</p>
      </HelpSection>
      <HelpSection title="How trust is built">
        <HelpList>
          <li><b>Trading feedback:</b> After each completed trade, both parties leave feedback (positive, neutral, or negative). This is the core signal.</li>
          <li><b>Vouches:</b> Experienced collectors can vouch for others they've traded with successfully. Vouches carry weight based on the voucher's own reputation.</li>
          <li><b>Trade history:</b> The number and consistency of completed trades contributes to your score.</li>
          <li><b>Trusted Trader badge:</b> Collectors who meet the threshold get a visible badge on their profile and listings.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={ThumbsUp} title="Leaving feedback">
        <HelpSteps>
          <li>After a trade completes, go to your Trade Dashboard or the trade thread.</li>
          <li>Click Leave Feedback.</li>
          <li>Choose positive, neutral, or negative and write a short comment.</li>
          <li>Submit. Your feedback appears on the other collector's trust profile.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Award} title="Vouching for someone">
        <p>If you've had a positive trade with a collector, you can vouch for them on their Trust page. Your vouch adds to their trust score based on your own standing. Vouches from highly-trusted collectors carry more weight.</p>
      </HelpSection>
      <HelpSection icon={AlertTriangle} title="Disputes">
        <p>If a trade goes wrong, open a dispute from the trade thread. Disputes are visible to moderators who can help mediate. Repeated disputes against a collector affect their trust score and can lead to enforcement action.</p>
      </HelpSection>
      <HelpSection title="Tips" variant="primary">
        <HelpList>
          <li>Check a collector's trust score and feedback before starting a trade.</li>
          <li>Always leave honest feedback, it protects the whole community.</li>
          <li>New collectors start with a neutral score, everyone gets a fair start.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}