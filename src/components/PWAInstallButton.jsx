import React, { useEffect, useState } from 'react';
import { Download, Share, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useT } from '@/lib/i18n/I18nProvider';

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  const ua = (navigator.userAgent || '').toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

export default function PWAInstallButton({ variant = 'link' }) {
  const t = useT();
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [iosOpen, setIosOpen] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Hide once installed (standalone mode).
  if (installed) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <Check className="h-3.5 w-3.5" /> {t('pwa.installed')}
      </span>
    );
  }

  // No deferred prompt and not iOS → browser doesn't support install; hide.
  const canPrompt = !!deferred;
  const showIOS = !canPrompt && isIOS();
  if (!canPrompt && !showIOS) return null;

  const handleInstall = async () => {
    if (deferred) {
      deferred.prompt();
      try {
        await deferred.userChoice;
      } catch {
        /* ignore */
      }
      setDeferred(null);
    } else if (showIOS) {
      setIosOpen(true);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        onClick={handleInstall}
        className="gap-1.5 px-0 text-xs font-normal h-auto"
      >
        <Download className="h-3.5 w-3.5" />
        {t('footer.installApp')}
      </Button>

      <Dialog open={iosOpen} onOpenChange={setIosOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('pwa.iosTitle')}</DialogTitle>
            <DialogDescription>{t('pwa.iosBody')}</DialogDescription>
          </DialogHeader>
          <ol className="mt-2 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                1
              </span>
              <span className="flex items-center gap-1.5">
                {t('pwa.iosStep1')} <Share className="h-4 w-4 text-primary" />
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                2
              </span>
              <span className="flex items-center gap-1.5">
                {t('pwa.iosStep2')} <Plus className="h-4 w-4 text-primary" />
                <span className="font-medium">{t('pwa.iosStep2Label')}</span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                3
              </span>
              <span>{t('pwa.iosStep3')}</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}