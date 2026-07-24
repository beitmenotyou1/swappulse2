import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Compass, Layers, ArrowLeftRight, Package, BarChart3, User as UserIcon } from 'lucide-react';
import Logo from '@/components/Logo';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/lib/AuthContext';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/explore', icon: Compass, label: 'Explore' },
  { to: '/collection', icon: Layers, label: 'Collection' },
  { to: '/trades', icon: ArrowLeftRight, label: 'Trade Board' },
  { to: '/packs', icon: Package, label: 'Pack Openings' },
  { to: '/market', icon: BarChart3, label: 'Market Watch' },
  { to: '/profile', icon: UserIcon, label: 'Profile' },
];

export default function LeftNav() {
  const { user } = useAuth();

  return (
    <nav className="sticky top-0 hidden h-screen flex-col px-2 py-4 md:flex xl:px-3">
      <div className="mb-6 flex justify-center px-2 xl:justify-start">
        <NavLink to="/">
          <Logo size={40} withText={false} />
        </NavLink>
      </div>
      <div className="flex flex-col items-center gap-1 xl:items-stretch">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `group flex items-center gap-4 rounded-full py-2.5 pl-3 pr-3 text-lg font-semibold transition-colors xl:pr-6 ${
                isActive
                  ? 'text-primary'
                  : 'text-foreground hover:bg-secondary'
              }`
            }
          >
            <item.icon className="h-6 w-6 shrink-0" />
            <span className="hidden xl:inline">{item.label}</span>
          </NavLink>
        ))}
      </div>
      <div className="mt-auto flex flex-col items-center gap-2 pt-4 xl:items-stretch">
        <NavLink
          to="/profile"
          className="flex items-center gap-3 rounded-full p-1.5 transition-colors hover:bg-secondary xl:pr-4"
        >
          <Avatar name={user?.full_name} src={user?.avatar_url} size={36} />
          <div className="hidden xl:block min-w-0">
            <p className="truncate text-sm font-semibold">{user?.full_name || 'Collector'}</p>
            <p className="truncate text-xs text-muted-foreground">View profile</p>
          </div>
        </NavLink>
      </div>
    </nav>
  );
}