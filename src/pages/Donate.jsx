import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowLeft } from 'lucide-react';
import Logo from '@/components/Logo';
import DonationToggle from '@/components/donate/DonationToggle';
import FiatDonationForm from '@/components/donate/FiatDonationForm';
import CryptoDonationForm from '@/components/donate/CryptoDonationForm';
import useSEO from '@/hooks/useSEO';
import { useT } from '@/lib/i18n/I18nProvider';

export default function Donate() {
  const t = useT();
  useSEO({
    title: 'Support SwapPulse',
    description: 'Donate to SwapPulse by card or cryptocurrency. Every contribution keeps the platform free and open-source.',
    canonicalPath: '/donate',
  });
  const [method, setMethod] = useState('card');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <Logo size={28} withText={false} />
          <span className="font-extrabold">SwapPulse</span>
        </Link>
        <Link to="/" className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t('page.donate.back')}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
            <Heart className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold">{t('page.donate.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('page.donate.subtitle')}</p>
          </div>
        </div>

        <p className="mb-5 text-sm text-muted-foreground">
          SwapPulse is built by collectors, for collectors. Every feature stays free and open-source. Your donation
          helps cover hosting, the TCGDex catalogue, and the AT Protocol infrastructure that keeps your collection
          self-sovereign.
        </p>

        <DonationToggle method={method} onChange={setMethod} />

        <div className="mt-5">
          {method === 'card' ? <FiatDonationForm /> : <CryptoDonationForm />}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Questions about donating? Read our{' '}
          <Link to="/help/donations" className="font-semibold text-primary hover:underline">donations help article</Link>.
        </p>
      </main>
    </div>
  );
}