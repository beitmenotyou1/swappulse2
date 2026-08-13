import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Compass, Layers, ArrowLeftRight, Package, BarChart3, Award, BookOpen, ShieldCheck, Shield, ShieldAlert, Vote, Users, CalendarDays, User as UserIcon, ChevronDown, Radio, Bell, Settings as SettingsIcon, HelpCircle, Heart, ScanLine, UserPlus, Trophy, Target, LogIn } from 'lucide-react';
import Logo from '@/components/Logo';
import Avatar from '@/components/Avatar';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/lib/AuthContext';
import { useLivePresence } from '@/lib/livePresence';
import { useUnreadCount } from '@/hooks/useNotifications';

const primary = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/explore', icon: Compass, label: 'Explore' },
  { to: '/collection', icon: Layers, label: 'Collection', authOnly: true },
  { to: '/scan', icon: ScanLine, label: 'Scan Cards', authOnly: true },
  { to: '/binders', icon: BookOpen, label: 'Binders' },
  { to: '/trades', icon: ArrowLeftRight, label: 'Trade Board' },
  { to: '/circles', icon: Users, label: 'Circles' },
  { to: '/meetups', icon: CalendarDays, label: 'Meetups' },
  { to: '/spaces', icon: Radio, label: 'Live Now' },
  { to: '/notifications', icon: Bell, label: 'Notifications', authOnly: true },
];

const more = [
  { to: '/trust', icon: ShieldCheck, label: 'Trust' },
  { to: '/who-to-follow', icon: UserPlus, label: 'Who to Follow', authOnly: true },
  { to: '/achievements', icon: Trophy, label: 'Achievements', authOnly: true },
  { to: '/challenges', icon: Target, label: 'Challenges' },
  { to: '/packs', icon: Package, label: 'Pack Openings' },
  { to: '/market', icon: BarChart3, label: 'Market Watch' },
  { to: '/predictions', icon: Vote, label: 'Predictions' },
  { to: '/grading', icon: Award, label: 'Grading', authOnly: true },
  { to: '/help', icon: HelpCircle, label: 'Help & Info' },
  { to: '/donate', icon: Heart, label: 'Donate' },
  { to: '/admin', icon: Shield, label: 'Admin', adminOnly: true },
  { to: '/moderation', icon: ShieldAlert, label: 'Moderation', adminOnly: true },
  { to: '/settings', icon: SettingsIcon, label: 'Settings', authOnly: true },
];

export default function LeftNav() {
  const { user, isAuthenticated } = useAuth();
  const { liveByDid } = useLivePresence();
  const liveCount = liveByDid.size;
  const unread = useUnreadCount();
  const [showMore, setShowMore] = useState(false);

  const linkClass = ({ isActive }) =>
    `group flex items-center gap-4 rounded-full py-2.5 pl-3 pr-3 text-lg font-semibold transition-colors xl:pr-6 ${
      isActive ? 'text-primary' : 'text-foreground hover:bg-secondary'
    }`;

  return (
    <nav className="sticky top-0 hidden h-screen flex-col px-2 py-4 md:flex xl:px-3">
      <div className="mb-6 flex justify-center px-2 xl:justify-start">
        <NavLink to="/" aria-label="SwapPulse home">
          <Logo size={40} withText={false} />
        </NavLink>
      </div>
      <div className="flex flex-col items-center gap-1 xl:items-stretch">
        {primary.filter((i) => !i.authOnly || isAuthenticated).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} aria-label={item.label} className={linkClass}>
            <item.icon className="h-6 w-6 shrink-0" />
            <span className="hidden xl:inline">{item.label}</span>
            {item.to === '/spaces' && liveCount > 0 && (
              <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-white">{liveCount}</span>
            )}
            {item.to === '/notifications' && unread > 0 && (
              <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-white live-pulse">{unread}</span>
            )}
          </NavLink>
        ))}

        <button
          onClick={() => setShowMore((v) => !v)}
          aria-label="More navigation"
          aria-expanded={showMore}
          className="group flex items-center gap-4 rounded-full py-2.5 pl-3 pr-3 text-lg font-semibold text-foreground transition-colors hover:bg-secondary xl:pr-6"
        >
          <ChevronDown className={`h-6 w-6 shrink-0 transition-transform ${showMore ? 'rotate-180' : ''}`} />
          <span className="hidden xl:inline">More</span>
        </button>

        {showMore && (
          <div className="flex flex-col items-center gap-1 border-l border-border pl-2 xl:items-stretch xl:pl-3">
            {more.filter((i) => (!i.authOnly || isAuthenticated) && (!i.adminOnly || user?.role === 'admin')).map((item) => (
              <NavLink key={item.to} to={item.to} aria-label={item.label} className={linkClass}>
                <item.icon className="h-6 w-6 shrink-0" />
                <span className="hidden xl:inline">{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
      <div className="mt-auto flex flex-col items-center gap-2 pt-4 xl:items-stretch">
        <div className="flex justify-center xl:justify-start xl:px-3">
          <ThemeToggle />
        </div>
        {isAuthenticated ? (
          <NavLink
            to="/profile"
            aria-label="View profile"
            className="flex items-center gap-3 rounded-full p-1.5 transition-colors hover:bg-secondary xl:pr-4"
          >
            <Avatar name={user?.full_name} src={user?.avatar_url} size={36} />
            <div className="hidden xl:block min-w-0">
              <p className="truncate text-sm font-semibold">{user?.full_name || 'Collector'}</p>
              <p className="truncate text-xs text-muted-foreground">View profile</p>
            </div>
          </NavLink>
        ) : (
          <NavLink
            to="/login"
            aria-label="Log in"
            className="flex items-center gap-3 rounded-full bg-primary p-2 text-primary-foreground transition-colors hover:bg-primary/90 xl:px-4 xl:pr-6"
          >
            <LogIn className="h-5 w-5 shrink-0" />
            <span className="hidden xl:inline text-sm font-semibold">Log in</span>
          </NavLink>
        )}
      </div>
    </nav>
  );
}