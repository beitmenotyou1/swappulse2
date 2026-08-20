import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Network, Users, ShieldCheck, Heart, Github, Globe } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import useSEO from '@/hooks/useSEO';
import { useT } from '@/lib/i18n/I18nProvider';

const PRINCIPLES = [
  {
    icon: Heart,
    title: 'Free & Open-Source',
    body: 'No paywalls, no premium tiers, no ads. SwapPulse is funded entirely by voluntary donations and licensed under AGPL-3.0 so the community can self-host and audit every line.',
  },
  {
    icon: Network,
    title: 'Decentralized by Design',
    body: 'Built on the AT Protocol, your identity, posts, and collection are portable. You own your data — export it, migrate PDS, or use it in any compatible app at any time.',
  },
  {
    icon: Users,
    title: 'Community-Moderated',
    body: 'Trust is earned through vouches, not handed down. Moderation blends AI screening with human review, and reputation is built by the collectors who trade with you.',
  },
  {
    icon: ShieldCheck,
    title: 'Privacy-First',
    body: 'Direct messages are end-to-end encrypted with no backdoor. Your private key lives in your browser. We collect the minimum needed to run the platform and nothing more.',
  },
];

const FEATURES = [
  'Track your collection, portfolio value, and set completion',
  'Trade cards peer-to-peer with threaded negotiations and trade chains',
  'Scan cards with AI and get instant TCGDex catalogue matches',
  'Post pulls, write journals, build digital binders, and review cards',
  'Join circles, meetups, challenges, and pack parties',
  'Watch the market with price tracking and alerts',
  'Host voice spaces and publish podcasts',
  'Earn proof-based achievements verified against your on-chain activity',
];

export default function About() {
  const t = useT();
  useSEO({
    title: 'About',
    description: 'SwapPulse is a free, open-source, decentralized social network for Pokémon TCG collectors — built on the AT Protocol, powered by TCGDex.',
    canonicalPath: '/about',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: 'About SwapPulse',
      description: 'A decentralized social network for Pokémon TCG collectors.',
    },
  });

  return (
    <>
      <PageHeader title="About SwapPulse" subtitle={t('footer.tagline')} />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to SwapPulse
        </Link>

        {/* Mission */}
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Our Mission</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            SwapPulse exists to give Pokémon TCG collectors a home that belongs to them — not to a
            corporation, an algorithm, or an ad network. We believe a hobby built on community,
            trust, and trade should be powered by software that respects all three. Every feature
            is free, every record is portable, and every decision is made in the open.
          </p>
        </section>

        {/* What is SwapPulse */}
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold">What is SwapPulse?</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            SwapPulse is a decentralized social network and collection manager for Pokémon TCG
            collectors. It combines collection tracking, peer-to-peer trading, social feeds, AI
            tools, and community features into a single platform built on the{' '}
            <strong>AT Protocol</strong> — the same open standard that powers Bluesky. That means
            your posts, trades, and identity are federated and portable; you are never locked in.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Card data is sourced from <strong>TCGDex</strong>, an open Pokémon TCG catalogue, and is
            available in nine languages. The platform is funded entirely by voluntary donations —
            there are no paid features, no premium tiers, and no advertising.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {f}
              </li>
            ))}
          </ul>
        </section>

        {/* Core Principles */}
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-bold">Core Principles</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {PRINCIPLES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <h3 className="font-bold">{title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Open source & tech */}
        <section className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Github className="h-4 w-4" />
            <span>Open-source under AGPL-3.0</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            <span>Built on the AT Protocol · Powered by TCGDex</span>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-8 rounded-2xl border border-border bg-card p-6 text-center">
          <h2 className="text-lg font-bold">Join the community</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a free account, explore the catalogue, or start trading today.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Create account
            </Link>
            <Link
              to="/explore"
              className="inline-flex items-center justify-center rounded-md border border-input bg-transparent px-5 py-2 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Explore cards
            </Link>
            <Link
              to="/donate"
              className="inline-flex items-center justify-center rounded-md border border-input bg-transparent px-5 py-2 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Support us
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}