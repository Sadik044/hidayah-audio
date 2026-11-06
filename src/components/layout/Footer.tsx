
import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../common/Logo';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto w-full border-t border-[#E6E7E2] dark:border-[#233128] bg-transparent transition-colors">
      <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12 pt-6 pb-28 sm:py-7">

        <div className="flex flex-col items-center gap-3">
          <Link
            to="/"
            aria-label="হিদায়াহ অডিও হোম"
            className="hover:opacity-80 transition-opacity"
          >
            <Logo size="sm" />
          </Link>

          <p className="max-w-md text-center text-xs sm:text-sm leading-relaxed text-[#777C77] dark:text-[#A4ADA6]">
            সহীহ সুন্নাহর আলোকে নির্বাচিত ধারাবাহিক অডিও ও আলোচনা
          </p>
        </div>

        <div className="mt-5 border-t border-[#E6E7E2] dark:border-[#233128] pt-4">
          <p className="text-center text-[11px] sm:text-xs leading-6 text-[#929792] dark:text-[#7F8A82]">
            © {new Date().getFullYear()} Hidayah Audio
            <span className="mx-1">·</span>
            "সংগৃহীত অডিও" এর সকল অধিকার সংরক্ষিত।
          </p>
        </div>

      </div>
    </footer>
  );
};
