import React from 'react';
import { Settings, Globe, Bell, Shield, Eye, Key } from 'lucide-react';
import HelpArticle, { HelpSection, HelpList } from '@/components/help/HelpArticle';

export default function HelpSettings() {
  return (
    <HelpArticle title="Settings" subtitle="Manage your account and preferences" slug="settings">
      <HelpSection icon={Settings} title="What is in Settings?">
        <p>Settings is your control centre for language, privacy, notifications, accessibility, AT Protocol, and account preferences. Everything you need to tailor SwapPulse to your needs is here.</p>
      </HelpSection>
      <HelpSection icon={Globe} title="Language">
        <p>Switch the entire interface and card catalogue between 9+ languages: English, Français, Deutsch, Español, Italiano, Português, 日本語, 中文, 한국어. Your choice is saved to your account and persists across sessions. Card names, set names, and flavour text all switch instantly.</p>
      </HelpSection>
      <HelpSection icon={Bell} title="Notifications">
        <HelpList>
          <li><b>Push notifications:</b> Enable web push (no app install required) via VAPID.</li>
          <li><b>Quiet hours:</b> Pause non-critical alerts during set hours.</li>
          <li><b>Per-event toggles:</b> Choose which event types notify you (trade matches, price alerts, mentions, etc.).</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Shield} title="Privacy">
        <HelpList>
          <li><b>Who can reach you:</b> Control who can message you or reply to your posts.</li>
          <li><b>Default visibility:</b> Set your default post visibility (public, followers, mentioned).</li>
          <li><b>Collection visibility:</b> Choose whether your collection stats are public.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Eye} title="Accessibility">
        <p>Enable reduced motion, high contrast, and other accessibility options. SwapPulse follows WCAG 2.1 AA standards for keyboard navigation, screen reader support, and colour contrast.</p>
      </HelpSection>
      <HelpSection icon={Key} title="AT Protocol & account">
        <HelpList>
          <li><b>AT Protocol:</b> View your DID, manage your handle, and verify a custom domain.</li>
          <li><b>Two-factor authentication:</b> Enable 2FA for extra security.</li>
          <li><b>Cross-posting:</b> Configure how your posts mirror to Bluesky.</li>
          <li><b>Data privacy:</b> Export your data or submit a data subject request.</li>
          <li><b>Delete account:</b> Permanently delete your account and data.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}