import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, Layers, ArrowLeftRight, BarChart3, Award, Plus } from 'lucide-react';

const items = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/explore', icon: Compass, label: 'Explore' },
  { to: '/trades', icon: ArrowLeftRight, label: 'Trades' },
  { to: '/collection', icon: Layers, label: 'Collection' },
  { to: '/market', icon: BarChart3, label: 'Market' },
  { to: '/grading', icon: Award, label: 'Grading' },
];

export default function MobileNav() {
  const { pathname } = useLocation();
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
        {items.map((item) => {
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
      </nav>
    </>
  );
}