import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowLeft, Home } from 'lucide-react';
import Logo from '@/components/Logo';
import { useT } from '@/lib/i18n/I18nProvider';

export default function FiatSuccess() {
  const t = useT();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <Logo size={28} withText={false} />
          <span className="font-extrabold">SwapPulse</span>
        </Link>
        <Link to="/" className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t('page.donate.backToApp')}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 text-center">
        <span className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
          <Heart className="h-8 w-8 fill-current" />
        </span>
        <h1 className="text-2xl font-extrabold">{t('page.donateThanks.title')}</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t('page.fiatSuccess.desc')}</p>
        <Link
          to="/"
          className="mt-6 flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-primary/90"
        >
          <Home className="h-4 w-4" /> {t('page.donateThanks.backToApp')}
        </Link>
      </main>
    </div>
  );
}