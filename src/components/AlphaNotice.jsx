import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, FlaskConical } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';

const KEY = 'swappulse-beta-notice-v1';

export default function AlphaNotice() {
  const t = useT();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
  });
  if (dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(KEY, '1'); } catch {}
    setDismissed(true);
  };

  return (
    <div className="border-b border-accent/30 bg-accent/10">
      <div className="flex items-center gap-2 px-4 py-2 text-sm">
        <FlaskConical className="h-4 w-4 shrink-0 text-accent" />
        <p className="flex-1 text-foreground/90">
          <span className="font-bold">{t('banner.alpha.title')}</span>{' '}
          {t('banner.alpha.desc')}{' '}
          <Link to="/help" className="font-semibold text-primary underline-offset-2 hover:underline">{t('banner.alpha.learnMore')}</Link>.
        </p>
        <button onClick={dismiss} aria-label={t('common.dismiss')} className="rounded-full p-1 text-muted-foreground hover:bg-accent/20 hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}