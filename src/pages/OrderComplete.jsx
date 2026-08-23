import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';
import useSEO from '@/hooks/useSEO';

export default function OrderComplete() {
  const t = useT();
  useSEO({
    title: 'Order Complete',
    description: 'Your SwapPulse order has been completed successfully.',
    canonicalPath: '/order-complete',
  });
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      <div className="rounded-full bg-success/15 p-4">
        <CheckCircle2 className="h-12 w-12 text-success" />
      </div>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight">{t('page.orderComplete.title')}</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t('page.orderComplete.desc')}</p>
      <Link
        to="/"
        className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
      >
        {t('page.orderComplete.back')}
      </Link>
    </div>
  );
}