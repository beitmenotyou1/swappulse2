import React from 'react';
import { Outlet } from 'react-router-dom';
import LeftNav from '@/components/LeftNav';
import RightSidebar from '@/components/RightSidebar';
import MobileNav from '@/components/MobileNav';
import RealtimeToaster from '@/components/RealtimeToaster';
import BellToaster from '@/components/follow/BellToaster';
import AlphaNotice from '@/components/AlphaNotice';
import ActivationBanner from '@/components/ActivationBanner';
import FeedbackButton from '@/components/feedback/FeedbackButton';
import SignInBanner from '@/components/SignInBanner';
import BannerProvider from '@/components/notifications/BannerProvider';
import NotificationHandler from '@/components/notifications/NotificationHandler';
import NotificationPopupListener from '@/components/notifications/NotificationPopupListener';
import StickyPlayerBar from '@/components/podcast/StickyPlayerBar';
import CookieConsentBanner from '@/components/consent/CookieConsentBanner';
import ShareButton from '@/components/share/ShareButton';
import BotChallengeProvider from '@/lib/BotChallengeProvider';
import { usePresence } from '@/hooks/usePresence';
import { useApplyAccessibility } from '@/hooks/useSettings';
import { useT } from '@/lib/i18n/I18nProvider';

export default function Layout() {
  const online = usePresence();
  useApplyAccessibility();
  const t = useT();
  return (
    <BotChallengeProvider>
    <BannerProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        {t('common.skipToContent')}
      </a>
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] overflow-x-hidden">
        <div className="hidden w-[72px] shrink-0 md:block xl:w-[240px]">
          <LeftNav />
        </div>
        <main id="main-content" className="min-w-0 flex-1 border-x border-border pb-20 md:pb-0">
        <AlphaNotice />
        <ActivationBanner />
        <SignInBanner />
        <Outlet />
        <StickyPlayerBar />
      </main>
      <div className="hidden w-80 shrink-0 lg:block">
        <RightSidebar online={online} />
      </div>
      <MobileNav />
      <ShareButton />
      <CookieConsentBanner />
      <RealtimeToaster />
      <BellToaster />
      <FeedbackButton />
      </div>
      <NotificationHandler />
      <NotificationPopupListener />
    </BannerProvider>
    </BotChallengeProvider>
  );
}