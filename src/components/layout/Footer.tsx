import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../common/Logo';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-[#E6E7E2] dark:border-[#233128] py-8 transition-colors">
      <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#777C77] dark:text-[#A4ADA6]">
        {/* Brand and tagline */}
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left">
          <Link to="/" className="hover:opacity-90 transition-opacity">
            <Logo size="sm" />
          </Link>
          <span className="hidden sm:inline text-[#E6E7E2] dark:text-[#233128]">|</span>
          <p className="text-xs">
            সহীহ সুন্নাহর আলোকে নির্বাচিত ধারাবাহিক অডিও ও আলোচনা
          </p>
        </div>
        
        {/* Copyright */}
        <div className="text-[11px]">
          © {new Date().getFullYear()} Hidayah Audio "সংগৃহীত অডিও"
        </div>
      </div>
    </footer>
  );
};