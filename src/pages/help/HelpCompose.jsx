import React from 'react';
import { PenLine, Image, Hash, Eye, Repeat2 } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpCompose() {
  return (
    <HelpArticle title="Composing Posts" subtitle="Write posts, attach cards, and cross-post" slug="compose">
      <HelpSection icon={PenLine} title="What is Compose?">
        <p>Compose is where you create posts. Write text up to 500 characters, attach a card, add hashtags, set visibility and reply permissions, and optionally cross-post to Bluesky. Every post is mirrored to your AT Protocol PDS so it's portable.</p>
      </HelpSection>
      <HelpSection title="What you can include">
        <HelpList>
          <li><b>Text:</b> Up to 500 characters, with @mentions and #hashtags.</li>
          <li><b>Card attach:</b> Attach a card that renders richly on SwapPulse and as a link card on Bluesky.</li>
          <li><b>Hashtags:</b> Up to 10 hashtags, auto-canonicalised for discovery.</li>
          <li><b>Quote post:</b> Layer your commentary over another post.</li>
          <li><b>Post type:</b> Text, pack opening, trade, or showcase.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Image} title="Attaching a card">
        <HelpSteps>
          <li>Click the card-attach bar in the composer.</li>
          <li>Search for the card by name or set.</li>
          <li>Select it. A preview renders in your post.</li>
          <li>Optionally add alt text for screen reader accessibility.</li>
        </HelpSteps>
        <p>The attached card is mirrored to Bluesky as an external embed with the card image, localised name, and a deep link back to the SwapPulse card page.</p>
      </HelpSection>
      <HelpSection icon={Hash} title="Hashtags">
        <p>Add hashtags with the # symbol. They're canonicalised (lowercased, trimmed) for discovery. Follow a hashtag from its page to see matching posts in your For You feed. You can use up to 10 per post.</p>
      </HelpSection>
      <HelpSection icon={Eye} title="Visibility and replies">
        <HelpList>
          <li><b>Public:</b> Visible to everyone, federates publicly to Bluesky.</li>
          <li><b>Followers:</b> Only your followers can see it.</li>
          <li><b>Mentioned:</b> Only mentioned accounts can see it.</li>
          <li><b>Reply policy:</b> Choose who can reply: everybody, nobody, mentioned, or followers.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Repeat2} title="Cross-posting to Bluesky">
        <p>Because SwapPulse is built on the AT Protocol, your posts automatically mirror to your PDS and appear on Bluesky. You can optionally configure cross-posting behaviour in Settings. Your AT Protocol identity (DID and handle) is portable, you're not locked in.</p>
      </HelpSection>
    </HelpArticle>
  );
}