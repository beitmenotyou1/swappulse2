import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Heart, MessageSquare,
  ChevronDown, FlaskConical, Search, Activity, Wrench, Code, ShieldAlert,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import useSEO from '@/hooks/useSEO';
import { HELP_GUIDES, HELP_CATEGORIES } from '@/lib/helpGuides';
import { useT } from '@/lib/i18n/I18nProvider';

const FAQ = [
  {
    q: 'What does "alpha" mean?',
    a: 'SwapPulse is actively being built. Features may change, move, or be removed as we learn what collectors want. Your data and collection are safe, but expect things to evolve. Use the Feedback button to tell us what you think.',
  },
  {
    q: 'Is SwapPulse really free?',
    a: 'Yes. Every feature is free and the project is open-source. Donations are optional and help cover hosting, the TCGDex catalogue, and AT Protocol infrastructure.',
  },
  {
    q: 'Who owns my collection data?',
    a: 'You do. SwapPulse is built on self-sovereign principles, records are signed to your AT Protocol DID and designed to be portable to your own data server in future.',
  },
  {
    q: 'How does trading work?',
    a: 'Post a trade listing with what you have and what you want. Interested collectors open a trade thread to negotiate. The fairness calculator helps both sides agree on a fair swap. Multi-party trade chains let 3–5 collectors ship cards in sequence.',
  },
  {
    q: 'How do voice spaces work?',
    a: 'There are two modes. External mode: paste a stream URL (Twitch, YouTube, Kick, etc.) to go live, your profile shows a red live ring and followers get notified. In-platform mode: host a true audio stage where participants hear each other via a WebRTC peer mesh, no external stream needed. Hosts can promote speakers, mute, and record. Recordings can be published as podcast episodes.',
  },
  {
    q: 'How do podcasts and the RSS feed work?',
    a: 'When a host records an in-platform voice space, they can save it as a podcast episode with a title, description, chapters, and show notes. Each host gets a public RSS feed URL that can be submitted to Apple Podcasts, Spotify, or any podcast app. Find your feed link on your profile\'s Podcasts tab.',
  },
  {
    q: 'How do direct messages work?',
    a: 'Direct messages are end-to-end encrypted (E2EE). When you first use DMs, your browser generates an encryption key pair, your private key never leaves your device (it lives in IndexedDB). Messages are encrypted before sending; only you and your recipient can read them. SwapPulse cannot read your messages. Note: clearing your browser data will remove your private key and you\'ll lose access to encrypted messages on that device.',
  },
  {
    q: 'How do stories work?',
    a: 'Stories are ephemeral posts (photos, videos, or text) that expire after 24 hours. Post a story from the stories bar at the top of the home feed. The seen/unseen ring clears only after you\'ve watched the full story. Stories are mirrored to your PDS but filtered from feeds after 24 hours.',
  },
  {
    q: 'How do challenges and achievements work?',
    a: 'Challenges are community goals, set sprints, budget decks, pull contests, and collective targets. Join a challenge and submit entries to contribute. Achievements are badges earned for collection milestones, trading, accuracy (scanner corrections), and community contributions. Each achievement is backed by an immutable proof snapshot so it\'s verifiable.',
  },
  {
    q: 'How do pack parties work?',
    a: 'A pack party is a synchronised pack-opening event. The host picks a set and a time; participants join and open packs of that set at the same time, sharing reactions in real time. It\'s a virtual pack-opening night with friends.',
  },
  {
    q: 'What is Pull of the Week?',
    a: 'Each week, collectors nominate their best card pull. The community votes on the nominations, and the winner gets bragging rights. Nominate from the Pull of the Week page and vote on others\' pulls.',
  },
  {
    q: 'How do AI assistants work?',
    a: 'SwapPulse has several AI assistants, Trade, Market Watch, Collection Advisor, Sentiment, Achievement Goal Tracker, and Networking Concierge. Each analyses your data (collection, trades, market) to generate suggestions. Their outputs are advisory, not professional advice, always use your own judgement for trading decisions.',
  },
  {
    q: 'How does the card scanner work?',
    a: 'Take a photo of a card and the AI scanner identifies it from the TCGDex catalogue, showing the top matches with confidence scores. If the top result is wrong, tap the correct card or search manually, your correction is recorded and used to improve future scans. Corrections work offline too: they queue locally and sync when you reconnect.',
  },
  {
    q: 'How do I cross-post to Bluesky?',
    a: 'SwapPulse is built on the AT Protocol, so your posts, trades, and follows are automatically mirrored to your PDS and visible on Bluesky. You can optionally configure cross-posting in Settings. Your AT Protocol identity (DID and handle) is portable, you\'re not locked in.',
  },
  {
    q: 'How do I change the language?',
    a: 'Tap the globe icon in the navigation bar (desktop sidebar or mobile More menu) and pick your language. The entire interface, navigation, buttons, page headings, and all card names, set names, and flavour text switch instantly. Your choice is saved to your account and persists across sessions. SwapPulse supports English, Français, Deutsch, Español, Italiano, Português, 日本語, 中文, and 한국어.',
  },
  {
    q: 'How do social card pages work?',
    a: 'Every card page (e.g. /card/pikachu) is a social hub. Below the card stats, you\'ll find tabs for Posts, Trades, and Pack Openings, each showing community content about that specific card, merged from local SwapPulse posts and federated Bluesky posts that reference the card. It\'s a card-first way to discover what collectors are saying, trading, and pulling.',
  },
  {
    q: 'What are Trending Cards?',
    a: 'The Trending Cards rail on the home feed shows the cards with the most recent social activity, posts, discussions, and mentions. It\'s ranked by how much the community is talking about each card right now. Tap any card to jump to its social detail page.',
  },
  {
    q: 'How do card embeds work in posts?',
    a: 'When you compose a post and attach a card, the post is mirrored to the AT Protocol with an external embed containing the card\'s image, localized name, and a link to the SwapPulse card page. On Bluesky, the embed renders as a rich card preview; on SwapPulse, the card renders inline. Clicking the embed on Bluesky deep-links to the SwapPulse card page.',
  },
  {
    q: 'How do I verify a custom domain handle?',
    a: 'Go to Settings → Account, claim your domain, and add the DNS TXT record shown. Once verified, your handle becomes @yourdomain.com with an elevated trust badge.',
  },
  {
    q: 'How do push notifications work?',
    a: 'Enable push in Settings → Notifications or the push toggle on your profile. SwapPulse uses web push (VAPID), no app install required on desktop or mobile browser. You can set quiet hours and per-event-type preferences.',
  },
  {
    q: 'What are Circles?',
    a: 'Circles are themed collector groups, vintage, competitive, shiny, regional, and more. Join a circle to see scoped trade listings, discussions, and meetups. You can be in multiple circles.',
  },
  {
    q: 'What are Starter Packs?',
    a: 'A Starter Pack is a curated onboarding bundle of collectors, circles, and feeds for a specific niche. When you add a collector, they get an inclusion request and must accept before appearing in the pack. Newcomers can follow everyone in a pack in one tap. You can create up to 5 packs with up to 100 members each. Prefer to skip the request step? Enable "Auto-accept starter pack requests" in Settings → Notifications.',
  },
  {
    q: 'How do I get help if something is broken?',
    a: 'Tap the Feedback button on the right edge of the screen, it captures a snapshot of the page and sends your comment straight to the team. You can also check the System Status page to see if a service is down.',
  },
];

