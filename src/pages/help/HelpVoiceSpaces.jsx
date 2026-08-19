import React from 'react';
import { Radio, Mic, Video, Users, Circle } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpVoiceSpaces() {
  return (
    <HelpArticle title="Voice Spaces" subtitle="Go live and host audio stages" slug="voice-spaces">
      <HelpSection icon={Radio} title="What are Voice Spaces?">
        <p>Voice Spaces are live audio sessions. There are two modes: external (paste a stream URL from Twitch, YouTube, Kick, etc. to go live) and in-platform (a true audio stage where participants hear each other via a WebRTC peer mesh). Hosts can record in-platform spaces and publish them as podcast episodes.</p>
      </HelpSection>
      <HelpSection title="Two modes">
        <HelpList>
          <li><b>External:</b> Paste a stream URL (Twitch, YouTube, Kick, Facebook Gaming, Rumble, custom RTMP). Your profile shows a red live ring and followers get notified. No WebRTC needed, listeners just open the stream.</li>
          <li><b>In-platform:</b> Host a true audio stage where participants hear each other via a WebRTC peer mesh. No external stream needed. Hosts can promote speakers, mute, and record.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Video} title="Going live (external)">
        <HelpSteps>
          <li>Go to Voice Spaces and click Go Live.</li>
          <li>Choose External mode.</li>
          <li>Paste your stream URL. The platform is auto-detected.</li>
          <li>Set a title, description, and planned duration (15 to 480 minutes).</li>
          <li>Go live. Your profile shows a live ring and followers are notified.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Mic} title="Hosting an in-platform space">
        <HelpSteps>
          <li>Go to Voice Spaces and click Go Live.</li>
          <li>Choose In-platform mode.</li>
          <li>Set a title, description, and planned duration.</li>
          <li>Go live. Participants join and hear each other via WebRTC.</li>
          <li>Promote listeners to speakers, mute as needed, and optionally record.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Users} title="Participating">
        <p>Join a live space from the Voice Spaces page or a profile with a live ring. In external mode, you're taken to the stream. In in-platform mode, you join the audio stage as a listener. Raise your hand or ask the host to promote you to speak.</p>
      </HelpSection>
      <HelpSection icon={Circle} title="Live ring and auto-end">
        <p>While live, your avatar shows a pulsing red ring across the site. Spaces auto-end at the planned duration, or the host can end manually. The live ring disappears when the space ends.</p>
      </HelpSection>
      <HelpSection title="Known limitations" variant="warning">
        <HelpList>
          <li>In-platform spaces use a WebRTC peer mesh. Some networks (corporate Wi-Fi, symmetric NATs) block WebRTC. Try a different network if you can't connect.</li>
          <li>External streams are not re-hosted by SwapPulse, listeners go to your stream URL directly.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}