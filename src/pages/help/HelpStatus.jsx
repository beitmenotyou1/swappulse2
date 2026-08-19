import React from 'react';
import { Activity, Bell, AlertTriangle, Wrench } from 'lucide-react';
import HelpArticle, { HelpSection, HelpList } from '@/components/help/HelpArticle';

export default function HelpStatus() {
  return (
    <HelpArticle title="System Status" subtitle="Check service health" slug="status">
      <HelpSection icon={Activity} title="What is the System Status page?">
        <p>The System Status page shows the real-time health of every SwapPulse service: the database, TCGDex catalogue sync, AT Protocol bridge, firehose ingestion, payments, and more. Check it when something seems broken to see if it's a known issue.</p>
      </HelpSection>
      <HelpSection title="What you can see">
        <HelpList>
          <li><b>Global status:</b> An at-a-glance indicator of overall platform health.</li>
          <li><b>Service list:</b> Each monitored service with its current status (operational, degraded, outage, maintenance).</li>
          <li><b>Uptime bars:</b> Recent uptime history for each service.</li>
          <li><b>Active incidents:</b> Current incidents with updates and severity.</li>
          <li><b>Maintenance windows:</b> Scheduled maintenance that may affect availability.</li>
          <li><b>Incident history:</b> Past incidents and how they were resolved.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Bell} title="Subscribing to updates">
        <p>Subscribe to status updates by email so you're notified when incidents occur or resolve. You can unsubscribe anytime.</p>
      </HelpSection>
      <HelpSection icon={AlertTriangle} title="When something is down">
        <p>If a service shows degraded or outage, the team is already working on it. Check the active incidents section for details and estimated resolution times. You don't need to report it, but you can send feedback if you're experiencing something not shown.</p>
      </HelpSection>
      <HelpSection icon={Wrench} title="Maintenance windows">
        <p>Scheduled maintenance windows are posted in advance so you know when to expect brief downtime. Services may be intermittently unavailable during a window.</p>
      </HelpSection>
    </HelpArticle>
  );
}