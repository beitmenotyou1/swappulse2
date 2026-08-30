import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LifeBuoy } from 'lucide-react';
import StepUpGate from '@/components/security/StepUpGate';
import RecoveryPanel from '@/components/chain/RecoveryPanel';
import GuideFooterLink from '@/components/help/GuideFooterLink';
import useSEO from '@/hooks/useSEO';
import { useT } from '@/lib/i18n/I18nProvider';

export default function Recover() {
  const t = useT();

  useSEO({
    title: t('page.recover.seoTitle'),
    description: t('page.recover.seoDescription'),
    canonicalPath: '/recover',
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/wallet" className="rounded-full p-2 hover:bg-secondary" aria-label={t('page.recover.back')}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <LifeBuoy className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">{t('page.recover.title')}</h1>
        </div>
      </div>

      <p className="mb-5 text-sm text-muted-foreground">{t('page.recover.intro')}</p>

      <StepUpGate title={t('page.recover.stepUpTitle')} description={t('page.recover.stepUpDescription')}>
        {({ token, lock }) => <RecoveryPanel stepUpToken={token} onLock={lock} />}
      </StepUpGate>

      <GuideFooterLink slug="account-recovery" />
    </div>
  );
}