const TROUBLESHOOTING = [
  {
    q: 'The scanner can\'t identify my card',
    a: 'Make sure you\'re in good lighting with the card filling the frame and minimal glare. If the top match is wrong, tap the correct card from the candidates list or search manually. Your correction is recorded and helps the model learn.',
  },
  {
    q: 'My direct messages show as encrypted / won\'t decrypt',
    a: 'E2EE direct messages require your private key, which lives in your browser\'s IndexedDB. If you\'re on a new browser, cleared your data, or switched devices, you won\'t be able to read existing encrypted messages there. New conversations will work, your browser generates a fresh key pair. There is no recovery for lost keys by design.',
  },
  {
    q: 'My story won\'t post',
    a: 'Stories require a photo, video, or text. Make sure your media has finished uploading (watch the progress bar). If you\'re on a slow connection, try again, large videos may take a moment. Stories expire after 24 hours, so if an old one is stuck, it may have already expired.',
  },
  {
    q: 'I can\'t connect to an in-platform voice space',
    a: 'In-platform spaces use a WebRTC peer mesh. If you can\'t hear others, check your browser\'s microphone permissions and try leaving and rejoining the space. Some networks (corporate Wi-Fi, symmetric NATs) block WebRTC connections; try a different network if available. External-stream spaces don\'t require WebRTC, they just open the stream URL.',
  },
  {
    q: 'My podcast RSS feed link doesn\'t work',
    a: 'Your RSS feed is at /api/functions/podcast-rss-feed?did=<yourDID>. Make sure you have at least one published episode, the feed returns 404 if there are no episodes for your DID. Copy the link from your profile\'s Podcasts tab to get the exact URL with your DID. Podcast apps may take a few hours to index a newly submitted feed.',
  },
  {
    q: 'My collection isn\'t syncing',
    a: 'Check your internet connection. Collection entries are stored locally and sync automatically when you reconnect. If items are stuck, try pulling to refresh on the Collection page. If the issue persists, check the System Status page to see if the database is down.',
  },
  {
    q: 'I\'m not getting push notifications',
    a: 'Make sure push is enabled in Settings → Notifications and your browser allows notifications for swappulse.org. Check that the event type (trade matches, price alerts, etc.) is toggled on. Quiet hours may be pausing non-critical alerts, check your quiet hours settings.',
  },
  {
    q: 'A collector I added to my starter pack isn\'t showing up',
    a: 'Adding a collector sends them an inclusion request, they don\'t appear in the pack until they accept. Check the "Pending requests" section on your pack\'s detail page to see who hasn\'t responded yet. If they have auto-accept enabled, they\'ll be promoted immediately with no pending step. You can\'t force someone into a pack, consent is required by design.',
  },
  {
    q: 'A trade listing disappeared',
    a: 'Listings expire after 90 days by default. Check if the listing has passed its expiry date. Circle-scoped listings are only visible to members of that circle. The listing may also have been cancelled by the author.',
  },
  {
    q: 'My email didn\'t arrive',
    a: 'Check your spam folder. SwapPulse sends from swappulse.org via Proton Mail. If you\'re using a custom domain alias, make sure your email provider accepts it. Activation links expire after 48 hours, request a new one from the login page.',
  },
];

