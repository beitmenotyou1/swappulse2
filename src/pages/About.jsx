import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Network, Users, ShieldCheck, Heart, Github, Globe } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import useSEO from '@/hooks/useSEO';
import { useT } from '@/lib/i18n/I18nProvider';

const PRINCIPLES = [
  { icon: Heart, titleKey: 'about.principle.free.title', bodyKey: 'about.principle.free.body' },
  { icon: Network, titleKey: 'about.principle.decentralized.title', bodyKey: 'about.principle.decentralized.body' },
  { icon: Users, titleKey: 'about.principle.community.title', bodyKey: 'about.principle.community.body' },
  { icon: ShieldCheck, titleKey: 'about.principle.privacy.title', bodyKey: 'about.principle.privacy.body' },
];

const FEATURES = [
  'about.feature.collection',
  'about.feature.trading',
  'about.feature.scanner',
  'about.feature.social',
  'about.feature.community',
  'about.feature.market',
  'about.feature.voice',
  'about.feature.achievements',
];

export default function About() {
  const t = useT();
  useSEO({
    title: t('about.seoTitle'),
    description: t('about.seoDescription'),
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
      <PageHeader title={t('about.title')} subtitle={t('footer.tagline')} />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t('about.back')}
        </Link>

        {/* Mission */}
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">{t('about.missionTitle')}</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{t('about.missionBody')}</p>
        </section>

        {/* What is SwapPulse */}
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold">{t('about.whatTitle')}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t('about.whatBody1')}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t('about.whatBody2')}</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {t(f)}
              </li>
            ))}
          </ul>
        </section>

        {/* Core Principles */}
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-bold">{t('about.principlesTitle')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {PRINCIPLES.map(({ icon: Icon, titleKey, bodyKey }) => (
              <div key={titleKey} className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <h3 className="font-bold">{t(titleKey)}</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{t(bodyKey)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Open source & tech */}
        <section className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Github className="h-4 w-4" />
            <span>{t('about.openSource')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            <span>{t('about.builtOn')}</span>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-8 rounded-2xl border border-border bg-card p-6 text-center">
          <h2 className="text-lg font-bold">{t('about.joinTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('about.joinBody')}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t('about.callToAction.createAccount')}
            </Link>
            <Link
              to="/explore"
              className="inline-flex items-center justify-center rounded-md border border-input bg-transparent px-5 py-2 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {t('about.callToAction.exploreCards')}
            </Link>
            <Link
              to="/donate"
              className="inline-flex items-center justify-center rounded-md border border-input bg-transparent px-5 py-2 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {t('about.callToAction.supportUs')}
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}