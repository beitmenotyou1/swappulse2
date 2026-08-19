import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useT } from '@/lib/i18n/I18nProvider';

export default function SignInBanner() {
  const { isAuthenticated } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const t = useT();
  if (isAuthenticated || dismissed) return null;
  return (
    <div className="flex items-center justify-between gap-2 border-b border-primary/20 bg-primary/5 px-4 py-2 text-sm">
      <p className="text-muted-foreground">
        <LogIn className="mr-1.5 inline h-4 w-4 text-primary" aria-hidden="true" />
        {t('signInBanner.guest')}{' '}
        <Link to="/login" className="font-semibold text-primary hover:underline">{t('nav.login')}</Link>
        {' '}{t('signInBanner.loginToInteract')}
      </p>
      <button
        onClick={() => setDismissed(true)}
        aria-label={t('common.close')}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}