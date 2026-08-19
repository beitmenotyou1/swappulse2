import React from 'react';
import { Trophy, Star, Vote, Crown } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpPullOfTheWeek() {
  return (
    <HelpArticle title="Pull of the Week" subtitle="Nominate and vote on the best pulls" slug="pull-of-the-week">
      <HelpSection icon={Trophy} title="What is Pull of the Week?">
        <p>Each week, collectors nominate their best card pull. The community votes on the nominations, and the winner gets bragging rights. It's a fun, weekly celebration of the community's best pulls.</p>
      </HelpSection>
      <HelpSection title="How it works">
        <HelpList>
          <li><b>Nominate:</b> Submit your best pull of the week with the card attached.</li>
          <li><b>Vote:</b> Browse the week's nominations and vote for your favourites.</li>
          <li><b>Winner:</b> The pull with the most votes wins Pull of the Week.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Star} title="Nominating your pull">
        <HelpSteps>
          <li>Go to the Pull of the Week page.</li>
          <li>Click Nominate and select the card you pulled this week.</li>
          <li>Add a short description of the pull.</li>
          <li>Submit. Your nomination appears in the week's voting list.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Vote} title="Voting">
        <p>Browse the week's nominations and vote for the pulls you think are best. You can vote on multiple nominations. Voting closes at the end of the week and the winner is announced.</p>
      </HelpSection>
      <HelpSection icon={Crown} title="Winning">
        <p>The winning pull is highlighted on the page and the winner earns community bragging rights. Past winners are archived so you can browse the hall of fame.</p>
      </HelpSection>
    </HelpArticle>
  );
}