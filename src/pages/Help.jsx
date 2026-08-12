import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Compass, Layers, BookOpen, ArrowLeftRight, Users, CalendarDays, Radio, Package,
  BarChart3, Vote, Award, ShieldCheck, Settings as SettingsIcon, Heart, MessageSquare,
  ChevronDown, FlaskConical, ScanLine, Search, Activity, Wrench, Code, ShieldAlert,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const FEATURES = [
  { to: '/explore', icon: Compass, label: 'Explore', desc: 'Browse the full Pokémon TCG catalog via TCGdex, by set, rarity, or illustrator.' },
  { to: '/scan', icon: ScanLine, label: 'Scan Cards', desc: 'Photograph a card and the AI scanner identifies it — confirm or correct the match to help the model learn.' },
  { to: '/collection', icon: Layers, label: 'Collection', desc: 'Track every card you own, with portfolio value, set completion, duplicates, and insurance exports.' },
  { to: '/binders', icon: BookOpen, label: 'Binders', desc: 'Curate and share showcase binders - 3×3 or 9×9 grids, drag-to-reorder.' },
  { to: '/trades', icon: ArrowLeftRight, label: 'Trade Board', desc: 'List cards you have and want, negotiate in threaded trade chats with fairness scoring.' },
  { to: '/circles', icon: Users, label: 'Circles', desc: 'Join themed collector circles - vintage, competitive, shiny, regional, and more.' },
  { to: '/meetups', icon: CalendarDays, label: 'Meetups', desc: 'Organise or attend in-person meetups, swaps, and live pulls near you.' },
  { to: '/spaces', icon: Radio, label: 'Live Voice Spaces', desc: 'Go live from any platform (Twitch, YouTube, Kick) and broadcast to your followers.' },
  { to: '/packs', icon: Package, label: 'Pack Openings', desc: 'Share your pulls and follow collectors to see fresh pack openings in your feed.' },
  { to: '/market', icon: BarChart3, label: 'Market Watch', desc: 'Track card prices, set price alerts, and watch market trends over time.' },
  { to: '/predictions', icon: Vote, label: 'Predictions', desc: 'Create and vote on community sentiment polls about cards and the meta.' },
  { to: '/grading', icon: Award, label: 'Grading', desc: 'Prepare grading submissions and review condition reports for your cards.' },
  { to: '/trust', icon: ShieldCheck, label: 'Trust', desc: 'Build reputation through vouches and trading feedback - your trusted-trader score.' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings', desc: 'Language, privacy, notifications, accessibility, and account preferences.' },
];

const FAQ = [
  {
    q: 'What does "alpha" mean?',
    a: 'SwapPulse is actively being built. Features may change, move, or be removed as we learn what collectors want. Your data and collection are safe, but expect things to evolve. Use the Feedback button to tell us what you think.',
  },
  {
    q: 'Is SwapPulse really free?',
    a: 'Yes. Every feature is free and the project is open-source. Donations are optional and help cover hosting, the TCGdex catalog, and AT Protocol infrastructure.',
  },
  {
    q: 'Who owns my collection data?',
    a: 'You do. SwapPulse is built on self-sovereign principles — records are signed to your AT Protocol DID and designed to be portable to your own data server in future.',
  },
  {
    q: 'How does trading work?',
    a: 'Post a trade listing with what you have and what you want. Interested collectors open a trade thread to negotiate. The fairness calculator helps both sides agree on a fair swap.',
  },
  {
    q: 'How do voice spaces work?',
    a: 'Paste an external stream URL (Twitch, YouTube, Kick, etc.) to go live. Your profile shows a red live ring and your followers get notified. Recordings can be published as podcast episodes.',
  },
  {
    q: 'How does the card scanner work?',
    a: 'Take a photo of a card and the AI scanner identifies it from the TCGdex catalog, showing the top 5 matches with confidence scores. If the top result is wrong, tap the correct card or search manually — your correction is recorded and used to improve future scans. Corrections work offline too: they queue locally and sync when you reconnect.',
  },
  {
    q: 'How do I verify a custom domain handle?',
    a: 'Go to Settings → Account, claim your domain, and add the DNS TXT record shown. Once verified, your handle becomes @yourdomain.com with an elevated trust badge.',
  },
  {
    q: 'How do push notifications work?',
    a: 'Enable push in Settings → Notifications or the push toggle on your profile. SwapPulse uses web push (VAPID) — no app install required on desktop or mobile browser. You can set quiet hours and per-event-type preferences.',
  },
  {
    q: 'What are Circles?',
    a: 'Circles are themed collector groups — vintage, competitive, shiny, regional, and more. Join a circle to see scoped trade listings, discussions, and meetups. You can be in multiple circles.',
  },
  {
    q: 'How do I get help if something is broken?',
    a: 'Tap the Feedback button on the right edge of the screen — it captures a snapshot of the page and sends your comment straight to the team. You can also check the System Status page to see if a service is down.',
  },
];

const TROUBLESHOOTING = [
  {
    q: 'The scanner can\'t identify my card',
    a: 'Make sure you\'re in good lighting with the card filling the frame and minimal glare. If the top match is wrong, tap the correct card from the candidates list or search manually. Your correction is recorded and helps the model learn.',
  },
  {
    q: 'My collection isn\'t syncing',
    a: 'Check your internet connection. Collection entries are stored locally and sync automatically when you reconnect. If items are stuck, try pulling to refresh on the Collection page. If the issue persists, check the System Status page to see if the database is down.',
  },
  {
    q: 'I\'m not getting push notifications',
    a: 'Make sure push is enabled in Settings → Notifications and your browser allows notifications for swappulse.org. Check that the event type (trade matches, price alerts, etc.) is toggled on. Quiet hours may be pausing non-critical alerts — check your quiet hours settings.',
  },
  {
    q: 'A trade listing disappeared',
    a: 'Listings expire after 90 days by default. Check if the listing has passed its expiry date. Circle-scoped listings are only visible to members of that circle. The listing may also have been cancelled by the author.',
  },
  {
    q: 'My email didn\'t arrive',
    a: 'Check your spam folder. SwapPulse sends from swappulse.org via Proton Mail. If you\'re using a custom domain alias, make sure your email provider accepts it. Activation links expire after 48 hours — request a new one from the login page.',
  },
];

const LEXICONS = [
  { nsid: 'org.swappulse.collectionEntry', label: 'Collection Entry' },
  { nsid: 'org.swappulse.binder', label: 'Binder' },
  { nsid: 'org.swappulse.tradeListing', label: 'Trade Listing' },
  { nsid: 'org.swappulse.tradeNegotiation', label: 'Trade Negotiation' },
  { nsid: 'org.swappulse.tradeChain', label: 'Trade Chain' },
  { nsid: 'org.swappulse.tradeMessage', label: 'Trade Message' },
  { nsid: 'org.swappulse.vouch', label: 'Vouch' },
  { nsid: 'org.swappulse.reputationProfile', label: 'Reputation Profile' },
  { nsid: 'org.swappulse.tradingFeedback', label: 'Trading Feedback' },
  { nsid: 'org.swappulse.post', label: 'Post' },
  { nsid: 'org.swappulse.reaction', label: 'Reaction' },
  { nsid: 'org.swappulse.packOpening', label: 'Pack Opening' },
  { nsid: 'org.swappulse.journal', label: 'Journal' },
  { nsid: 'org.swappulse.story', label: 'Story' },
  { nsid: 'org.swappulse.storyView', label: 'Story View' },
  { nsid: 'org.swappulse.voiceSpace', label: 'Voice Space' },
  { nsid: 'org.swappulse.podcastEpisode', label: 'Podcast Episode' },
  { nsid: 'org.swappulse.podcastPlay', label: 'Podcast Play' },
  { nsid: 'org.swappulse.meetup', label: 'Meetup' },
  { nsid: 'org.swappulse.meetupRsvp', label: 'Meetup RSVP' },
  { nsid: 'org.swappulse.circle', label: 'Circle' },
  { nsid: 'org.swappulse.circleExit', label: 'Circle Exit' },
  { nsid: 'org.swappulse.challenge', label: 'Challenge' },
  { nsid: 'org.swappulse.challengeEntry', label: 'Challenge Entry' },
  { nsid: 'org.swappulse.achievement', label: 'Achievement' },
  { nsid: 'org.swappulse.achievementProofSnapshot', label: 'Achievement Proof Snapshot' },
  { nsid: 'org.swappulse.scannerCorrection', label: 'Scanner Correction' },
  { nsid: 'org.swappulse.cardReview', label: 'Card Review' },
  { nsid: 'org.swappulse.sentimentPoll', label: 'Sentiment Poll' },
  { nsid: 'org.swappulse.sentimentVote', label: 'Sentiment Vote' },
  { nsid: 'org.swappulse.notification', label: 'Notification' },
  { nsid: 'org.swappulse.notificationState', label: 'Notification State' },
  { nsid: 'org.swappulse.settingsConfig', label: 'Settings Config' },
  { nsid: 'org.swappulse.crossPostConfig', label: 'Cross-Post Config' },
  { nsid: 'org.swappulse.externalActivity', label: 'External Activity' },
  { nsid: 'org.swappulse.handleClaim', label: 'Handle Claim' },
  { nsid: 'org.swappulse.feedback', label: 'Feedback' },
];

export default function Help() {
  const [query, setQuery] = useState('');

  const filteredFeatures = useMemo(() => {
    if (!query.trim()) return FEATURES;
    const q = query.toLowerCase();
    return FEATURES.filter((f) => f.label.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q));
  }, [query]);

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

  const hasResults = filteredFeatures.length > 0 || filteredFaq.length > 0 || filteredTroubleshooting.length > 0;

  return (
    <div>
      <PageHeader title="Help & Info" subtitle="What SwapPulse does, how it works, and where to get help" />

      <div className="space-y-6 p-4">
        {/* Alpha */}
        <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4">
          <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div className="text-sm">
            <p className="font-bold">SwapPulse is in alpha.</p>
            <p className="text-muted-foreground">
              We're building in the open. Features may change or be removed as we improve the site. Your feedback directly
              shapes what we build next.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help articles, features, and FAQs…"
            className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>

        {/* Status link */}
        <Link
          to="/status"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-secondary/50"
        >
          <Activity className="h-5 w-5 shrink-0 text-success" />
          <div className="flex-1">
            <p className="text-sm font-bold">System Status</p>
            <p className="text-xs text-muted-foreground">Check if any service is down or degraded</p>
          </div>
          <ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground" />
        </Link>

        {/* About */}
        {!query && (
          <section>
            <h2 className="mb-2 text-lg font-extrabold">About SwapPulse</h2>
            <p className="text-sm text-muted-foreground">
              SwapPulse is a social platform for Pokémon TCG collectors — track your collection, share pulls, trade with
              trusted collectors, join circles, go live, and follow the market. Built on the AT Protocol for self-sovereign
              identity, powered by the TCGdex open catalog, and kept free and open-source by community support.
            </p>
          </section>
        )}

        {/* Features */}
        {filteredFeatures.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-extrabold">Features</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredFeatures.map((f) => (
                <Link
                  key={f.to}
                  to={f.to}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-secondary/50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold">{f.label}</p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        {filteredFaq.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-extrabold">Frequently asked questions</h2>
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
              <h2 className="text-lg font-extrabold">Troubleshooting</h2>
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
              <h2 className="text-lg font-extrabold">Lexicon Reference</h2>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              SwapPulse defines {LEXICONS.length} AT Protocol record types. Each lexicon specifies the schema, validation rules,
              and permissions for a data type.
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
            <p className="mt-3 text-sm font-bold">No results for "{query}"</p>
            <p className="text-xs text-muted-foreground">Try a different search term, or send feedback if you can't find what you need.</p>
          </div>
        )}

        {/* Support / donate / feedback */}
        {!query && (
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                <h3 className="font-bold">Support SwapPulse</h3>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                Keep every feature free and open-source. Donate any amount — it all goes back into the platform.
              </p>
              <Link to="/donate" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
                <Heart className="h-4 w-4 fill-current" /> Donate
              </Link>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h3 className="font-bold">Send feedback</h3>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                Use the <b>Feedback</b> button on the right edge of any page — it captures a snapshot and sends your note to
                the team. Or email <a href="mailto:feedback@swappulse.org" className="text-primary underline">feedback@swappulse.org</a>.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}