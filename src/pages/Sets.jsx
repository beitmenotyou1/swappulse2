import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import SetChecklistManager from '@/components/sets/SetChecklistManager';
import { Loader2 } from 'lucide-react';
import useSEO from '@/hooks/useSEO';
import GuideFooterLink from '@/components/help/GuideFooterLink';
import { useT } from '@/lib/i18n/I18nProvider';

export default function Sets() {
  const t = useT();
  useSEO({
    title: 'Set Checklists',
    description: 'Track your Pokémon TCG set completion and download printable PDF checklists on SwapPulse.',
    canonicalPath: '/sets',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Pokémon TCG Set Checklists',
      description: 'Track your Pokémon TCG set completion and download printable PDF checklists on SwapPulse.',
      url: 'https://swappulse.org/sets',
    },
  });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h2 className="text-xl font-bold">{t('page.sets.signIn')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('page.sets.signInSub')}
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('page.sets.title')} subtitle={t('page.sets.subtitle')} />
      <div className="p-4">
        <SetChecklistManager userId={user.id} />
      </div>
      <GuideFooterLink slug="sets" />
    </div>
  );
}