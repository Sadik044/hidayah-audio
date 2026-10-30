import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-[#777C77] dark:text-[#A4ADA6]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#777C77] dark:text-[#A4ADA6]">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full rounded-lg border border-[#E6E7E2] dark:border-[#233128] bg-[#F0F1ED]/50 dark:bg-[#19231D]/50 px-3.5 py-2 text-sm text-[#171A18] dark:text-[#F3F4EF] placeholder:text-[#777C77] dark:placeholder:text-[#A4ADA6] focus:outline-none focus:ring-1 focus:ring-[#176B50] dark:focus:ring-[#48A783] transition-colors',
              icon && 'pl-9',
              error && 'border-red-500 focus:ring-red-500',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
