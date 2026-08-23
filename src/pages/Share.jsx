import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { idbGet, idbDelete } from '@/lib/offlineDB';
import GuideFooterLink from '@/components/help/GuideFooterLink';
import { useT } from '@/lib/i18n/I18nProvider';
import useSEO from '@/hooks/useSEO';

// Receives images shared into SwapPulse from the OS share sheet (§8.1 Share Target).
// The service worker stores the shared file in IndexedDB 'shares' and redirects here.
export default function Share() {
  const t = useT();
  useSEO({
    title: 'Share to SwapPulse',
    description: 'Share images and Pokémon TCG content into SwapPulse from your device.',
    canonicalPath: '/share',
  });
  const [share, setShare] = useState(null);
  const [url, setUrl] = useState(null);

  useEffect(() => {
    (async () => {
      const s = await idbGet('shares', 'last-share');
      if (s) {
        setShare(s);
        if (s.buf) {
          const blob = new Blob([s.buf], { type: s.type || 'image/*' });
          setUrl(URL.createObjectURL(blob));
        }
      }
    })();
  }, []);

  const clear = async () => {
    await idbDelete('shares', 'last-share');
    if (url) URL.revokeObjectURL(url);
    setShare(null);
    setUrl(null);
  };

  return (
    <div>
      <PageHeader title={t('page.share.title')} subtitle={t('page.share.subtitle')} />
      <div className="p-4">
        {!share ? (
          <div className="py-16 text-center">
            <Share2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-bold">{t('page.share.empty')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('page.share.emptySub')}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-4">
            {url && <img src={url} alt={share.name} className="mx-auto mb-3 max-h-72 rounded-lg object-contain" />}
            {share.title && <p className="text-sm font-semibold">{share.title}</p>}
            {share.text && <p className="text-sm text-muted-foreground">{share.text}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/explore" onClick={clear} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white">{t('share.addToCollection')}</Link>
              <Link to="/compose" onClick={clear} className="rounded-full border border-border px-4 py-2 text-sm font-bold">{t('share.createPost')}</Link>
              <button onClick={clear} className="rounded-full border border-border px-4 py-2 text-sm font-bold">{t('share.dismiss')}</button>
            </div>
          </div>
        )}
      </div>
      <GuideFooterLink slug="share" />
    </div>
  );
}