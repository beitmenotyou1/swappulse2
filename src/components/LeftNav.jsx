import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Compass, Layers, ScanLine, ArrowLeftRight, Package, BarChart3, Award, BookOpen, ShieldCheck, Shield, ShieldAlert, Vote, Users, CalendarDays, MoreHorizontal, Radio, Bell, MessageSquare, Settings as SettingsIcon, UserPlus, Trophy, Target, LogIn, LogOut, Sparkles, Rss, Box, Tag, Search, Network, Wallet as WalletIcon, User as UserIcon } from 'lucide-react';
import Logo from '@/components/Logo';
import Avatar from '@/components/Avatar';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/lib/AuthContext';
import { useLivePresence } from '@/lib/livePresence';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useUnreadDMCount } from '@/hooks/useUnreadDMCount';
import { PopoverTrigger } from '@/components/ui/popover';
import NotificationPopover from '@/components/notifications/NotificationPopover';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useT } from '@/lib/i18n/I18nProvider';

const primary = [
  { to: '/', icon: Home, label: 'Home', tKey: 'nav.home' },
  { to: '/explore', icon: Compass, label: 'Explore', tKey: 'nav.explore' },
  { to: '/collection', icon: Layers, label: 'Collection', tKey: 'nav.collection', authOnly: true },
  { to: '/trades', icon: ArrowLeftRight, label: 'Trade Board', tKey: 'nav.trades' },
  { to: '/wallet', icon: WalletIcon, label: 'Wallet', tKey: 'nav.chainWallet', authOnly: true },
  { to: '/notifications', icon: Bell, label: 'Notifications', tKey: 'nav.notifications', authOnly: true },
  { to: '/messages', icon: MessageSquare, label: 'Messages', tKey: 'nav.messages', authOnly: true },
];

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
      { to: '/market', icon: BarChart3, label: 'Market Watch', tKey: 'nav.market' },
      { to: '/grading', icon: Award, label: 'Grading', tKey: 'nav.grading', authOnly: true },
    ],
  },
  {
    key: 'community',
    tKey: 'nav.moreCommunity',
    items: [
      { to: '/circles-directory', icon: Network, label: 'Circle Directory', tKey: 'nav.circleDirectory' },
      { to: '/labelers', icon: Tag, label: 'Labelers', tKey: 'nav.labelers' },
      { to: '/circles', icon: Users, label: 'Circles', tKey: 'nav.circles' },
      { to: '/meetups', icon: CalendarDays, label: 'Meetups', tKey: 'nav.meetups' },
      { to: '/trust', icon: ShieldCheck, label: 'Trust', tKey: 'nav.trust' },
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
      { to: '/pack-parties', icon: Sparkles, label: 'Pack Parties', tKey: 'nav.packParties' },
      { to: '/pull-of-the-week', icon: Trophy, label: 'Pull of the Week', tKey: 'nav.pullOfTheWeek' },
      { to: '/packs', icon: Package, label: 'Pack Openings', tKey: 'nav.packOpenings' },
      { to: '/predictions', icon: Vote, label: 'Predictions', tKey: 'nav.predictions' },
      { to: '/spaces', icon: Radio, label: 'Live Now', tKey: 'nav.live' },
    ],
  },
  {
    key: 'account',
    tKey: 'nav.moreAccount',
    items: [
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

export default function LeftNav() {
  const { user, isAuthenticated, logout } = useAuth();
  const { liveByDid } = useLivePresence();
  const liveCount = liveByDid.size;
  const unread = useUnreadCount();
  const unreadDMs = useUnreadDMCount();
  const [showMore, setShowMore] = useState(false);
  const t = useT();

  const linkClass = ({ isActive }) =>
    `group flex items-center gap-4 rounded-full py-2.5 pl-3 pr-3 text-lg font-semibold transition-colors xl:pr-6 ${
      isActive ? 'text-primary' : 'text-foreground hover:bg-secondary'
    }`;

  return (
    <nav className="sticky top-0 hidden h-screen flex-col px-2 py-4 md:flex xl:px-3">
      <div className="mb-6 flex justify-center px-2 xl:justify-start">
        <NavLink to="/" aria-label="SwapPulse home">
          <Logo size={72} withText={true} />
        </NavLink>
      </div>
      <div className="flex flex-col items-center gap-1 xl:items-stretch">
        {primary.filter((i) => !i.authOnly || isAuthenticated).map((item) => {
          if (item.to === '/notifications') {
            return (
              <NotificationPopover
                key={item.to}
                side="right"
                align="start"
                trigger={
                  <PopoverTrigger asChild>
                    <button aria-label={t(item.tKey)} className={linkClass({ isActive: false })}>
                      <item.icon className="h-6 w-6 shrink-0" />
                      <span className="hidden xl:inline">{t(item.tKey)}</span>
                      {unread > 0 && (
                        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-white live-pulse">{unread}</span>
                      )}
                    </button>
                  </PopoverTrigger>
                }
              />
            );
          }
          return (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} aria-label={t(item.tKey)} className={linkClass}>
            <item.icon className="h-6 w-6 shrink-0" />
            <span className="hidden xl:inline">{t(item.tKey)}</span>
            {item.to === '/spaces' && liveCount > 0 && (
              <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-white">{liveCount}</span>
            )}
            {item.to === '/messages' && unreadDMs > 0 && (
              <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">{unreadDMs}</span>
            )}
          </NavLink>
          );
        })}

        <Dialog open={showMore} onOpenChange={setShowMore}>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label={t('nav.more')}
              aria-haspopup="dialog"
              aria-expanded={showMore}
              className="group flex items-center gap-4 rounded-full py-2.5 pl-3 pr-3 text-lg font-semibold text-foreground transition-colors hover:bg-secondary xl:pr-6"
            >
              <MoreHorizontal className="h-6 w-6 shrink-0" />
              <span className="hidden xl:inline">{t('nav.more')}</span>
            </button>
          </DialogTrigger>

          <DialogContent className="hidden max-h-[min(90dvh,52rem)] w-[calc(100vw-2rem)] max-w-5xl overflow-y-auto p-0 md:block">
            <div className="border-b border-border px-6 py-5 pr-16">
              <DialogTitle>{t('nav.more')}</DialogTitle>
              <DialogDescription className="sr-only">{t('nav.more')}</DialogDescription>
            </div>

            <div className="grid gap-6 p-6 md:grid-cols-2 xl:grid-cols-3">
              {moreGroups.map((group) => {
                const visibleItems = group.items.filter(
                  (item) => (!item.authOnly || isAuthenticated) && (!item.adminOnly || user?.role === 'admin'),
                );
                if (visibleItems.length === 0) return null;

                return (
                  <section key={group.key} aria-labelledby={`desktop-more-${group.key}`}>
                    <h3
                      id={`desktop-more-${group.key}`}
                      className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                    >
                      {t(group.tKey)}
                    </h3>
                    <div className="grid gap-2">
                      {visibleItems.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setShowMore(false)}
                          aria-label={t(item.tKey)}
                          className={({ isActive }) =>
                            `relative flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                              isActive
                                ? 'border-primary/40 bg-primary/10 text-primary'
                                : 'border-transparent text-foreground hover:border-border hover:bg-secondary'
                            }`
                          }
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span>{t(item.tKey)}</span>
                          {item.to === '/spaces' && liveCount > 0 && (
                            <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-white">
                              {liveCount}
                            </span>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            {isAuthenticated && (
              <div className="flex justify-end border-t border-border px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowMore(false);
                    logout();
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                >
                  <LogOut className="h-5 w-5" />
                  {t('nav.logout')}
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      <div className="mt-auto flex flex-col items-center gap-2 pt-4 xl:items-stretch">
        <div className="flex justify-center gap-1 xl:justify-start xl:px-3">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
        {isAuthenticated ? (
          <NavLink
            to="/profile"
            aria-label={t('nav.profile')}
            className="flex items-center gap-3 rounded-full p-1.5 transition-colors hover:bg-secondary xl:pr-4"
          >
            <Avatar name={user?.full_name} src={user?.avatar} size={36} />
            <div className="hidden xl:block min-w-0">
              <p className="truncate text-sm font-semibold">{user?.full_name || t('common.collector')}</p>
              <p className="truncate text-xs text-muted-foreground">{t('nav.profile')}</p>
            </div>
          </NavLink>
        ) : (
          <NavLink
            to="/login"
            aria-label={t('nav.login')}
            className="flex items-center gap-3 rounded-full bg-primary p-2 text-primary-foreground transition-colors hover:bg-primary/90 xl:px-4 xl:pr-6"
          >
            <LogIn className="h-5 w-5 shrink-0" />
            <span className="hidden xl:inline text-sm font-semibold">{t('nav.login')}</span>
          </NavLink>
        )}
      </div>
    </nav>
  );
}