import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'gold';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#176B50] dark:focus-visible:ring-[#48A783] disabled:opacity-50 disabled:pointer-events-none active:scale-[0.99] select-none';

    const variants = {
      primary: 'bg-[#176B50] hover:bg-[#12543E] dark:bg-[#48A783] dark:hover:bg-[#5DB895] text-white dark:text-[#101713]',
      secondary: 'bg-[#F0F1ED] hover:bg-[#E6E7E2] dark:bg-[#19231D] dark:hover:bg-[#233128] text-[#171A18] dark:text-[#F3F4EF]',
      outline: 'border border-[#E6E7E2] dark:border-[#233128] hover:bg-[#F0F1ED] dark:hover:bg-[#19231D] text-[#171A18] dark:text-[#F3F4EF]',
      ghost: 'hover:bg-[#F0F1ED] dark:hover:bg-[#19231D] text-[#777C77] dark:text-[#A4ADA6] hover:text-[#171A18] dark:hover:text-[#F3F4EF]',
      gold: 'bg-[#176B50] hover:bg-[#12543E] dark:bg-[#48A783] dark:hover:bg-[#5DB895] text-white dark:text-[#101713]',
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-5 py-2.5 gap-2.5',
      icon: 'h-8 w-8 p-0 flex items-center justify-center',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-current" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
