import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Moon, Sun, Shield, Menu } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { Logo } from '../common/Logo';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 w-full backdrop-blur-md bg-[#FAFAF8]/90 dark:bg-[#101713]/90 border-b border-[#E6E7E2] dark:border-[#233128] transition-colors">
      <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile menu toggle & Brand Logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-lg text-[#777C77] dark:text-[#A4ADA6] hover:text-[#171A18] dark:hover:text-[#F3F4EF] hover:bg-[#F0F1ED] dark:hover:bg-[#19231D] transition-colors"
            aria-label="মেনু খুলুন"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link to="/" className="flex items-center group">
            <Logo size="md" />
          </Link>
        </div>

        {/* Center: Search trigger with minimal styling */}
        <div className="hidden sm:flex flex-1 max-w-sm mx-4">
          <div
            onClick={() => navigate('/search')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/search')}
            className="w-full flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#F0F1ED] dark:bg-[#19231D] text-[#777C77] dark:text-[#A4ADA6] text-xs cursor-pointer hover:text-[#171A18] dark:hover:text-[#F3F4EF] transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span>সিরিজ বা অডিও অনুসন্ধান করুন...</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mobile search trigger */}
          <Link
            to="/search"
            className="sm:hidden p-2 rounded-lg text-[#777C77] dark:text-[#A4ADA6] hover:bg-[#F0F1ED] dark:hover:bg-[#19231D] transition-colors"
            aria-label="অনুসন্ধান"
          >
            <Search className="h-4 w-4" />
          </Link>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg text-[#777C77] dark:text-[#A4ADA6] hover:text-[#171A18] dark:hover:text-[#F3F4EF] hover:bg-[#F0F1ED] dark:hover:bg-[#19231D] transition-colors"
            title={theme === 'dark' ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন'}
            aria-label="থিম পরিবর্তন"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-[#A4ADA6]" />
            ) : (
              <Moon className="h-4 w-4 text-[#777C77]" />
            )}
          </button>

          {/* Admin access */}
          {user ? (
            <div className="flex items-center gap-1.5">
              {isAdmin && (
                <Link to="/admin">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-[#176B50] dark:text-[#48A783]">
                    <Shield className="h-3.5 w-3.5" />
                    <span>অ্যাডমিন</span>
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="text-xs text-[#777C77] hover:text-red-600 dark:hover:text-red-400"
              >
                লগআউট
              </Button>
            </div>
          ) : (
            <Link to="/admin/login">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-[#777C77] dark:text-[#A4ADA6] hover:text-[#171A18] dark:hover:text-[#F3F4EF]"
              >
                <Shield className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">অ্যাডমিন প্রবেশ</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
