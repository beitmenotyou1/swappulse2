import React from 'react';
import { Mail, Lock, Key, AlertTriangle } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpMessages() {
  return (
    <HelpArticle title="Direct Messages" subtitle="End-to-end encrypted private chat" slug="messages">
      <HelpSection icon={Mail} title="What are Direct Messages?">
        <p>Direct messages (DMs) are private 1:1 chats with other collectors. They are end-to-end encrypted (E2EE), meaning only you and your recipient can read them. SwapPulse cannot read your messages, ever.</p>
      </HelpSection>
      <HelpSection icon={Lock} title="How encryption works">
        <p>When you first use DMs, your browser generates an encryption key pair. Your private key lives in your browser's IndexedDB and never leaves your device. Messages are encrypted before sending; only your recipient's private key can decrypt them. This means SwapPulse's servers only ever see encrypted ciphertext.</p>
      </HelpSection>
      <HelpSection title="Starting a conversation">
        <HelpSteps>
          <li>Go to a collector's profile and click Message.</li>
          <li>Or open the Messages page and start a new conversation.</li>
          <li>Type your message and send. It's encrypted on your device before it leaves.</li>
          <li>Your conversation appears in your Messages list.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Key} title="Your keys">
        <p>Your private key is generated and stored locally in your browser. It never gets sent to SwapPulse. This is what makes your messages truly private, but it also means there's no recovery if you lose it.</p>
      </HelpSection>
      <HelpSection icon={AlertTriangle} title="Important: losing your key" variant="warning">
        <HelpList>
          <li>If you clear your browser data, switch browsers, or use a new device, you won't be able to read existing encrypted messages there.</li>
          <li>New conversations will work fine, your browser generates a fresh key pair.</li>
          <li>There is no recovery for lost keys by design. SwapPulse cannot decrypt your messages for you.</li>
        </HelpList>
      </HelpSection>
      <HelpSection title="Tips" variant="primary">
        <HelpList>
          <li>Don't clear your browser storage if you want to keep access to old messages.</li>
          <li>DMs are for 1:1 conversations. For trade negotiations, use trade threads.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}