import React from 'react';
import { CheckCircle2, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '@/components/Logo';
import { useT } from '@/lib/i18n/I18nProvider';

export default function AccountDeleted() {
  const t = useT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8"><Logo size={48} withText /></div>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-raised">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h1 className="text-xl font-bold">{t('page.accountDeleted.title')}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t('page.accountDeleted.desc1')}</p>
        <p className="mt-3 text-sm text-muted-foreground">{t('page.accountDeleted.desc2')}</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Home className="h-4 w-4" /> {t('page.accountDeleted.backHome')}
        </Link>
      </div>
    </div>
  );
}