import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, Layers, ArrowLeftRight, BookOpen, ShieldCheck, Shield, ShieldAlert, Vote, Users, CalendarDays, Award, Package, BarChart3, MoreHorizontal, X, User as UserIcon, Plus, Radio, Bell, MessageSquare, Settings as SettingsIcon, HelpCircle, Heart, ScanLine, UserPlus, Trophy, Target, LogOut, Sparkles, FileText, Lock, Activity } from 'lucide-react';
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
  { to: '/', icon: Home, label: 'Home' },
  { to: '/explore', icon: Compass, label: 'Explore' },
  { to: '/trades', icon: ArrowLeftRight, label: 'Trades' },
  { to: '/collection', icon: Layers, label: 'Collection', authOnly: true },
];

const moreItems = [
  { to: '/binders', icon: BookOpen, label: 'Binders' },
  { to: '/scan', icon: ScanLine, label: 'Scan', authOnly: true },
  { to: '/circles', icon: Users, label: 'Circles' },
  { to: '/meetups', icon: CalendarDays, label: 'Meetups' },
  { to: '/trust', icon: ShieldCheck, label: 'Trust' },
  { to: '/who-to-follow', icon: UserPlus, label: 'Who to Follow', authOnly: true },
  { to: '/achievements', icon: Trophy, label: 'Achievements', authOnly: true },
  { to: '/challenges', icon: Target, label: 'Challenges' },
  { to: '/pack-parties', icon: Sparkles, label: 'Parties' },
  { to: '/pull-of-the-week', icon: Trophy, label: 'Pull of Week' },
  { to: '/packs', icon: Package, label: 'Packs' },
  { to: '/market', icon: BarChart3, label: 'Market' },
  { to: '/predictions', icon: Vote, label: 'Polls' },
  { to: '/grading', icon: Award, label: 'Grading', authOnly: true },
  { to: '/spaces', icon: Radio, label: 'Live' },
  { to: '/notifications', icon: Bell, label: 'Alerts', authOnly: true },
  { to: '/messages', icon: MessageSquare, label: 'Messages', authOnly: true },
  { to: '/help', icon: HelpCircle, label: 'Help' },
  { to: '/terms', icon: FileText, label: 'Terms' },
  { to: '/privacy', icon: Lock, label: 'Privacy' },
  { to: '/status', icon: Activity, label: 'Status' },
  { to: '/donate', icon: Heart, label: 'Donate' },
  { to: '/admin', icon: Shield, label: 'Admin', adminOnly: true },
  { to: '/moderation', icon: ShieldAlert, label: 'Moderation', adminOnly: true },
  { to: '/settings', icon: SettingsIcon, label: 'Settings', authOnly: true },
  { to: '/profile', icon: UserIcon, label: 'Profile', authOnly: true },
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
              {item.label}
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
                            {item.label}
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
                    {item.label}
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