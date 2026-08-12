import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, Layers, ArrowLeftRight, BookOpen, ShieldCheck, Vote, Users, CalendarDays, Award, Package, BarChart3, MoreHorizontal, X, User as UserIcon, Plus, Radio, Bell, Settings as SettingsIcon, HelpCircle, Heart } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { useLivePresence } from '@/lib/livePresence';
import { useUnreadCount } from '@/hooks/useNotifications';

const primary = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/explore', icon: Compass, label: 'Explore' },
  { to: '/trades', icon: ArrowLeftRight, label: 'Trades' },
  { to: '/collection', icon: Layers, label: 'Collection' },
];

const moreItems = [
  { to: '/binders', icon: BookOpen, label: 'Binders' },
  { to: '/circles', icon: Users, label: 'Circles' },
  { to: '/meetups', icon: CalendarDays, label: 'Meetups' },
  { to: '/trust', icon: ShieldCheck, label: 'Trust' },
  { to: '/packs', icon: Package, label: 'Packs' },
  { to: '/market', icon: BarChart3, label: 'Market' },
  { to: '/predictions', icon: Vote, label: 'Polls' },
  { to: '/grading', icon: Award, label: 'Grading' },
  { to: '/spaces', icon: Radio, label: 'Live' },
  { to: '/notifications', icon: Bell, label: 'Alerts' },
  { to: '/help', icon: HelpCircle, label: 'Help' },
  { to: '/donate', icon: Heart, label: 'Donate' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
  { to: '/profile', icon: UserIcon, label: 'Profile' },
];

export default function MobileNav() {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { liveByDid } = useLivePresence();
  const liveCount = liveByDid.size;
  const unread = useUnreadCount();
  const activeInMore = moreItems.some((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)));

  return (
    <>
      <Link
        to="/compose"
        className="fixed bottom-20 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 transition-transform active:scale-95 md:hidden"
        aria-label="Compose"
      >
        <Plus className="h-7 w-7" />
      </Link>
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-background/95 px-1 py-1.5 backdrop-blur md:hidden">
        {primary.map((item) => {
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
          More
        </button>
        <ThemeToggle className="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium text-muted-foreground h-auto w-auto rounded-lg hover:bg-transparent" />
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="absolute bottom-0 left-0 right-0 animate-slide-up rounded-t-2xl border-t border-border bg-card p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-sm font-bold">More</p>
              <button onClick={() => setMoreOpen(false)} aria-label="Close" className="rounded-full p-1 hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {moreItems.map((item) => {
                const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
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
                    {item.to === '/notifications' && unread > 0 && (
                      <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">{unread}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}