import React from 'react';
import { cn } from '../../lib/utils';

export interface LogoProps {
  className?: string;
  iconClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export const LogoIcon: React.FC<{ className?: string; size?: number }> = ({
  className,
  size = 32,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 transition-transform duration-200', className)}
      aria-hidden="true"
    >
      {/* 8-pointed Islamic Geometric Star (Rub el Hizb) */}
      <rect
        x="5.5"
        y="5.5"
        width="21"
        height="21"
        rx="4.5"
        className="fill-[#176B50] dark:fill-[#48A783]"
      />
      <rect
        x="5.5"
        y="5.5"
        width="21"
        height="21"
        rx="4.5"
        transform="rotate(45 16 16)"
        className="fill-[#176B50] dark:fill-[#48A783]"
      />

      {/* Integer-aligned Acoustic Audio Waves (Guidance + Sound Identity) */}
      <rect
        x="7"
        y="13"
        width="2"
        height="6"
        rx="1"
        className="fill-[#FAFAF8] dark:fill-[#101713]"
      />
      <rect
        x="11"
        y="10"
        width="2"
        height="12"
        rx="1"
        className="fill-[#FAFAF8] dark:fill-[#101713]"
      />
      <rect
        x="15"
        y="7"
        width="2"
        height="18"
        rx="1"
        className="fill-[#FAFAF8] dark:fill-[#101713]"
      />
      <rect
        x="19"
        y="10"
        width="2"
        height="12"
        rx="1"
        className="fill-[#FAFAF8] dark:fill-[#101713]"
      />
      <rect
        x="23"
        y="13"
        width="2"
        height="6"
        rx="1"
        className="fill-[#FAFAF8] dark:fill-[#101713]"
      />
    </svg>
  );
};

export const Logo: React.FC<LogoProps> = ({
  className,
  iconClassName,
  size = 'md',
  showText = true,
}) => {
  const iconSizes = {
    sm: 24,
    md: 30,
    lg: 38,
  };

  const textSizes = {
    sm: {
      title: 'text-sm font-bold leading-tight',
      subtitle: 'text-[9px] tracking-widest',
    },
    md: {
      title: 'text-base sm:text-lg font-bold tracking-tight leading-none',
      subtitle: 'text-[10px] tracking-widest uppercase mt-0.5',
    },
    lg: {
      title: 'text-xl sm:text-2xl font-bold tracking-tight leading-tight',
      subtitle: 'text-xs tracking-widest uppercase mt-1',
    },
  };

  return (
    <div className={cn('flex items-center gap-2.5 select-none', className)}>
      <LogoIcon size={iconSizes[size]} className={iconClassName} />
      {showText && (
        <div className="flex flex-col">
          <span className={cn('text-[#171A18] dark:text-[#F3F4EF]', textSizes[size].title)}>
            হিদায়াহ অডিও
          </span>
          <span className={cn('text-[#777C77] dark:text-[#A4ADA6] font-medium', textSizes[size].subtitle)}>
            HIDAYAH AUDIO
          </span>
        </div>
      )}
    </div>
  );
};
