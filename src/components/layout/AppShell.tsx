import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { Footer } from './Footer';
import { MiniPlayer } from '../player/MiniPlayer';
import { FullPlayer } from '../player/FullPlayer';

export const AppShell: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF8] dark:bg-[#101713] text-[#171A18] dark:text-[#F3F4EF] transition-colors overflow-x-hidden">
      <Header onToggleSidebar={() => setSidebarOpen(true)} />

      <div className="flex-1 flex w-full max-w-page mx-auto px-4 sm:px-8 lg:px-12 gap-6 sm:gap-8 lg:gap-10">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 flex flex-col min-w-0 py-6 sm:py-8 pb-36 md:pb-28">
          <Outlet />
        </main>
      </div>

      <Footer />
      <MiniPlayer />
      <FullPlayer />
      <MobileNav />
    </div>
  );
};
