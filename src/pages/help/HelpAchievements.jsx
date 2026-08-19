import React from 'react';
import { Medal, Shield, Camera, TrendingUp } from 'lucide-react';
import HelpArticle, { HelpSection, HelpList } from '@/components/help/HelpArticle';

export default function HelpAchievements() {
  return (
    <HelpArticle title="Achievements" subtitle="Earn badges for your collecting" slug="achievements">
      <HelpSection icon={Medal} title="What are Achievements?">
        <p>Achievements are badges earned for collection milestones, trading, scanner accuracy, and community contributions. Each achievement is backed by an immutable SHA-256 proof snapshot so it's verifiable. Show off your collecting accomplishments with gold medallions and rarity-based glows.</p>
      </HelpSection>
      <HelpSection title="How you earn achievements">
        <HelpList>
          <li><b>Collection milestones:</b> Reach card count thresholds, complete sets, or own rare cards.</li>
          <li><b>Trading:</b> Complete a number of trades, maintain positive feedback, or earn Trusted Trader status.</li>
          <li><b>Scanner accuracy:</b> Submit correct scanner corrections that help the model learn.</li>
          <li><b>Community:</b> Contribute vouches, feedback, journals, or helpful posts.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Shield} title="Verifiable proofs">
        <p>Each achievement is backed by an immutable SHA-256 snapshot of the qualifying data at the time it was earned. This makes achievements verifiable: anyone can check the proof to confirm the achievement was legitimately earned. You can export and share your proofs.</p>
      </HelpSection>
      <HelpSection icon={Camera} title="Scanner corrections">
        <p>When you scan a card and correct a wrong match, your correction is recorded. Accumulate correct corrections to earn scanner accuracy achievements. Corrections also improve the model for everyone.</p>
      </HelpSection>
      <HelpSection icon={TrendingUp} title="Viewing your achievements">
        <p>Go to the Achievements page to see all badges you've earned and those you're working toward. Each medallion shows its rarity with a themed glow. Some achievements have progress indicators so you know how close you are.</p>
      </HelpSection>
      <HelpSection title="Tips" variant="primary">
        <HelpList>
          <li>Set completion badges require 100% unique card URIs from TCGDex.</li>
          <li>Achievements are recalculated periodically, so newly-qualified badges may take a short time to appear.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}