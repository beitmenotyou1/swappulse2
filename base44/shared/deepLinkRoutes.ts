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
  message: (p) => `/messages/${p.conversationId}`,
  reputation: (p) => '/trust',
  trade_update: (p) => `/trade/${p.tradeId}`,
  pack_pull: (p) => '/pack-openings',
  // Aliases for Notification entity action_type values
  voice_live: (p) => '/spaces',
  podcast: (p) => '/spaces',
  // Post interaction notifications open the post detail page.
  like: (p) => (p.postId ? `/post/${p.postId}` : '/notifications'),
  repost: (p) => (p.postId ? `/post/${p.postId}` : '/notifications'),
  comment: (p) => (p.postId ? `/post/${p.postId}` : '/notifications'),
  starter_pack: (p) => (p.packId ? `/starter-packs/${p.packId}` : '/notifications'),
  wallet_topup: (p) => '/wallet',
  escrow_held: (p) => (p.tradeId ? `/trade/${p.tradeId}` : '/wallet'),
  escrow_released: (p) => (p.tradeId ? `/trade/${p.tradeId}` : '/wallet'),
  low_balance: (p) => '/wallet',
  // Appchain state transitions all land on the collector's wallet, except the
  // usership score which belongs to their public profile.
  chain_mint: (p) => '/wallet',
  chain_stake: (p) => '/wallet',
  chain_unlock: (p) => '/wallet',
  chain_bridge: (p) => '/wallet',
  chain_rewards: (p) => '/wallet',
  chain_recovery: (p) => '/wallet',
  chain_usership: (p) => (p.did ? `/profile/${p.did}` : '/wallet'),
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