
import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../common/Logo';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto w-full border-t border-[#E8EBE7] bg-white dark:border-[#26352C] dark:bg-[#101A14] transition-colors duration-300">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* Brand */}
        <Link
          to="/"
          aria-label="হিদায়াহ অডিও হোম"
          className="transition-opacity hover:opacity-80"
        >
          <Logo size="sm" />
        </Link>

        {/* Description */}
        <p className="mt-3 max-w-sm text-center text-xs leading-6 text-[#777F78] dark:text-[#A4ADA6] sm:text-sm">
          সহীহ সুন্নাহর আলোকে নির্বাচিত ধারাবাহিক অডিও ও আলোচনা
        </p>

        {/* Copyright */}
        <div className="mt-5 w-full border-t border-[#EEF0ED] pt-4 text-center dark:border-[#26352C]">
          <p className="text-[11px] text-[#929A93] dark:text-[#7F8A82] sm:text-xs">
            © {new Date().getFullYear()} Hidayah Audio
            <span className="mx-2">·</span>
            "সংগৃহীত অডিও" এর সকল অধিকার সংরক্ষিত। <br className="sm:hidden" />
          </p>
        </div>

      </div>
    </footer>
  );
};
