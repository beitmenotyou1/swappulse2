import React from 'react';
import { PartyPopper, Calendar, Users, Sparkles } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpPackParties() {
  return (
    <HelpArticle title="Pack Parties" subtitle="Synchronised pack-opening events" slug="pack-parties">
      <HelpSection icon={PartyPopper} title="What are Pack Parties?">
        <p>A pack party is a synchronised pack-opening event. The host picks a set and a time, participants join and open packs of that set at the same time, sharing reactions live. It's a virtual pack-opening night with friends.</p>
      </HelpSection>
      <HelpSection title="How it works">
        <HelpList>
          <li><b>Host creates a party:</b> Chooses a set, date, and time.</li>
          <li><b>Participants join:</b> RSVP to the party before it starts.</li>
          <li><b>Everyone opens packs:</b> At the scheduled time, open packs of the chosen set.</li>
          <li><b>Share reactions:</b> Post your pulls and react to others' in real time.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Calendar} title="Joining a party">
        <HelpSteps>
          <li>Go to the Pack Parties page to see upcoming events.</li>
          <li>Open a party to see the set, time, and who's joining.</li>
          <li>Click Join to RSVP.</li>
          <li>When the party starts, open your packs and share your pulls.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Users} title="Hosting a party">
        <p>Create a party, pick a set and time, and invite your circles or the whole community. As host, you can manage the event and see who's joining.</p>
      </HelpSection>
      <HelpSection icon={Sparkles} title="During the party">
        <p>Post your pulls as pack-opening posts. They appear in the party feed so everyone can react in real time. It's the closest thing to opening packs together in person.</p>
      </HelpSection>
    </HelpArticle>
  );
}