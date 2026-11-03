import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Compass,
  Search,
  Bookmark,
  Clock,
  Shield,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { Logo } from '../common/Logo';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { isAdmin } = useAuth();

  const navItems = [
    { to: '/', label: 'হোম', icon: Home, end: true },
    { to: '/browse', label: 'ক্যাটাগরি ব্রাউজ', icon: Compass },
    { to: '/search', label: 'অনুসন্ধান', icon: Search },
    { to: '/favorites', label: 'পছন্দসমূহ', icon: Bookmark },
    { to: '/recent', label: 'সম্প্রতি শোনা', icon: Clock },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full py-6 px-1 text-sm">
      {/* Mobile Drawer Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E6E7E2] dark:border-[#233128] md:hidden px-2">
        <Logo size="sm" />
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#777C77] hover:text-[#171A18] dark:hover:text-[#F3F4EF]"
          aria-label="বন্ধ করুন"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main Navigation Links */}
      <nav className="space-y-1">
        <div className="px-3 pb-2 text-[11px] font-medium tracking-wider text-[#777C77] dark:text-[#A4ADA6] uppercase">
          লাইব্রেরি
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap',
                  isActive
                    ? 'text-[#176B50] dark:text-[#48A783] bg-[#F0F1ED] dark:bg-[#19231D] font-medium'
                    : 'text-[#777C77] dark:text-[#A4ADA6] hover:text-[#171A18] dark:hover:text-[#F3F4EF] hover:bg-[#F0F1ED]/50 dark:hover:bg-[#19231D]/50'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Admin Link - Only visible to authenticated administrators */}
      {isAdmin && (
        <div className="mt-8 pt-4 border-t border-[#E6E7E2]/60 dark:border-[#233128]/60 space-y-1">
          <NavLink
            to="/admin"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors whitespace-nowrap',
                isActive
                  ? 'text-[#176B50] dark:text-[#48A783] bg-[#F0F1ED] dark:bg-[#19231D] font-medium'
                  : 'text-[#777C77] dark:text-[#A4ADA6] hover:text-[#171A18] dark:hover:text-[#F3F4EF]'
              )
            }
          >
            <Shield className="h-4 w-4 shrink-0" />
            <span>অ্যাডমিন ড্যাশবোর্ড</span>
          </NavLink>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Minimal Sidebar */}
      <aside className="hidden md:block w-52 shrink-0 h-[calc(100vh-64px)] sticky top-16 z-20 overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          <div className="fixed inset-y-0 left-0 w-64 max-w-[80vw] z-50 bg-[#FAFAF8] dark:bg-[#101713] p-5 shadow-lg animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
