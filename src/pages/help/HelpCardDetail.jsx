import React from 'react';
import { CreditCard, MessageSquare, ArrowLeftRight, Package, Star } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpCardDetail() {
  return (
    <HelpArticle title="Card Detail Pages" subtitle="Every card is a social hub" slug="card-detail">
      <HelpSection icon={CreditCard} title="What is a card detail page?">
        <p>Every card in the TCGDex catalogue has its own page at /card/:cardId. It's not just a static stats page, it's a social hub that surfaces everything the community is saying, trading, and pulling about that specific card, merged from local SwapPulse posts and federated Bluesky posts.</p>
      </HelpSection>
      <HelpSection title="What you'll find">
        <HelpList>
          <li><b>Card image and stats:</b> Full art, set name, collector number, rarity, and variant pricing.</li>
          <li><b>Price history chart:</b> Market price trends over time pulled from TCGDex pricing data.</li>
          <li><b>Variant pricing:</b> Normal, holo, and reverse holo market prices side by side.</li>
          <li><b>Evolution chain:</b> The card's pre-evolutions and evolutions, linked for easy browsing.</li>
          <li><b>Posts tab:</b> Community posts and discussions that reference this card.</li>
          <li><b>Trades tab:</b> Active trade listings offering or seeking this card.</li>
          <li><b>Pack Openings tab:</b> Recent pack-opening posts featuring this card.</li>
          <li><b>Reviews:</b> Multi-axis collector reviews (artwork, playability, collectibility, investment).</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Star} title="Reviewing a card">
        <HelpSteps>
          <li>Scroll to the Reviews section on the card page.</li>
          <li>Rate the card 1 to 5 on artwork, playability, collectibility, and investment.</li>
          <li>Write an optional review (up to 2,000 characters).</li>
          <li>Submit. Your review is mirrored to your AT Protocol PDS as a portable record.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={MessageSquare} title="Posting about a card">
        <p>From the card page you can compose a post that attaches this card. The post renders richly on both SwapPulse and Bluesky with a deep link back to the card page.</p>
      </HelpSection>
      <HelpSection icon={ArrowLeftRight} title="Trading this card">
        <p>The Trades tab shows every active listing offering or seeking this card. Tap a listing to open the seller's profile or start a trade thread.</p>
      </HelpSection>
      <HelpSection icon={Package} title="Adding to your collection">
        <p>Use the Add to Collection button to add the card to your collection with condition, variant, and quantity. Use the wishlist heart to save it for later.</p>
      </HelpSection>
    </HelpArticle>
  );
}