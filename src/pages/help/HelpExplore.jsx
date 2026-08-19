import React from 'react';
import { Compass, Search, Filter, Heart } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpExplore() {
  return (
    <HelpArticle title="Explore" subtitle="Browse the full Pokémon TCG catalogue" slug="explore">
      <HelpSection icon={Compass} title="What is Explore?">
        <p>Explore is your gateway to the entire Pokémon TCG catalogue, powered by the open TCGDex database. Search for any card by name, browse by set, filter by rarity or illustrator, and discover collectors who share your interests.</p>
      </HelpSection>
      <HelpSection icon={Search} title="Searching for cards">
        <HelpSteps>
          <li>Type a card name, set code, or collector number into the search bar at the top of the page.</li>
          <li>Results appear instantly as you type, merged across all nine supported languages.</li>
          <li>If your search doesn't match in English, SwapPulse automatically tries French, German, Italian, Spanish, Portuguese, Japanese, Chinese, and Korean before giving up.</li>
          <li>Tap any result to open the card's detail page.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Filter} title="Filtering and browsing">
        <HelpList>
          <li><b>By set:</b> Open the Sets page to browse every expansion, then drill into a set to see all its cards.</li>
          <li><b>By rarity:</b> Use the rarity filter to narrow results to Common, Uncommon, Rare, Holo, or Secret Rare.</li>
          <li><b>By people:</b> Switch to the People tab to search for collectors by handle or name.</li>
          <li><b>By community:</b> Switch to the Posts tab to see recent community activity matching your search.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Heart} title="Wishlist from search">
        <p>When browsing card results, you can select multiple cards and add them to your wishlist in one action. A selection toolbar appears at the bottom of the grid when you have cards selected.</p>
      </HelpSection>
      <HelpSection title="Tips" variant="primary">
        <HelpList>
          <li>Card names switch to your selected language automatically, so you can search in your native tongue.</li>
          <li>If a search returns nothing, try the set name instead of the set code, official codes don't always match TCGDex IDs.</li>
          <li>The Trending Cards rail on the home feed shows what the community is talking about right now.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}