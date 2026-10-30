import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'emerald' | 'gold' | 'muted';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  const variants = {
    default: 'text-[#777C77] dark:text-[#A4ADA6] bg-[#F0F1ED] dark:bg-[#19231D]',
    emerald: 'text-[#176B50] dark:text-[#48A783] bg-[#176B50]/10 dark:bg-[#48A783]/10',
    gold: 'text-[#176B50] dark:text-[#48A783] bg-[#176B50]/10 dark:bg-[#48A783]/10',
    muted: 'text-[#777C77] dark:text-[#A4ADA6]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center text-xs font-normal px-2 py-0.5 rounded transition-colors',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
