import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, Sparkles, Layers, Users, AlertCircle, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import LiveAvatar from '@/components/LiveAvatar';
import useSEO from '@/hooks/useSEO';
import { useT } from '@/lib/i18n/I18nProvider';

// DiscoverUsers — public directory of collectors who share a profile detail.
// Reached from the clickable location / interest / favourite-Pokémon /
// favourite-set chips on a profile. Reads ?field= &value= from the URL,
// calls the search-profiles backend function, and renders an accessible,
// SEO-indexed grid of collector cards linking back to each profile.
const FIELD_META = {
  location: { icon: MapPin, titleKey: 'discoverUsers.title.location' },
  interest: { icon: Search, titleKey: 'discoverUsers.title.interest' },
  pokemon: { icon: Sparkles, titleKey: 'discoverUsers.title.pokemon' },
  set: { icon: Layers, titleKey: 'discoverUsers.title.set' },
};

export default function DiscoverUsers() {
  const t = useT();
  const [params] = useSearchParams();
  const field = params.get('field') || '';
  const value = params.get('value') || '';
  const meta = FIELD_META[field];

  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    if (!meta || !value) { setLoading(false); setResults([]); setTotal(0); return; }
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await base44.functions.invoke('search-profiles', { field, value, limit: 48 });
        if (!active) return;
        setResults(res?.data?.results || []);
        setTotal(res?.data?.total || 0);
      } catch (e) {
        if (active) setError(e?.message || 'error');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [field, value, meta]);

  const title = meta ? t(meta.titleKey, { value }) : t('discoverUsers.title.default');
  const subtitle = t('discoverUsers.subtitle');
  const Icon = meta?.icon || Users;
  const canonicalPath = `/discover/users?field=${encodeURIComponent(field)}&value=${encodeURIComponent(value)}`;

  useSEO({
    title,
    description: t('discoverUsers.seoDescription', { value }),
    canonicalPath,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description: subtitle,
      url: typeof window !== 'undefined' ? window.location.href : '',
    },
  });

  if (!meta) {
    return (
      <div className="min-h-screen pb-20 md:pb-0">
        <PageHeader title={t('discoverUsers.title.default')} subtitle={subtitle} />
        <div className="p-6 text-center text-sm text-muted-foreground">{t('discoverUsers.invalidField')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <PageHeader title={title} subtitle={subtitle}>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
      </PageHeader>

      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {loading ? t('discoverUsers.loading') : t('discoverUsers.collectorsCount', { count: total })}
        </p>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {t('discoverUsers.error')}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="h-12 w-12 animate-pulse rounded-full bg-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-secondary" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-secondary" />
                </div>
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">{t('discoverUsers.empty')}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="list">
            {results.map((r) => {
              const to = r.handle ? `/u/${r.handle}` : r.did ? `/profile/${r.did}` : null;
              const name = r.displayName || r.handle || t('common.collectors');
              if (!to) {
                return (
                  <li key={r.did || Math.random()} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                    <LiveAvatar did={r.did} name={name} src={r.avatar} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{name}</p>
                      {r.bio && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.bio}</p>}
                    </div>
                  </li>
                );
              }
              return (
                <li key={r.did || r.handle || Math.random()}>
                  <Link
                    to={to}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-raised"
                    aria-label={`${t('discoverUsers.viewProfile')} — ${name}`}
                  >
                    <LiveAvatar did={r.did} name={name} src={r.avatar} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{name}</p>
                      {r.handle && <p className="truncate text-sm text-muted-foreground">@{r.handle}</p>}
                      {r.bio && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.bio}</p>}
                      {r.location && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {r.location}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}