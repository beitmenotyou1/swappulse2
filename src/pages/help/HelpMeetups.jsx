import React from 'react';
import { CalendarDays, MapPin, Users, CheckCircle } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpMeetups() {
  return (
    <HelpArticle title="Meetups" subtitle="Organise and attend in-person events" slug="meetups">
      <HelpSection icon={CalendarDays} title="What are Meetups?">
        <p>Meetups are in-person events for collectors: swaps, live pulls, trade nights, and community gatherings. Organise one near you or attend one in your area. SwapPulse handles the listings, RSVPs, and map, you handle the fun.</p>
      </HelpSection>
      <HelpSection title="What you can do">
        <HelpList>
          <li><b>Browse meetups:</b> See upcoming meetups on a map and in a list.</li>
          <li><b>RSVP:</b> Mark yourself as attending so the organiser knows.</li>
          <li><b>Organise:</b> Create a meetup with date, time, location, and description.</li>
          <li><b>Manage RSVPs:</b> See who's attending as the organiser.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={MapPin} title="Finding meetups near you">
        <p>The Meetups page shows events on a map. Pan and zoom to your area to see what's nearby. Each marker shows the event details and a link to RSVP.</p>
      </HelpSection>
      <HelpSection icon={Users} title="Organising a meetup">
        <HelpSteps>
          <li>Go to the Meetups page and click Create Meetup.</li>
          <li>Set the title, date, time, and location (with map coordinates).</li>
          <li>Add a description so collectors know what to expect.</li>
          <li>Publish. Your meetup appears on the map and list.</li>
          <li>Track RSVPs from your meetup's detail page.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={CheckCircle} title="RSVPing">
        <p>Click Attend on any meetup to RSVP. The organiser sees your attendance. You can change your RSVP if plans change.</p>
      </HelpSection>
      <HelpSection title="Tips" variant="primary">
        <HelpList>
          <li>Scope a meetup to a circle for a more focused group.</li>
          <li>Be clear about what to bring (cards for trading, cash, etc.) in the description.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}