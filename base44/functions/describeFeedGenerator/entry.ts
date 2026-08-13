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
    ],
    links: {
      privacyPolicy: 'https://swappulse.org/legal/privacy',
      termsOfService: 'https://swappulse.org/legal/terms',
    },
  });
}