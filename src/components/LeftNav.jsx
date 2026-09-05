import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Compass, Layers, ArrowLeftRight, Package, BarChart3, Award, BookOpen, ShieldCheck, Shield, ShieldAlert, Vote, Users, CalendarDays, ChevronDown, Radio, Bell, MessageSquare, Settings as SettingsIcon, Heart, UserPlus, Trophy, Target, LogIn, LogOut, Sparkles, Rss, Box, Tag, Search, Network, Wallet as WalletIcon } from 'lucide-react';
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
import { useT } from '@/lib/i18n/I18nProvider';

const primary = [
  { to: '/', icon: Home, label: 'Home', tKey: 'nav.home' },
  { to: '/explore', icon: Compass, label: 'Explore', tKey: 'nav.explore' },
  { to: '/collection', icon: Layers, label: 'Collection', tKey: 'nav.collection', authOnly: true },
  { to: '/wallet', icon: WalletIcon, label: 'SwapPulse Wallet', tKey: 'nav.chainWallet', authOnly: true },
  { to: '/binders', icon: BookOpen, label: 'Binders', tKey: 'nav.binders' },
  { to: '/trades', icon: ArrowLeftRight, label: 'Trade Board', tKey: 'nav.trades' },
  { to: '/circles', icon: Users, label: 'Circles', tKey: 'nav.circles' },
  { to: '/meetups', icon: CalendarDays, label: 'Meetups', tKey: 'nav.meetups' },
  { to: '/spaces', icon: Radio, label: 'Live Now', tKey: 'nav.live' },
  { to: '/notifications', icon: Bell, label: 'Notifications', tKey: 'nav.notifications', authOnly: true },
  { to: '/messages', icon: MessageSquare, label: 'Messages', tKey: 'nav.messages', authOnly: true },
];

const more = [
  { to: '/search', icon: Search, label: 'Search', tKey: 'nav.search' },
  { to: '/feeds', icon: Rss, label: 'Feeds', tKey: 'nav.feeds' },
  { to: '/starter-packs', icon: Box, label: 'Starter Packs', tKey: 'nav.starterPacks' },
  { to: '/circles-directory', icon: Network, label: 'Circle Directory', tKey: 'nav.circleDirectory' },
  { to: '/labelers', icon: Tag, label: 'Labelers', tKey: 'nav.labelers' },
  { to: '/trust', icon: ShieldCheck, label: 'Trust', tKey: 'nav.trust' },
  { to: '/who-to-follow', icon: UserPlus, label: 'Who to Follow', tKey: 'nav.whoToFollow', authOnly: true },
  { to: '/achievements', icon: Trophy, label: 'Achievements', tKey: 'nav.achievements', authOnly: true },
  { to: '/challenges', icon: Target, label: 'Challenges', tKey: 'nav.challenges' },
  { to: '/pack-parties', icon: Sparkles, label: 'Pack Parties', tKey: 'nav.packParties' },
  { to: '/pull-of-the-week', icon: Trophy, label: 'Pull of the Week', tKey: 'nav.pullOfTheWeek' },
  { to: '/packs', icon: Package, label: 'Pack Openings', tKey: 'nav.packOpenings' },
  { to: '/market', icon: BarChart3, label: 'Market Watch', tKey: 'nav.market' },
  { to: '/predictions', icon: Vote, label: 'Predictions', tKey: 'nav.predictions' },
  { to: '/grading', icon: Award, label: 'Grading', tKey: 'nav.grading', authOnly: true },
  { to: '/donate', icon: Heart, label: 'Donate', tKey: 'nav.donate' },
  { to: '/admin', icon: Shield, label: 'Admin', tKey: 'nav.admin', adminOnly: true },
  { to: '/moderation', icon: ShieldAlert, label: 'Moderation', tKey: 'nav.moderation', adminOnly: true },
  { to: '/settings', icon: SettingsIcon, label: 'Settings', tKey: 'nav.settings', authOnly: true },
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

        <button
          onClick={() => setShowMore((v) => !v)}
          aria-label={t('nav.more')}
          aria-expanded={showMore}
          className="group flex items-center gap-4 rounded-full py-2.5 pl-3 pr-3 text-lg font-semibold text-foreground transition-colors hover:bg-secondary xl:pr-6"
        >
          <ChevronDown className={`h-6 w-6 shrink-0 transition-transform ${showMore ? 'rotate-180' : ''}`} />
          <span className="hidden xl:inline">{t('nav.more')}</span>
        </button>

        {showMore && (
          <div className="max-h-[calc(100dvh-26rem)] overflow-y-auto overscroll-contain flex flex-col items-center gap-1 border-l border-border pl-2 pr-1 xl:items-stretch xl:pl-3">
            {more.filter((i) => (!i.authOnly || isAuthenticated) && (!i.adminOnly || user?.role === 'admin')).map((item) => (
              <NavLink key={item.to} to={item.to} aria-label={t(item.tKey)} className={linkClass}>
                <item.icon className="h-6 w-6 shrink-0" />
                <span className="hidden xl:inline">{t(item.tKey)}</span>
              </NavLink>
            ))}
            {isAuthenticated && (
              <button
                onClick={() => logout()}
                aria-label={t('nav.logout')}
                className="group flex items-center gap-4 rounded-full py-2.5 pl-3 pr-3 text-lg font-semibold text-foreground transition-colors hover:bg-secondary xl:pr-6"
              >
                <LogOut className="h-6 w-6 shrink-0" />
                <span className="hidden xl:inline">{t('nav.logout')}</span>
              </button>
            )}
          </div>
        )}
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