const LEXICONS = [
  { nsid: 'org.swappulse.collectionEntry', label: 'Collection Entry' },
  { nsid: 'org.swappulse.binder', label: 'Binder' },
  { nsid: 'org.swappulse.tradeListing', label: 'Trade Listing' },
  { nsid: 'org.swappulse.tradeChain', label: 'Trade Chain' },
  { nsid: 'org.swappulse.tradeDispute', label: 'Trade Dispute' },
  { nsid: 'org.swappulse.vouch', label: 'Vouch' },
  { nsid: 'org.swappulse.tradingFeedback', label: 'Trading Feedback' },
  { nsid: 'org.swappulse.wishlist', label: 'Wishlist' },
  { nsid: 'org.swappulse.reaction', label: 'Reaction' },
  { nsid: 'org.swappulse.journal', label: 'Journal' },
  { nsid: 'org.swappulse.story', label: 'Story' },
  { nsid: 'org.swappulse.cardReview', label: 'Card Review' },
  { nsid: 'org.swappulse.voiceSpace', label: 'Voice Space' },
  { nsid: 'org.swappulse.spaceSignal', label: 'Space Signal' },
  { nsid: 'org.swappulse.podcastEpisode', label: 'Podcast Episode' },
  { nsid: 'org.swappulse.conversation', label: 'Conversation' },
  { nsid: 'org.swappulse.directMessage', label: 'Direct Message' },
  { nsid: 'org.swappulse.meetup', label: 'Meetup' },
  { nsid: 'org.swappulse.meetupRsvp', label: 'Meetup RSVP' },
  { nsid: 'org.swappulse.circle', label: 'Circle' },
  { nsid: 'org.swappulse.challenge', label: 'Challenge' },
  { nsid: 'org.swappulse.challengeEntry', label: 'Challenge Entry' },
  { nsid: 'org.swappulse.packParty', label: 'Pack Party' },
  { nsid: 'org.swappulse.pullNomination', label: 'Pull Nomination' },
  { nsid: 'org.swappulse.starterPack', label: 'Starter Pack' },
  { nsid: 'org.swappulse.starterPackRequest', label: 'Starter Pack Request' },
];

const CATEGORY_TKEYS = {
  'Collection & Catalogue': 'help.category.collection',
  'Trading': 'help.category.trading',
  'Social & Community': 'help.category.social',
  'Voice & Podcasts': 'help.category.voice',
  'Challenges & Achievements': 'help.category.challenges',
  'AI Assistants': 'help.category.aiAssistants',
  'Account & Settings': 'help.category.account',
  'Platform': 'help.category.platform',
};

