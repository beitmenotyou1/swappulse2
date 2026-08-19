import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, Layers, ArrowLeftRight, BookOpen, ShieldCheck, Shield, ShieldAlert, Vote, Users, CalendarDays, Award, Package, BarChart3, MoreHorizontal, X, User as UserIcon, Plus, Radio, Bell, MessageSquare, Settings as SettingsIcon, HelpCircle, Heart, UserPlus, Trophy, Target, LogOut, Sparkles, FileText, Lock, Activity } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { useLivePresence } from '@/lib/livePresence';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useUnreadDMCount } from '@/hooks/useUnreadDMCount';
import { useAuth } from '@/lib/AuthContext';
import { PopoverTrigger } from '@/components/ui/popover';
import NotificationPopover from '@/components/notifications/NotificationPopover';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useT } from '@/lib/i18n/I18nProvider';

const primary = [
  { to: '/', icon: Home, label: 'Home', tKey: 'nav.home' },
  { to: '/explore', icon: Compass, label: 'Explore', tKey: 'nav.explore' },
  { to: '/trades', icon: ArrowLeftRight, label: 'Trades', tKey: 'nav.trades' },
  { to: '/collection', icon: Layers, label: 'Collection', tKey: 'nav.collection', authOnly: true },
];

const moreItems = [
  { to: '/binders', icon: BookOpen, label: 'Binders', tKey: 'nav.binders' },
  { to: '/circles', icon: Users, label: 'Circles', tKey: 'nav.circles' },
  { to: '/meetups', icon: CalendarDays, label: 'Meetups', tKey: 'nav.meetups' },
  { to: '/trust', icon: ShieldCheck, label: 'Trust', tKey: 'nav.trust' },
  { to: '/who-to-follow', icon: UserPlus, label: 'Who to Follow', tKey: 'nav.whoToFollow', authOnly: true },
  { to: '/achievements', icon: Trophy, label: 'Achievements', tKey: 'nav.achievements', authOnly: true },
  { to: '/challenges', icon: Target, label: 'Challenges', tKey: 'nav.challenges' },
  { to: '/pack-parties', icon: Sparkles, label: 'Parties', tKey: 'nav.packParties' },
  { to: '/pull-of-the-week', icon: Trophy, label: 'Pull of Week', tKey: 'nav.pullOfTheWeek' },
  { to: '/packs', icon: Package, label: 'Packs', tKey: 'nav.packOpenings' },
  { to: '/market', icon: BarChart3, label: 'Market', tKey: 'nav.market' },
  { to: '/predictions', icon: Vote, label: 'Polls', tKey: 'nav.predictions' },
  { to: '/grading', icon: Award, label: 'Grading', tKey: 'nav.grading', authOnly: true },
  { to: '/spaces', icon: Radio, label: 'Live', tKey: 'nav.live' },
  { to: '/notifications', icon: Bell, label: 'Alerts', tKey: 'nav.notifications', authOnly: true },
  { to: '/messages', icon: MessageSquare, label: 'Messages', tKey: 'nav.messages', authOnly: true },
  { to: '/help', icon: HelpCircle, label: 'Help', tKey: 'nav.help' },
  { to: '/terms', icon: FileText, label: 'Terms', tKey: 'nav.terms' },
  { to: '/privacy', icon: Lock, label: 'Privacy', tKey: 'nav.privacy' },
  { to: '/status', icon: Activity, label: 'Status', tKey: 'nav.status' },
  { to: '/donate', icon: Heart, label: 'Donate', tKey: 'nav.donate' },
  { to: '/admin', icon: Shield, label: 'Admin', tKey: 'nav.admin', adminOnly: true },
  { to: '/moderation', icon: ShieldAlert, label: 'Moderation', tKey: 'nav.moderation', adminOnly: true },
  { to: '/settings', icon: SettingsIcon, label: 'Settings', tKey: 'nav.settings', authOnly: true },
  { to: '/profile', icon: UserIcon, label: 'Profile', tKey: 'nav.profile', authOnly: true },
];

export default function MobileNav() {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { liveByDid } = useLivePresence();
  const liveCount = liveByDid.size;
  const unread = useUnreadCount();
  const unreadDMs = useUnreadDMCount();
  const { user, isAuthenticated, logout } = useAuth();
  const t = useT();
  const activeInMore = moreItems.some((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)));

  return (
    <>
      {isAuthenticated && (
        <Link
          to="/compose"
          className="fixed bottom-20 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 transition-transform active:scale-95 md:hidden"
          aria-label="Compose"
        >
          <Plus className="h-7 w-7" />
        </Link>
      )}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-background/95 px-1 py-1.5 backdrop-blur md:hidden">
        {primary.filter((i) => !i.authOnly || isAuthenticated).map((item) => {
          const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
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
          onClick={() => setMoreOpen(true)}
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
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="absolute bottom-0 left-0 right-0 animate-slide-up rounded-t-2xl border-t border-border bg-card p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-sm font-bold">{t('nav.more')}</p>
              <button onClick={() => setMoreOpen(false)} aria-label="Close" className="rounded-full p-1 hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-3">
              <LanguageSwitcher />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {moreItems.filter((i) => (!i.authOnly || isAuthenticated) && (!i.adminOnly || user?.role === 'admin')).map((item) => {
                const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
                if (item.to === '/notifications') {
                  return (
                    <NotificationPopover
                      key={item.to}
                      side="top"
                      align="center"
                      onNavigate={() => setMoreOpen(false)}
                      trigger={
                        <PopoverTrigger asChild>
                          <button
                            className={`relative flex flex-col items-center gap-1 rounded-xl p-2.5 text-[11px] font-medium transition-colors hover:bg-secondary ${
                              active ? 'text-primary' : 'text-foreground'
                            }`}
                          >
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
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className={`relative flex flex-col items-center gap-1 rounded-xl p-2.5 text-[11px] font-medium transition-colors hover:bg-secondary ${
                      active ? 'text-primary' : 'text-foreground'
                    }`}
                  >
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
              })}
              {isAuthenticated && (
                <button
                  onClick={() => { setMoreOpen(false); logout(); }}
                  className="flex flex-col items-center gap-1 rounded-xl p-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <LogOut className="h-5 w-5" />
                  {t('nav.logout')}
                </button>
              )}
            </div>
            <p className="mt-3 px-1 text-[11px] font-medium text-muted-foreground">
              © SwapPulse - Built on the AT Protocol · Powered by TCGdex
            </p>
            <p className="mt-1.5 px-1 text-[10px] leading-relaxed text-muted-foreground/70">
              SwapPulse is a free, open-source platform. Pokémon and Pokémon TCG are trademarks of Nintendo, Game Freak, and The Pokémon Company. SwapPulse is not affiliated with or endorsed by them.
            </p>
          </div>
        </div>
      )}
    </>
  );
}