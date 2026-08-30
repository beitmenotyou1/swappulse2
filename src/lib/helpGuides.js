import {
  Compass, Layers, Library, Award, BarChart3, CreditCard, ArrowLeftRight,
  LayoutDashboard, ShieldCheck, Home as HomeIcon, PenLine, MessageSquare,
  Hash, User, BookOpen, Users, CalendarDays, Package, PartyPopper, Trophy,
  Vote, Bell, Mail, UserPlus, Share2, Radio, Mic, Target, Medal, Sparkles,
  Settings, LogIn, Activity, ShieldAlert, Gavel, Heart,
  Rss, Bookmark, Tags, Search, Copy, UserCheck,
  Wallet, Fingerprint, Camera, Coins, Layers as LayersIcon,
} from 'lucide-react';

export const HELP_CATEGORIES = [
  'Collection & Catalogue',
  'Trading',
  'Social & Community',
  'Voice & Podcasts',
  'Challenges & Achievements',
  'AI Assistants',
  'Account & Settings',
  'Wallet & On-Chain',
  'Platform',
];

export const HELP_GUIDES = [
  // Collection & Catalogue
  { slug: 'explore', title: 'Explore', category: 'Collection & Catalogue', icon: Compass, description: 'Browse the full Pokémon TCG catalogue by set, rarity, or illustrator.', relatedRoute: '/explore' },
  { slug: 'card-detail', title: 'Card Detail Pages', category: 'Collection & Catalogue', icon: CreditCard, description: 'Every card is a social hub with stats, posts, trades, and pack openings.', relatedRoute: '/card' },
  { slug: 'sets', title: 'Sets & Checklists', category: 'Collection & Catalogue', icon: Library, description: 'Browse sets, download checklists, track completion, and find set buddies.', relatedRoute: '/sets' },
  { slug: 'collection', title: 'Collection', category: 'Collection & Catalogue', icon: Layers, description: 'Track every card you own with portfolio value, duplicates, and insurance exports.', relatedRoute: '/collection' },
  { slug: 'grading', title: 'Grading', category: 'Collection & Catalogue', icon: Award, description: 'Prepare grading submissions and review condition reports for your cards.', relatedRoute: '/grading' },
  { slug: 'market-watch', title: 'Market Watch', category: 'Collection & Catalogue', icon: BarChart3, description: 'Track card prices, set alerts, and watch market trends over time.', relatedRoute: '/market' },

  // Trading
  { slug: 'trade-board', title: 'Trade Board', category: 'Trading', icon: ArrowLeftRight, description: 'List cards you have and want, negotiate in threaded chats with fairness scoring.', relatedRoute: '/trades' },
  { slug: 'trade-status-board', title: 'Trade Status Board', category: 'Trading', icon: LayoutDashboard, description: 'A community-wide view of active and recent trades and their shipping status.', relatedRoute: '/trade-board' },
  { slug: 'trade-threads', title: 'Trade Threads', category: 'Trading', icon: MessageSquare, description: 'Negotiate trades in private threaded chats with fairness scoring and trade chains.', relatedRoute: '/trade' },
  { slug: 'trade-dashboard', title: 'Trade Dashboard', category: 'Trading', icon: LayoutDashboard, description: 'Manage active trades, track shipping, and view your trade history in one place.', relatedRoute: '/trade-dashboard' },
  { slug: 'trust', title: 'Trust & Reputation', category: 'Trading', icon: ShieldCheck, description: 'Build reputation through vouches and trading feedback, your trusted-trader score.', relatedRoute: '/trust' },
  { slug: 'trade-templates', title: 'Trade Templates', category: 'Trading', icon: Copy, description: 'Save reusable trade listing templates to quickly post common offers and wants.', relatedRoute: '/trade-templates' },

  // Social & Community
  { slug: 'home-feed', title: 'Home Feed', category: 'Social & Community', icon: HomeIcon, description: 'Your personalised feed of posts, pulls, pack openings, and trending cards.', relatedRoute: '/' },
  { slug: 'compose', title: 'Composing Posts', category: 'Social & Community', icon: PenLine, description: 'Write posts, attach cards, add hashtags, and cross-post to Bluesky.', relatedRoute: '/compose' },
  { slug: 'post-detail', title: 'Posts & Replies', category: 'Social & Community', icon: MessageSquare, description: 'View posts in detail, reply, react, repost, and quote with full threading.', relatedRoute: '/post' },
  { slug: 'hashtags', title: 'Hashtags', category: 'Social & Community', icon: Hash, description: 'Follow hashtags to surface relevant posts in your For You feed.', relatedRoute: '/hashtag' },
  { slug: 'profiles', title: 'Profiles', category: 'Social & Community', icon: User, description: 'Collector profiles with stats, binders, journals, trade history, and podcasts.', relatedRoute: '/profile' },
  { slug: 'journals', title: 'Journals', category: 'Social & Community', icon: BookOpen, description: 'Long-form collector journal entries with markdown, cover images, and embedded cards.', relatedRoute: '/journal' },
  { slug: 'binders', title: 'Binders', category: 'Social & Community', icon: BookOpen, description: 'Curate and share showcase binders with themed covers and drag-to-reorder pages.', relatedRoute: '/binders' },
  { slug: 'circles', title: 'Circles', category: 'Social & Community', icon: Users, description: 'Join themed collector circles for scoped trades, discussions, and meetups.', relatedRoute: '/circles' },
  { slug: 'starter-packs', title: 'Starter Packs', category: 'Social & Community', icon: Package, description: 'Curated onboarding bundles of collectors, circles, and feeds. Members must accept inclusion.', relatedRoute: '/starter-packs' },
  { slug: 'meetups', title: 'Meetups', category: 'Social & Community', icon: CalendarDays, description: 'Organise or attend in-person meetups, swaps, and live pulls near you.', relatedRoute: '/meetups' },
  { slug: 'pack-openings', title: 'Pack Openings', category: 'Social & Community', icon: Package, description: 'Share your pulls and follow collectors to see fresh pack openings in your feed.', relatedRoute: '/packs' },
  { slug: 'pack-parties', title: 'Pack Parties', category: 'Social & Community', icon: PartyPopper, description: 'Join synchronised pack-opening events and share reactions live.', relatedRoute: '/pack-parties' },
  { slug: 'pull-of-the-week', title: 'Pull of the Week', category: 'Social & Community', icon: Trophy, description: 'Nominate your best pull each week and vote on the community\'s top pulls.', relatedRoute: '/pull-of-the-week' },
  { slug: 'weekly-digest', title: 'Weekly Digest', category: 'Social & Community', icon: CalendarDays, description: 'Automated weekly roundup of platform news and community highlights in your feed.', relatedRoute: '/' },
  { slug: 'predictions', title: 'Predictions & Polls', category: 'Social & Community', icon: Vote, description: 'Create and vote on community sentiment polls about cards and the meta.', relatedRoute: '/predictions' },
  { slug: 'notifications', title: 'Notifications', category: 'Social & Community', icon: Bell, description: 'See likes, replies, mentions, trade matches, price alerts, and follows in one feed.', relatedRoute: '/notifications' },
  { slug: 'messages', title: 'Direct Messages', category: 'Social & Community', icon: Mail, description: 'End-to-end encrypted 1:1 direct messages. Your keys never leave your device.', relatedRoute: '/messages' },
  { slug: 'who-to-follow', title: 'Who to Follow', category: 'Social & Community', icon: UserPlus, description: 'Discover collectors to follow based on your collection, trades, and interests.', relatedRoute: '/who-to-follow' },
  { slug: 'share', title: 'Share', category: 'Social & Community', icon: Share2, description: 'Share cards, posts, and profile links inside and outside SwapPulse.', relatedRoute: '/share' },
  { slug: 'feeds', title: 'Custom Feeds', category: 'Social & Community', icon: Rss, description: 'Browse and pin custom feeds built by the community and the SwapPulse feed generator.', relatedRoute: '/feeds' },
  { slug: 'bookmark-boards', title: 'Bookmark Boards', category: 'Social & Community', icon: Bookmark, description: 'Organise saved posts, cards, and trade listings into themed bookmark boards.', relatedRoute: '/boards' },
  { slug: 'search', title: 'Search', category: 'Social & Community', icon: Search, description: 'Find cards, collectors, posts, trades, and journals across SwapPulse in one place.', relatedRoute: '/search' },
  { slug: 'online-now', title: 'Online Now', category: 'Social & Community', icon: UserCheck, description: 'See which collectors are online right now and start a chat or trade.', relatedRoute: '/online-now' },

  // Voice & Podcasts
  { slug: 'voice-spaces', title: 'Voice Spaces', category: 'Voice & Podcasts', icon: Radio, description: 'Go live with an external stream or host an in-platform WebRTC audio space.', relatedRoute: '/spaces' },
  { slug: 'podcasts', title: 'Podcasts', category: 'Voice & Podcasts', icon: Mic, description: 'Publish recorded spaces as podcast episodes with chapters and an RSS feed.', relatedRoute: '/spaces' },

  // Challenges & Achievements
  { slug: 'challenges', title: 'Challenges & Leaderboards', category: 'Challenges & Achievements', icon: Target, description: 'Join community challenges, set sprints, budget decks, and pull contests.', relatedRoute: '/challenges' },
  { slug: 'achievements', title: 'Achievements', category: 'Challenges & Achievements', icon: Medal, description: 'Earn badges for collection milestones, trading, accuracy, and community contributions.', relatedRoute: '/achievements' },

  // AI Assistants
  { slug: 'trade-assistant', title: 'Trade Assistant', category: 'AI Assistants', icon: Sparkles, description: 'AI-powered trade suggestions and fairness analysis for your collection.', relatedRoute: '/trade-assistant' },
  { slug: 'market-watch-assistant', title: 'Market Watch Assistant', category: 'AI Assistants', icon: Sparkles, description: 'AI analysis of price trends and market opportunities for tracked cards.', relatedRoute: '/market-watch-assistant' },
  { slug: 'collection-advisor', title: 'Collection Advisor', category: 'AI Assistants', icon: Sparkles, description: 'AI advice on gaps, duplicates, and high-value trade opportunities in your collection.', relatedRoute: '/collection-advisor' },
  { slug: 'sentiment-assistant', title: 'Sentiment Assistant', category: 'AI Assistants', icon: Sparkles, description: 'Conversational AI for community sentiment polls and market mood analysis.', relatedRoute: '/sentiment-conversationalist' },
  { slug: 'achievement-goal-tracker', title: 'Achievement Goal Tracker', category: 'AI Assistants', icon: Sparkles, description: 'AI help setting and tracking realistic collection and achievement goals.', relatedRoute: '/achievement-goal-tracker' },
  { slug: 'networking-concierge', title: 'Networking Concierge', category: 'AI Assistants', icon: Sparkles, description: 'AI introductions to collectors with shared interests and complementary collections.', relatedRoute: '/networking-concierge' },

  // Account & Settings
  { slug: 'settings', title: 'Settings', category: 'Account & Settings', icon: Settings, description: 'Language, privacy, notifications, accessibility, AT Protocol, and account preferences.', relatedRoute: '/settings' },
  { slug: 'your-profile', title: 'Your Profile', category: 'Account & Settings', icon: User, description: 'Set up your collector profile, avatar, handle, bio, and display preferences.', relatedRoute: '/profile' },
  { slug: 'account', title: 'Account & Login', category: 'Account & Settings', icon: LogIn, description: 'Passwordless login, activation, 2FA, and managing your SwapPulse account.', relatedRoute: '/login' },
  // Wallet & On-Chain
  { slug: 'wallet', title: 'Wallet & Identity', category: 'Wallet & On-Chain', icon: Wallet, description: 'Your self-custodial collector account: identity, attestations, anchored cards, and stake.', relatedRoute: '/wallet' },
  { slug: 'chain-identity', title: 'On-Chain Identity', category: 'Wallet & On-Chain', icon: Fingerprint, description: 'Create a smart account whose private key never leaves your own device.', relatedRoute: '/wallet' },
  { slug: 'card-attestations', title: 'Card Possession Attestations', category: 'Wallet & On-Chain', icon: Camera, description: 'Photograph your cards to prove you physically hold them, across four trust levels.', relatedRoute: '/wallet' },
  { slug: 'staking', title: 'Network Staking', category: 'Wallet & On-Chain', icon: Coins, description: 'Delegate or run a validator to secure the zero-fee SwapPulse network.', relatedRoute: '/wallet' },
  { slug: 'on-chain-cards', title: 'On-Chain Cards & Cross-Chain', category: 'Wallet & On-Chain', icon: LayersIcon, description: 'Anchor verified cards on the network and move assets to other chains.', relatedRoute: '/wallet' },

  // Platform
  { slug: 'status', title: 'System Status', category: 'Platform', icon: Activity, description: 'Check if any SwapPulse service is down, degraded, or under maintenance.', relatedRoute: '/status' },
  { slug: 'admin', title: 'Admin', category: 'Platform', icon: Gavel, description: 'Admin dashboard for health, metrics, services, incidents, and federation diagnostics.', relatedRoute: '/admin' },
  { slug: 'moderation', title: 'Moderation', category: 'Platform', icon: ShieldAlert, description: 'Moderation tools for flagged posts, bot protection, trade disputes, and enforcement.', relatedRoute: '/moderation' },
  { slug: 'donations', title: 'Donations', category: 'Platform', icon: Heart, description: 'How to donate to SwapPulse by card, fees, and limitations.', relatedRoute: '/donate' },
  { slug: 'labelers', title: 'Community Labelers', category: 'Platform', icon: Tags, description: 'Subscribe to community labelers for curated content labels and moderation signals.', relatedRoute: '/labelers' },
];

export function getGuideBySlug(slug) {
  return HELP_GUIDES.find((g) => g.slug === slug);
}

export function getGuidesByCategory(category) {
  return HELP_GUIDES.filter((g) => g.category === category);
}