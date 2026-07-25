import React from 'react';
import { Link } from 'react-router-dom';
import {
  Compass, Layers, BookOpen, ArrowLeftRight, Users, CalendarDays, Radio, Package,
  BarChart3, Vote, Award, ShieldCheck, Settings as SettingsIcon, Heart, MessageSquare,
  ChevronDown, FlaskConical,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const FEATURES = [
  { to: '/explore', icon: Compass, label: 'Explore', desc: 'Browse the full Pokémon TCG catalog via TCGdex, by set, rarity, or illustrator.' },
  { to: '/collection', icon: Layers, label: 'Collection', desc: 'Track every card you own, with portfolio value, set completion, duplicates, and insurance exports.' },
  { to: '/binders', icon: BookOpen, label: 'Binders', desc: 'Curate and share showcase binders — 3×3 or 9×9 grids, drag-to-reorder.' },
  { to: '/trades', icon: ArrowLeftRight, label: 'Trade Board', desc: 'List cards you have and want, negotiate in threaded trade chats with fairness scoring.' },
  { to: '/circles', icon: Users, label: 'Circles', desc: 'Join themed collector circles — vintage, competitive, shiny, regional, and more.' },
  { to: '/meetups', icon: CalendarDays, label: 'Meetups', desc: 'Organise or attend in-person meetups, swaps, and live pulls near you.' },
  { to: '/spaces', icon: Radio, label: 'Live Voice Spaces', desc: 'Go live from any platform (Twitch, YouTube, Kick) and broadcast to your followers.' },
  { to: '/packs', icon: Package, label: 'Pack Openings', desc: 'Share your pulls and follow collectors to see fresh pack openings in your feed.' },
  { to: '/market', icon: BarChart3, label: 'Market Watch', desc: 'Track card prices, set price alerts, and watch market trends over time.' },
  { to: '/predictions', icon: Vote, label: 'Predictions', desc: 'Create and vote on community sentiment polls about cards and the meta.' },
  { to: '/grading', icon: Award, label: 'Grading', desc: 'Prepare grading submissions and review condition reports for your cards.' },
  { to: '/trust', icon: ShieldCheck, label: 'Trust', desc: 'Build reputation through vouches and trading feedback — your trusted-trader score.' },
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
    q: 'How do I get help if something is broken?',
    a: 'Tap the Feedback button on the right edge of the screen — it captures a snapshot of the page and sends your comment straight to the team. You can also email feedback@swappulse.org.',
  },
];

export default function Help() {
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

        {/* About */}
        <section>
          <h2 className="mb-2 text-lg font-extrabold">About SwapPulse</h2>
          <p className="text-sm text-muted-foreground">
            SwapPulse is a social platform for Pokémon TCG collectors — track your collection, share pulls, trade with
            trusted collectors, join circles, go live, and follow the market. Built on the AT Protocol for self-sovereign
            identity, powered by the TCGdex open catalog, and kept free and open-source by community support.
          </p>
        </section>

        {/* Features */}
        <section>
          <h2 className="mb-3 text-lg font-extrabold">Features</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
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

        {/* FAQ */}
        <section>
          <h2 className="mb-3 text-lg font-extrabold">Frequently asked questions</h2>
          <div className="space-y-2">
            {FAQ.map((item) => (
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

        {/* Support / donate / feedback */}
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
      </div>
    </div>
  );
}