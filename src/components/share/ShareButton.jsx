import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import ShareDialog from './ShareDialog';

export default function ShareButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated transition-transform hover:scale-105 active:scale-95 md:bottom-6"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}
        aria-label={t('share.open')}
      >
        <Share2 className="h-5 w-5" />
        <span className="sr-only">{t('share.open')}</span>
      </button>
      <ShareDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}