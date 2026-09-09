import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Compass, Layers, ScanLine, ArrowLeftRight, BookOpen, Shield, ShieldAlert, Vote, Users, CalendarDays, Award, Package, BarChart3, MoreHorizontal, X, User as UserIcon, Plus, Radio, Bell, MessageSquare, Settings as SettingsIcon, UserPlus, Trophy, Target, LogOut, Sparkles, Search, Rss, Box, Tag, Network, Wallet as WalletIcon, ExternalLink } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { useLivePresence } from '@/lib/livePresence';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useUnreadDMCount } from '@/hooks/useUnreadDMCount';
import { useAuth } from '@/lib/AuthContext';
import { PopoverTrigger } from '@/components/ui/popover';
import NotificationPopover from '@/components/notifications/NotificationPopover';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useT } from '@/lib/i18n/I18nProvider';
import { SITE_LINKS } from '@/lib/siteLinks';
const primary = [
  { to: '/', icon: Home, label: 'Home', tKey: 'nav.home' },
  { to: '/explore', icon: Compass, label: 'Explore', tKey: 'nav.explore' },
  { to: '/trades', icon: ArrowLeftRight, label: 'Trades', tKey: 'nav.trades' },
  { to: '/collection', icon: Layers, label: 'Collection', tKey: 'nav.collection', authOnly: true },
  { to: '/wallet', icon: WalletIcon, label: 'Wallet', tKey: 'nav.chainWallet', authOnly: true },
];

const TAB_ROOTS = ['/', '/explore', '/trades', '/collection', '/wallet'];

// Determine which primary tab owns a given pathname.
// Sub-pages not matching any tab root fall back to the last active tab.
function getOwningTab(pathname, fallback) {
  if (pathname === '/') return '/';
  for (const root of TAB_ROOTS) {
    if (root !== '/' && pathname.startsWith(root)) return root;
  }
  return fallback;
}

const moreGroups = [
  {
    key: 'tools',
    tKey: 'nav.moreTools',
    items: [
      { to: '/scan', icon: ScanLine, label: 'Scanner', tKey: 'nav.scan', authOnly: true },
      { to: '/helper', icon: Sparkles, label: 'Helper', tKey: 'nav.collectorCopilot', authOnly: true },
      { to: '/search', icon: Search, label: 'Search', tKey: 'nav.search' },
      { to: '/feeds', icon: Rss, label: 'Feeds', tKey: 'nav.feeds' },
      { to: '/binders', icon: BookOpen, label: 'Binders', tKey: 'nav.binders' },
      { to: '/market', icon: BarChart3, label: 'Market', tKey: 'nav.market' },
      { to: '/grading', icon: Award, label: 'Grading', tKey: 'nav.grading', authOnly: true },
    ],
  },
  {
    key: 'community',
    tKey: 'nav.moreCommunity',
    items: [
      { to: '/circles-directory', icon: Network, label: 'Directory', tKey: 'nav.circleDirectory' },
      { to: '/labelers', icon: Tag, label: 'Labelers', tKey: 'nav.labelers' },
      { to: '/circles', icon: Users, label: 'Circles', tKey: 'nav.circles' },
      { to: '/meetups', icon: CalendarDays, label: 'Meetups', tKey: 'nav.meetups' },
      { to: '/who-to-follow', icon: UserPlus, label: 'Who to Follow', tKey: 'nav.whoToFollow', authOnly: true },
    ],
  },
  {
    key: 'activities',
    tKey: 'nav.moreActivities',
    items: [
      { to: '/starter-packs', icon: Box, label: 'Starter Packs', tKey: 'nav.starterPacks' },
      { to: '/challenges', icon: Target, label: 'Challenges', tKey: 'nav.challenges' },
      { to: '/achievements', icon: Trophy, label: 'Achievements', tKey: 'nav.achievements', authOnly: true },
      { to: '/pack-parties', icon: Sparkles, label: 'Parties', tKey: 'nav.packParties' },
      { to: '/pull-of-the-week', icon: Trophy, label: 'Pull of Week', tKey: 'nav.pullOfTheWeek' },
      { to: '/packs', icon: Package, label: 'Pack Openings', tKey: 'nav.packOpenings' },
      { to: '/predictions', icon: Vote, label: 'Polls', tKey: 'nav.predictions' },
      { to: '/spaces', icon: Radio, label: 'Live', tKey: 'nav.live' },
    ],
  },
  {
    key: 'account',
    tKey: 'nav.moreAccount',
    items: [
      { to: '/notifications', icon: Bell, label: 'Alerts', tKey: 'nav.notifications', authOnly: true },
      { to: '/messages', icon: MessageSquare, label: 'Messages', tKey: 'nav.messages', authOnly: true },
      { to: '/profile', icon: UserIcon, label: 'Profile', tKey: 'nav.profile', authOnly: true },
      { to: '/settings', icon: SettingsIcon, label: 'Settings', tKey: 'nav.settings', authOnly: true },
    ],
  },
  {
    key: 'admin',
    tKey: 'nav.moreAdmin',
    items: [
      { to: '/admin', icon: Shield, label: 'Admin', tKey: 'nav.admin', adminOnly: true },
      { to: '/moderation', icon: ShieldAlert, label: 'Moderation', tKey: 'nav.moderation', adminOnly: true },
    ],
  },
];

