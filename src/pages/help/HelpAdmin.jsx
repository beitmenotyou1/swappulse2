import React from 'react';
import { Gavel, Activity, Users, Wrench } from 'lucide-react';
import HelpArticle, { HelpSection, HelpList } from '@/components/help/HelpArticle';

export default function HelpAdmin() {
  return (
    <HelpArticle title="Admin" subtitle="Admin dashboard and tools" slug="admin">
      <HelpSection icon={Gavel} title="What is the Admin page?">
        <p>The Admin page is the administration dashboard for SwapPulse admins. It provides centralised access to system health, operational metrics, service management, incident handling, and federation diagnostics. Access is restricted to admin-role users.</p>
      </HelpSection>
      <HelpSection title="What admins can do">
        <HelpList>
          <li><b>Health monitoring:</b> View live service health and trigger health checks.</li>
          <li><b>Metrics:</b> Platform-wide metrics for users, posts, trades, and activity.</li>
          <li><b>Service management:</b> Update service status, criticality, and check intervals.</li>
          <li><b>Incident management:</b> Create, update, and resolve incidents.</li>
          <li><b>Maintenance windows:</b> Schedule and manage maintenance.</li>
          <li><b>Federation diagnostics:</b> Check AT Protocol federation health and PDS sync.</li>
          <li><b>Invite codes:</b> Generate and manage invite codes for the alpha.</li>
          <li><b>Email testing:</b> Send test emails to verify SMTP configuration.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Activity} title="Health and diagnostics">
        <p>The health section shows real-time service status and lets admins trigger manual health checks. Federation diagnostics help troubleshoot AT Protocol connectivity, PDS sync, and firehose ingestion issues.</p>
      </HelpSection>
      <HelpSection icon={Users} title="User management">
        <p>Admins can invite users, manage roles, and handle data subject requests. User records are created via invitation, not direct creation.</p>
      </HelpSection>
      <HelpSection icon={Wrench} title="Operations">
        <p>The admin dashboard surfaces operational tasks like SEO audits, bot protection logs, and backfill operations so the team can keep the platform healthy and secure.</p>
      </HelpSection>
    </HelpArticle>
  );
}