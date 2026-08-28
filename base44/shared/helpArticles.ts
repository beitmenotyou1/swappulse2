// Shared help article registry for backend functions. Mirrors the slug, title,
// category, and description of every entry in src/lib/helpGuides.js (the
// frontend registry) without the React icon components (which are not usable
// in backend Deno functions). When a new help article is added to the
// frontend, add the corresponding entry here too so the promo rotation
// includes it.
//
// Used by post-help-promo to cycle through all help guides on the SwapPulse
// bot account, posting one article at a time to the AT Protocol.

export interface HelpArticle {
  slug: string;
  title: string;
  category: string;
  description: string;
}

export const HELP_ARTICLES: HelpArticle[] = [
  // Collection & Catalogue
  { slug: 'explore', title: 'Explore', category: 'Collection & Catalogue', description: 'Browse the full Pokémon TCG catalogue by set, rarity, or illustrator.' },
  { slug: 'card-detail', title: 'Card Detail Pages', category: 'Collection & Catalogue', description: 'Every card is a social hub with stats, posts, trades, and pack openings.' },
  { slug: 'sets', title: 'Sets & Checklists', category: 'Collection & Catalogue', description: 'Browse sets, download checklists, track completion, and find set buddies.' },
  { slug: 'collection', title: 'Collection', category: 'Collection & Catalogue', description: 'Track every card you own with portfolio value, duplicates, and insurance exports.' },
  { slug: 'grading', title: 'Grading', category: 'Collection & Catalogue', description: 'Prepare grading submissions and review condition reports for your cards.' },
  { slug: 'market-watch', title: 'Market Watch', category: 'Collection & Catalogue', description: 'Track card prices, set alerts, and watch market trends over time.' },

  // Trading
  { slug: 'trade-board', title: 'Trade Board', category: 'Trading', description: 'List cards you have and want, negotiate in threaded chats with fairness scoring.' },
  { slug: 'trade-status-board', title: 'Trade Status Board', category: 'Trading', description: 'A community-wide view of active and recent trades and their shipping status.' },
  { slug: 'trade-threads', title: 'Trade Threads', category: 'Trading', description: 'Negotiate trades in private threaded chats with fairness scoring and trade chains.' },
  { slug: 'trade-dashboard', title: 'Trade Dashboard', category: 'Trading', description: 'Manage active trades, track shipping, and view your trade history in one place.' },
  { slug: 'trust', title: 'Trust & Reputation', category: 'Trading', description: 'Build reputation through vouches and trading feedback, your trusted-trader score.' },
  { slug: 'trade-templates', title: 'Trade Templates', category: 'Trading', description: 'Save reusable trade listing templates to quickly post common offers and wants.' },

  // Social & Community
  { slug: 'home-feed', title: 'Home Feed', category: 'Social & Community', description: 'Your personalised feed of posts, pulls, pack openings, and trending cards.' },
  { slug: 'compose', title: 'Composing Posts', category: 'Social & Community', description: 'Write posts, attach cards, add hashtags, and cross-post to Bluesky.' },
  { slug: 'post-detail', title: 'Posts & Replies', category: 'Social & Community', description: 'View posts in detail, reply, react, repost, and quote with full threading.' },
  { slug: 'hashtags', title: 'Hashtags', category: 'Social & Community', description: 'Follow hashtags to surface relevant posts in your For You feed.' },
  { slug: 'profiles', title: 'Profiles', category: 'Social & Community', description: 'Collector profiles with stats, binders, journals, trade history, and podcasts.' },
  { slug: 'journals', title: 'Journals', category: 'Social & Community', description: 'Long-form collector journal entries with markdown, cover images, and embedded cards.' },
  { slug: 'binders', title: 'Binders', category: 'Social & Community', description: 'Curate and share showcase binders with themed covers and drag-to-reorder pages.' },
  { slug: 'circles', title: 'Circles', category: 'Social & Community', description: 'Join themed collector circles for scoped trades, discussions, and meetups.' },
  { slug: 'meetups', title: 'Meetups', category: 'Social & Community', description: 'Organise or attend in-person meetups, swaps, and live pulls near you.' },
  { slug: 'pack-openings', title: 'Pack Openings', category: 'Social & Community', description: 'Share your pulls and follow collectors to see fresh pack openings in your feed.' },
  { slug: 'pack-parties', title: 'Pack Parties', category: 'Social & Community', description: 'Join synchronised pack-opening events and share reactions live.' },
  { slug: 'pull-of-the-week', title: 'Pull of the Week', category: 'Social & Community', description: "Nominate your best pull each week and vote on the community's top pulls." },
  { slug: 'weekly-digest', title: 'Weekly Digest', category: 'Social & Community', description: 'Automated weekly roundup of platform news and community highlights in your feed.' },
  { slug: 'predictions', title: 'Predictions & Polls', category: 'Social & Community', description: 'Create and vote on community sentiment polls about cards and the meta.' },
  { slug: 'notifications', title: 'Notifications', category: 'Social & Community', description: 'See likes, replies, mentions, trade matches, price alerts, and follows in one feed.' },
  { slug: 'messages', title: 'Direct Messages', category: 'Social & Community', description: 'End-to-end encrypted 1:1 direct messages. Your keys never leave your device.' },
  { slug: 'who-to-follow', title: 'Who to Follow', category: 'Social & Community', description: 'Discover collectors to follow based on your collection, trades, and interests.' },
  { slug: 'share', title: 'Share', category: 'Social & Community', description: 'Share cards, posts, and profile links inside and outside SwapPulse.' },
  { slug: 'feeds', title: 'Custom Feeds', category: 'Social & Community', description: 'Browse and pin custom feeds built by the community and the SwapPulse feed generator.' },
  { slug: 'bookmark-boards', title: 'Bookmark Boards', category: 'Social & Community', description: 'Organise saved posts, cards, and trade listings into themed bookmark boards.' },
  { slug: 'search', title: 'Search', category: 'Social & Community', description: 'Find cards, collectors, posts, trades, and journals across SwapPulse in one place.' },
  { slug: 'online-now', title: 'Online Now', category: 'Social & Community', description: 'See which collectors are online right now and start a chat or trade.' },

  // Voice & Podcasts
  { slug: 'voice-spaces', title: 'Voice Spaces', category: 'Voice & Podcasts', description: 'Go live with an external stream or host an in-platform WebRTC audio space.' },
  { slug: 'podcasts', title: 'Podcasts', category: 'Voice & Podcasts', description: 'Publish recorded spaces as podcast episodes with chapters and an RSS feed.' },

  // Challenges & Achievements
  { slug: 'challenges', title: 'Challenges & Leaderboards', category: 'Challenges & Achievements', description: 'Join community challenges, set sprints, budget decks, and pull contests.' },
  { slug: 'achievements', title: 'Achievements', category: 'Challenges & Achievements', description: 'Earn badges for collection milestones, trading, accuracy, and community contributions.' },

  // AI Assistants
  { slug: 'trade-assistant', title: 'Trade Assistant', category: 'AI Assistants', description: 'AI-powered trade suggestions and fairness analysis for your collection.' },
  { slug: 'market-watch-assistant', title: 'Market Watch Assistant', category: 'AI Assistants', description: 'AI analysis of price trends and market opportunities for tracked cards.' },
  { slug: 'collection-advisor', title: 'Collection Advisor', category: 'AI Assistants', description: 'AI advice on gaps, duplicates, and high-value trade opportunities in your collection.' },
  { slug: 'sentiment-assistant', title: 'Sentiment Assistant', category: 'AI Assistants', description: 'Conversational AI for community sentiment polls and market mood analysis.' },
  { slug: 'achievement-goal-tracker', title: 'Achievement Goal Tracker', category: 'AI Assistants', description: 'AI help setting and tracking realistic collection and achievement goals.' },
  { slug: 'networking-concierge', title: 'Networking Concierge', category: 'AI Assistants', description: 'AI introductions to collectors with shared interests and complementary collections.' },

  // Account & Settings
  { slug: 'settings', title: 'Settings', category: 'Account & Settings', description: 'Language, privacy, notifications, accessibility, AT Protocol, and account preferences.' },
  { slug: 'your-profile', title: 'Your Profile', category: 'Account & Settings', description: 'Set up your collector profile, avatar, handle, bio, and display preferences.' },
  { slug: 'account', title: 'Account & Login', category: 'Account & Settings', description: 'Passwordless login, activation, 2FA, and managing your SwapPulse account.' },
  // Platform
  { slug: 'status', title: 'System Status', category: 'Platform', description: 'Check if any SwapPulse service is down, degraded, or under maintenance.' },
  { slug: 'admin', title: 'Admin', category: 'Platform', description: 'Admin dashboard for health, metrics, services, incidents, and federation diagnostics.' },
  { slug: 'moderation', title: 'Moderation', category: 'Platform', description: 'Moderation tools for flagged posts, bot protection, trade disputes, and enforcement.' },
  { slug: 'donations', title: 'Donations', category: 'Platform', description: 'How to donate to SwapPulse by card, fees, and limitations.' },
  { slug: 'labelers', title: 'Community Labelers', category: 'Platform', description: 'Subscribe to community labelers for curated content labels and moderation signals.' },
];