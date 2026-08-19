import React from 'react';
import { Users, Plus, MessageSquare, Eye } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpCircles() {
  return (
    <HelpArticle title="Circles" subtitle="Themed collector groups" slug="circles">
      <HelpSection icon={Users} title="What are Circles?">
        <p>Circles are themed collector groups: vintage, competitive, shiny, regional, and more. Join a circle to see scoped trade listings, discussions, and meetups. You can be in multiple circles at once. Circles help you find collectors who share your specific interests.</p>
      </HelpSection>
      <HelpSection title="What circles offer">
        <HelpList>
          <li><b>Scoped trades:</b> Trade listings can be limited to circle members only.</li>
          <li><b>Scoped discussions:</b> Posts and discussions within the circle's context.</li>
          <li><b>Scoped meetups:</b> Meetups organised for circle members.</li>
          <li><b>Community:</b> A focused group of like-minded collectors.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Plus} title="Joining a circle">
        <HelpSteps>
          <li>Go to the Circles page to browse available circles.</li>
          <li>Open a circle to see its description, members, and activity.</li>
          <li>Click Join. You're now a member.</li>
          <li>Circle-scoped content appears in your relevant feeds.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={MessageSquare} title="Participating">
        <p>Once you're in a circle, you can see and create circle-scoped trade listings, join circle discussions, and attend circle meetups. Some circles may have entry requirements set by the organiser.</p>
      </HelpSection>
      <HelpSection icon={Eye} title="Creating a circle">
        <p>If you want to start a new themed group, you can create a circle. Define the theme, description, and whether it's open or requires approval to join.</p>
      </HelpSection>
      <HelpSection title="Tips" variant="primary">
        <HelpList>
          <li>Join circles that match your collecting focus for the most relevant trades and discussions.</li>
          <li>You can leave a circle anytime from its page or your settings.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}