import React from 'react';
import { Target, Trophy, Plus, Medal } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpChallenges() {
  return (
    <HelpArticle title="Challenges & Leaderboards" subtitle="Community goals and competitions" slug="challenges">
      <HelpSection icon={Target} title="What are Challenges?">
        <p>Challenges are community goals and competitions: set sprints, budget decks, pull contests, and collective targets. Join a challenge, submit entries to contribute, and climb the leaderboard. Some challenges are individual, others are collective community goals.</p>
      </HelpSection>
      <HelpSection title="Types of challenges">
        <HelpList>
          <li><b>Set sprints:</b> Complete a set within a time limit.</li>
          <li><b>Budget decks:</b> Build a deck under a price cap.</li>
          <li><b>Pull contests:</b> Best pull of a specific set or rarity.</li>
          <li><b>Community goals:</b> Collective targets the whole community works toward.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Plus} title="Joining a challenge">
        <HelpSteps>
          <li>Go to the Challenges page to browse active challenges.</li>
          <li>Open a challenge to see the rules, prize, and current entries.</li>
          <li>Click Join to opt in.</li>
          <li>Submit entries as instructed by the challenge type.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Medal} title="Submitting entries">
        <p>Depending on the challenge, you submit entries like a completed set, a deck list, or a pull post. Entries are validated against the challenge rules. Some challenges require manual opt-in before you can submit.</p>
      </HelpSection>
      <HelpSection icon={Trophy} title="Leaderboards">
        <p>Each challenge with a leaderboard shows rankings at /challenges/:challengeId/leaderboard. Climb the board by submitting qualifying entries. Top performers earn community recognition and sometimes badges.</p>
      </HelpSection>
    </HelpArticle>
  );
}