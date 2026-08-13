// Deep link route map — maps notification types to in-app routes.
// Used by the server-side dispatcher (notificationDispatcher.ts) and the
// client-side deep link parser (src/lib/deepLinks.js) to route notification
// taps to the correct page.

export const ROUTE_MAP: Record<string, (params: Record<string, unknown>) => string> = {
  trade_match: (p) => '/trades',
  trade_listing: (p) => `/trades`,
  price_alert: (p) => `/card/${p.cardId}`,
  pack_opening: (p) => '/pack-openings',
  journal: (p) => `/profile/${p.authorDid}`,
  binder: (p) => `/binder/${p.binderId}`,
  voice_space: (p) => `/spaces/${p.spaceId}`,
  podcast_episode: (p) => '/spaces',
  goes_live: (p) => '/spaces',
  story: (p) => `/profile/${p.authorDid}`,
  vouch_received: (p) => `/profile/${p.voucherDid}`,
  review_posted: (p) => `/card/${p.cardId}`,
  comment_reply: (p) => `/card/${p.cardId}`,
  comment_reaction: (p) => `/card/${p.cardId}`,
  meetup_announcement: (p) => `/meetups/${p.meetupId}`,
  challenge_update: (p) => `/challenges/${p.challengeId}`,
  weekly_digest: (p) => '/',
  sentiment_resolution: (p) => '/market',
  wishlist_activity: (p) => '/collection',
  mention: (p) => '/notifications',
  reaction: (p) => '/notifications',
  follow: (p) => `/profile/${p.followerDid}`,
  message: (p) => `/trades/${p.tradeId}`,
  reputation: (p) => '/trust',
  trade_update: (p) => `/trade/${p.tradeId}`,
  pack_pull: (p) => '/pack-openings',
  // Aliases for Notification entity action_type values
  voice_live: (p) => '/spaces',
  podcast: (p) => '/spaces',
  like: (p) => '/notifications',
};

export function buildDeepLink(type: string, params: Record<string, unknown>): string {
  const builder = ROUTE_MAP[type];
  if (!builder) return '/notifications';
  try {
    return builder(params) || '/notifications';
  } catch {
    return '/notifications';
  }
}