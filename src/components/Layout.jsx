import React from 'react';
import { Outlet } from 'react-router-dom';
import LeftNav from '@/components/LeftNav';
import RightSidebar from '@/components/RightSidebar';
import MobileNav from '@/components/MobileNav';
import RealtimeToaster from '@/components/RealtimeToaster';
import BellToaster from '@/components/follow/BellToaster';
import { usePresence } from '@/hooks/usePresence';

export default function Layout() {
  const online = usePresence();
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1400px]">
      <div className="hidden w-[72px] shrink-0 md:block xl:w-[240px]">
        <LeftNav />
      </div>
      <main className="min-w-0 flex-1 border-x border-border pb-20 md:pb-0">
        <Outlet />
      </main>
      <div className="hidden w-80 shrink-0 lg:block">
        <RightSidebar online={online} />
      </div>
      <MobileNav />
      <RealtimeToaster />
      <BellToaster />
    </div>
  );
}