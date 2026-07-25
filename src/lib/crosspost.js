import { base44 } from '@/api/base44Client';

// §7 Automated Cross-Posting - platform metadata + dispatch helpers.
// Discord webhook + Telegram bot post for real; Bluesky/Mastodon/Nostr/
// Twitter are simulated until OAuth/connector wiring is added.

export const PLATFORMS = [
  { key: 'bluesky', label: 'Bluesky', color: '#0085ff', letter: 'B', credLabel: 'App password', extraLabel: null },
  { key: 'mastodon', label: 'Mastodon', color: '#6364ff', letter: 'M', credLabel: 'OAuth token', extraLabel: 'Instance URL' },
  { key: 'nostr', label: 'Nostr', color: '#8b5cf6', letter: 'N', credLabel: 'nsec (secret key)', extraLabel: null },
  { key: 'twitter', label: 'Twitter / X', color: '#1d9bf0', letter: 'X', credLabel: 'OAuth 2.0 token', extraLabel: null },
  { key: 'discord_webhook', label: 'Discord', color: '#5865f2', letter: 'D', credLabel: 'Webhook URL', extraLabel: null },
  { key: 'telegram_bot', label: 'Telegram', color: '#229ed9', letter: 'T', credLabel: 'Bot token', extraLabel: 'Chat ID' },
];

export const CONTENT_TYPES = [
  { key: 'pack_opening', label: 'Pack Openings' },
  { key: 'journal', label: 'Journals' },
  { key: 'binder', label: 'Binders' },
  { key: 'podcast_episode', label: 'Podcasts' },
  { key: 'voice_space_live', label: 'Live Spaces' },
  { key: 'trade_listing', label: 'Trades' },
  { key: 'card_review', label: 'Reviews' },
];

export const TEMPLATES = {
  pack_opening: "🃏 Just pulled a {cardName} ({rarity}) from {setCode}! See it on SwapPulse: {url}",
  journal: "📝 New journal entry: '{title}' - {subtitle}. Read on SwapPulse: {url}",
  binder: "📖 Published a new binder: '{title}'. Browse my collection on SwapPulse: {url}",
  podcast_episode: "🎧 New podcast episode: '{title}' ({duration}). Listen on SwapPulse: {url}",
  voice_space_live: "🎙️ I'm now live on SwapPulse Voice Spaces: '{title}'. Join the conversation: {url}",
  trade_listing: "🔄 New trade listing on SwapPulse: Offering {offerCards}. See details: {url}",
  card_review: "🔎 New card review on SwapPulse: {title}. Read: {url}",
};

export const platformMeta = (k) => PLATFORMS.find((p) => p.key === k);
export const contentTypeMeta = (k) => CONTENT_TYPES.find((c) => c.key === k);

export function dispatchCrossPost(contentType, contentId, { url = '', authorName = '', authorHandle = '' } = {}) {
  return base44.functions.invoke('crossPostDispatcher', { contentType, contentId, url, authorName, authorHandle }).catch(() => {});
}

export function testCrossPost(configId) {
  return base44.functions.invoke('crossPostDispatcher', { test: true, configId }).catch(() => {});
}