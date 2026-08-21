import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { ExternalLink } from 'lucide-react';
import { subscribeExternalLink, clearExternalLink } from '@/lib/externalLink';
import { useT } from '@/lib/i18n/I18nProvider';

export default function ExternalLinkConfirm() {
  const t = useT();
  const [url, setUrl] = useState(null);

  useEffect(() => subscribeExternalLink(setUrl), []);

  const isOpen = url !== null;

  const handleContinue = () => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    clearExternalLink();
  };

  const handleCancel = () => clearExternalLink();

  return (
    <AlertDialog open={isOpen} onOpenChange={(o) => !o && handleCancel()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-primary" />
            {t('externalLink.title')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>{t('externalLink.desc')}</p>
              {url && (
                <p className="break-all rounded-lg bg-secondary px-3 py-2 font-mono text-xs text-muted-foreground">
                  {url}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleContinue}>{t('externalLink.continue')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}