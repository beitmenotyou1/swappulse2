// §2.2 describeFeedGenerator — AT Protocol feed generator discovery endpoint.
// Public (no auth): returns the descriptor for the Who to Follow feed so AT
// Protocol clients can resolve and subscribe to it.
export default async function (_req: Request): Promise<Response> {
  return Response.json({
    did: 'did:web:feed.swappulse.org',
    feeds: [
      {
        uri: 'at://did:web:feed.swappulse.org/app.bsky.feed.generator/whoto-follow',
        did: 'did:web:feed.swappulse.org',
        description:
          "Trust-based collector recommendations powered by SwapPulse's vouch graph. Discover collectors who share your values, complement your collection focus, and strengthen the community.",
        descriptionLang: 'en',
        author: {
          did: 'did:web:feed.swappulse.org',
          handle: 'whoto-follow.swappulse.org',
          displayName: 'SwapPulse Who to Follow',
        },
      },
      {
        uri: 'at://did:web:feed.swappulse.org/app.bsky.feed.generator/trade-listings',
        did: 'did:web:feed.swappulse.org',
        description:
          'Live peer-to-peer card trade listings from the SwapPulse community. Discover open trades offering cards you want.',
        descriptionLang: 'en',
        author: {
          did: 'did:web:feed.swappulse.org',
          handle: 'trades.swappulse.org',
          displayName: 'SwapPulse Trades',
        },
      },
      {
        uri: 'at://did:web:feed.swappulse.org/app.bsky.feed.generator/collection-posts',
        did: 'did:web:feed.swappulse.org',
        description:
          'Community collection activity, card showcases and pack opening pulls from collectors across the network.',
        descriptionLang: 'en',
        author: {
          did: 'did:web:feed.swappulse.org',
          handle: 'collections.swappulse.org',
          displayName: 'SwapPulse Collections',
        },
      },
      {
        uri: 'at://did:web:feed.swappulse.org/app.bsky.feed.generator/fresh-pulls',
        did: 'did:web:feed.swappulse.org',
        description:
          'Fresh pack-opening pulls from collectors across the network — the newest revealed cards in real time.',
        descriptionLang: 'en',
        author: {
          did: 'did:web:feed.swappulse.org',
          handle: 'pulls.swappulse.org',
          displayName: 'SwapPulse Fresh Pulls',
        },
      },
      {
        uri: 'at://did:web:feed.swappulse.org/app.bsky.feed.generator/showcase',
        did: 'did:web:feed.swappulse.org',
        description:
          'Card showcases and public digital binders from collectors — the pride of the community in one feed.',
        descriptionLang: 'en',
        author: {
          did: 'did:web:feed.swappulse.org',
          handle: 'showcase.swappulse.org',
          displayName: 'SwapPulse Showcase',
        },
      },
      {
        uri: 'at://did:web:feed.swappulse.org/app.bsky.feed.generator/journals',
        did: 'did:web:feed.swappulse.org',
        description:
          'Long-form collector journals — set deep-dives, collection stories, and market reflections from the SwapPulse community.',
        descriptionLang: 'en',
        author: {
          did: 'did:web:feed.swappulse.org',
          handle: 'journals.swappulse.org',
          displayName: 'SwapPulse Journals',
        },
      },
      {
        uri: 'at://did:web:feed.swappulse.org/app.bsky.feed.generator/card-reviews',
        did: 'did:web:feed.swappulse.org',
        description:
          'Multi-axis card reviews — artwork, playability, collectibility, and investment ratings from Pokémon TCG collectors.',
        descriptionLang: 'en',
        author: {
          did: 'did:web:feed.swappulse.org',
          handle: 'reviews.swappulse.org',
          displayName: 'SwapPulse Card Reviews',
        },
      },
    ],
    links: {
      privacyPolicy: 'https://swappulse.org/legal/privacy',
      termsOfService: 'https://swappulse.org/legal/terms',
    },
  });
}