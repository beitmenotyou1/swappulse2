import React from 'react';
import { Library, Download, Users, CheckCircle } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpSets() {
  return (
    <HelpArticle title="Sets & Checklists" subtitle="Browse sets, track completion, and download checklists" slug="sets">
      <HelpSection icon={Library} title="What is the Sets page?">
        <p>The Sets page lists every Pokémon TCG expansion in the TCGDex catalogue. Browse by series, open a set to see all its cards, track your completion percentage, download printable checklists, and find set buddies, other collectors working on the same set.</p>
      </HelpSection>
      <HelpSection title="What you can do">
        <HelpList>
          <li><b>Browse sets:</b> Filter by series (Scarlet & Violet, Sword & Shield, Sun & Moon, etc.) and release date.</li>
          <li><b>View all cards:</b> Open a set to see every card in collector-number order with images and rarities.</li>
          <li><b>Track completion:</b> Your completion percentage updates live as you add cards to your collection.</li>
          <li><b>Find set buddies:</b> See other collectors working on the same set and connect with them.</li>
          <li><b>Download checklists:</b> Export a printable PDF checklist for any set.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={CheckCircle} title="Tracking set completion">
        <HelpSteps>
          <li>Open the set you want to track.</li>
          <li>The completion bar shows how many cards you own out of the set total.</li>
          <li>Add cards to your collection from the set page or from individual card pages.</li>
          <li>Missing cards are listed at the bottom so you can see exactly what you still need.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Users} title="Set buddies">
        <p>Set buddies are other collectors actively working on the same set. SwapPulse matches you based on shared set activity so you can trade duplicates, share progress, and celebrate completions together.</p>
      </HelpSection>
      <HelpSection icon={Download} title="Downloading checklists">
        <p>Every set has a downloadable PDF checklist. Use it to track your collection offline, take it to a trade night, or share with friends. The checklist reflects your owned cards with checkmarks.</p>
      </HelpSection>
      <HelpSection title="Tips" variant="primary">
        <HelpList>
          <li>Official set codes (like PAL or MEW) don't always match TCGDex set IDs, so browse by name if a code search fails.</li>
          <li>Set completion counts unique card URIs, so a holo and a reverse holo of the same card count separately.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}