export default function Help() {
  const t = useT();
  useSEO({
    title: 'Help & FAQ',
    description: 'Learn how SwapPulse works, scanning, trading, voice spaces, podcasts, direct messages, circles, challenges, and more.',
    canonicalPath: '/help',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      name: 'SwapPulse Help & FAQ',
      description: 'Learn how SwapPulse works, scanning, trading, voice spaces, podcasts, direct messages, circles, challenges, and more.',
      url: 'https://swappulse.org/help',
    },
  });
  const [query, setQuery] = useState('');

  const filteredGuides = useMemo(() => {
    if (!query.trim()) return HELP_GUIDES;
    const q = query.toLowerCase();
    return HELP_GUIDES.filter((g) => g.title.toLowerCase().includes(q) || g.description.toLowerCase().includes(q));
  }, [query]);

  const guidesByCategory = useMemo(() => {
    const map = {};
    HELP_CATEGORIES.forEach((c) => { map[c] = []; });
    filteredGuides.forEach((g) => {
      if (map[g.category]) map[g.category].push(g);
    });
    return map;
  }, [filteredGuides]);

  const filteredFaq = useMemo(() => {
    if (!query.trim()) return FAQ;
    const q = query.toLowerCase();
    return FAQ.filter((item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q));
  }, [query]);

  const filteredTroubleshooting = useMemo(() => {
    if (!query.trim()) return TROUBLESHOOTING;
    const q = query.toLowerCase();
    return TROUBLESHOOTING.filter((item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q));
  }, [query]);

  const filteredLexicons = useMemo(() => {
    if (!query.trim()) return LEXICONS;
    const q = query.toLowerCase();
    return LEXICONS.filter((l) => l.nsid.toLowerCase().includes(q) || l.label.toLowerCase().includes(q));
  }, [query]);

  const hasResults = filteredGuides.length > 0 || filteredFaq.length > 0 || filteredTroubleshooting.length > 0;

  return (
    <div>
      <PageHeader title={t('page.help.title')} subtitle={t('page.help.subtitle')} />

      <div className="space-y-6 p-4">
        {/* Alpha */}
        <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4">
          <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div className="text-sm">
            <p className="font-bold">{t('help.alpha')}</p>
            <p className="text-muted-foreground">{t('help.alphaDesc')}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('help.searchPlaceholder')}
            className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:border-primary"
           aria-label={t('help.searchPlaceholder')}/>
        </div>

        {/* Status link */}
        <Link
          to="/status"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-secondary/50"
        >
          <Activity className="h-5 w-5 shrink-0 text-success" />
          <div className="flex-1">
            <p className="text-sm font-bold">{t('help.systemStatus')}</p>
            <p className="text-xs text-muted-foreground">{t('help.systemStatusDesc')}</p>
          </div>
          <ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground" />
        </Link>

        {/* About */}
        {!query && (
          <section>
            <h2 className="mb-2 text-lg font-extrabold">{t('help.about')}</h2>
            <p className="text-sm text-muted-foreground">{t('help.aboutText')}</p>
          </section>
        )}

        {/* Guides directory */}
        {filteredGuides.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-extrabold">{t('help.guides')}</h2>
            </div>
            <div className="space-y-5">
              {HELP_CATEGORIES.map((category) => {
                const guides = guidesByCategory[category];
                if (!guides || guides.length === 0) return null;
                return (
                  <div key={category}>
                    <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{t(CATEGORY_TKEYS[category] || category)}</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {guides.map((g) => (
                        <Link
                          key={g.slug}
                          to={`/help/${g.slug}`}
                          className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-secondary/50"
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                            <g.icon className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="text-sm font-bold">{g.title}</p>
                            <p className="text-xs text-muted-foreground">{g.description}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* FAQ */}
        {filteredFaq.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-extrabold">{t('help.faq')}</h2>
            <div className="space-y-2">
              {filteredFaq.map((item) => (
                <details key={item.q} className="group rounded-xl border border-border bg-card p-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold">
                    {item.q}
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Troubleshooting */}
        {filteredTroubleshooting.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-extrabold">{t('help.troubleshooting')}</h2>
            </div>
            <div className="space-y-2">
              {filteredTroubleshooting.map((item) => (
                <details key={item.q} className="group rounded-xl border border-border bg-card p-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold">
                    {item.q}
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Lexicon Reference */}
        {filteredLexicons.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-extrabold">{t('help.lexiconRef')}</h2>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              {t('help.lexiconDesc').replace('{n}', LEXICONS.length)}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredLexicons.map((l) => (
                <div key={l.nsid} className="rounded-lg border border-border bg-card p-2.5">
                  <p className="font-mono text-xs font-semibold text-primary">{l.nsid}</p>
                  <p className="text-xs text-muted-foreground">{l.label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* No results */}
        {!hasResults && query && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-bold">{t('help.noResults').replace('{query}', query)}</p>
            <p className="text-xs text-muted-foreground">{t('help.noResultsDesc')}</p>
          </div>
        )}

        {/* Support / donate / feedback */}
        {!query && (
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                <h3 className="font-bold">{t('help.support')}</h3>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">{t('help.supportDesc')}</p>
              <Link to="/donate" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
                <Heart className="h-4 w-4 fill-current" /> {t('help.donate')}
              </Link>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h3 className="font-bold">{t('help.sendFeedback')}</h3>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                {t('help.feedbackDesc')} Or email <a href="mailto:feedback@swappulse.org" className="text-primary underline">feedback@swappulse.org</a>.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}