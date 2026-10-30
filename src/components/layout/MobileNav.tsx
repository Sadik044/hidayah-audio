import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Compass, Search, Bookmark, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

export const MobileNav: React.FC = () => {
  const items = [
    { to: '/', label: 'হোম', icon: Home, end: true },
    { to: '/browse', label: 'ব্রাউজ', icon: Compass },
    { to: '/search', label: 'অনুসন্ধান', icon: Search },
    { to: '/favorites', label: 'পছন্দ', icon: Bookmark },
    { to: '/recent', label: 'ইতিহাস', icon: Clock },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#FAFAF8]/95 dark:bg-[#101713]/95 backdrop-blur-md border-t border-[#E6E7E2] dark:border-[#233128] px-2 py-1.5 transition-colors">
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center py-1 px-3 rounded-md text-xs transition-colors min-w-[3.5rem]',
                  isActive
                    ? 'text-[#176B50] dark:text-[#48A783] font-medium'
                    : 'text-[#777C77] dark:text-[#A4ADA6] hover:text-[#171A18] dark:hover:text-[#F3F4EF]'
                )
              }
            >
              <Icon className="h-4 w-4 mb-0.5" />
              <span className="text-[11px] leading-tight">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