const moreItems = moreGroups.flatMap((group) => group.items);

export default function MobileNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const { liveByDid } = useLivePresence();
  const liveCount = liveByDid.size;
  const unread = useUnreadCount();
  const unreadDMs = useUnreadDMCount();
  const { user, isAuthenticated, logout } = useAuth();
  const t = useT();

  // --- Native-style tab navigation: per-tab scroll + history preservation ---
  const lastTabRef = useRef('/');
  const tabStates = useRef({});
  const pendingRestore = useRef(null);

  const owningTab = useMemo(() => getOwningTab(pathname, lastTabRef.current), [pathname]);

  useEffect(() => {
    if (owningTab) lastTabRef.current = owningTab;
  }, [owningTab]);

  // Restore scroll position after navigating to a saved tab state
  useEffect(() => {
    if (pendingRestore.current && pathname === pendingRestore.current.pathname) {
      const { scrollY } = pendingRestore.current;
      pendingRestore.current = null;
      requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'instant' }));
    }
  }, [pathname]);

  const activeInMore = moreItems.some((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)));

  useEffect(() => {
    if (!moreOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [moreOpen]);

  const renderMoreItem = (item) => {
    const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
    const itemClass = `relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl p-2.5 text-center text-[11px] font-medium transition-colors hover:bg-secondary ${active ? 'text-primary' : 'text-foreground'}`;

    if (item.to === '/notifications') {
      return (
        <NotificationPopover
          key={item.to}
          side="top"
          align="center"
          onNavigate={() => setMoreOpen(false)}
          trigger={
            <PopoverTrigger asChild>
              <button type="button" className={itemClass}>
                <item.icon className="h-5 w-5" />
                {t(item.tKey)}
                {unread > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">{unread}</span>
                )}
              </button>
            </PopoverTrigger>
          }
        />
      );
    }

    return (
      <Link key={item.to} to={item.to} onClick={() => setMoreOpen(false)} className={itemClass}>
        <item.icon className="h-5 w-5" />
        {t(item.tKey)}
        {item.to === '/spaces' && liveCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">{liveCount}</span>
        )}
        {item.to === '/messages' && unreadDMs > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">{unreadDMs}</span>
        )}
      </Link>
    );
  };

  return (
    <>
      {isAuthenticated && (
        <Link
          to="/compose"
          className="fixed bottom-20 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 transition-transform active:scale-95 md:hidden"
          aria-label={t('page.compose.newPost')}
        >
          <Plus className="h-7 w-7" />
        </Link>
      )}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-background/95 px-1 py-1.5 pb-[env(safe-area-inset-bottom,16px)] backdrop-blur md:hidden">
        {primary.filter((i) => !i.authOnly || isAuthenticated).map((item) => {
          const active = owningTab === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={(e) => {
                e.preventDefault();
                // Save current tab's scroll position and pathname before switching
                if (owningTab) {
                  tabStates.current[owningTab] = { pathname, scrollY: window.scrollY };
                }
                if (owningTab === item.to) {
                  // Tapping the active tab — pop to root or scroll to top
                  if (pathname === item.to) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } else {
                    navigate(item.to);
                  }
                } else {
                  // Tapping a different tab — restore saved state or go to root
                  const saved = tabStates.current[item.to];
                  const targetPath = saved?.pathname || item.to;
                  const targetScrollY = saved?.scrollY || 0;
                  if (targetPath === pathname) {
                    window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
                  } else {
                    pendingRestore.current = { pathname: targetPath, scrollY: targetScrollY };
                    navigate(targetPath);
                  }
                }
              }}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" />
              {t(item.tKey)}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-controls="mobile-more-menu"
          className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium transition-colors ${
            activeInMore ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <MoreHorizontal className="h-5 w-5" />
          {t('nav.more')}
        </button>
        <ThemeToggle className="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium text-muted-foreground h-auto w-auto rounded-lg hover:bg-transparent" />
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
            aria-label={t('common.close')}
          />
          <section
            id="mobile-more-menu"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-more-title"
            className="relative flex h-[min(90dvh,48rem)] w-full flex-col overflow-hidden rounded-t-2xl border-t border-border bg-card shadow-2xl animate-slide-up"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <p id="mobile-more-title" className="text-sm font-bold">{t('nav.more')}</p>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label={t('common.close')} className="rounded-full p-1 hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 [-webkit-overflow-scrolling:touch]">
              <div className="mb-4">
                <LanguageSwitcher />
              </div>

              <div className="space-y-5">
                {moreGroups.map((group) => {
                  const visibleItems = group.items.filter(
                    (item) => (!item.authOnly || isAuthenticated) && (!item.adminOnly || user?.role === 'admin'),
                  );
                  if (visibleItems.length === 0) return null;

                  return (
                    <section key={group.key} aria-labelledby={`mobile-more-${group.key}`}>
                      <h3 id={`mobile-more-${group.key}`} className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        {t(group.tKey)}
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        {visibleItems.map(renderMoreItem)}
                      </div>
                    </section>
                  );
                })}
              </div>

              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => { setMoreOpen(false); logout(); }}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-border p-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                >
                  <LogOut className="h-5 w-5" />
                  {t('nav.logout')}
                </button>
              )}

              <div className="mt-5 border-t border-border pt-3">
                <nav className="flex flex-wrap gap-x-4 gap-y-2 px-1" aria-label={t('nav.more')}>
                  <a
                    href={SITE_LINKS.documentation}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> {t('footer.documentation')} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                  <Link to="/status" onClick={() => setMoreOpen(false)} className="text-xs font-semibold text-success hover:underline">
                    {t('footer.status')}
                  </Link>
                  <Link to="/terms" onClick={() => setMoreOpen(false)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                    {t('nav.terms')}
                  </Link>
                  <Link to="/privacy" onClick={() => setMoreOpen(false)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                    {t('nav.privacy')}
                  </Link>
                  <Link to="/chain/" onClick={() => setMoreOpen(false)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                    {t('footer.chainExplorer')}
                  </Link>
                  <Link to="/donate" onClick={() => setMoreOpen(false)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                    {t('nav.donate')}
                  </Link>
                  <a
                    href={SITE_LINKS.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    aria-label={t('footer.githubNewTab')}
                  >
                    {t('footer.github')}
                  </a>
                </nav>
                <p className="mt-3 px-1 text-[11px] font-medium text-muted-foreground">
                  {t('footer.builtOn')}
                </p>
                <p className="mt-1.5 px-1 text-[10px] leading-relaxed text-muted-foreground/70">
                  {t('footer.disclaimer')}
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}