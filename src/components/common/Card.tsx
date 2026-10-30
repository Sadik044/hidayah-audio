import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  className,
  hoverable = false,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'rounded-xl transition-all duration-150',
        hoverable && 'hover:bg-[#F0F1ED]/60 dark:hover:bg-[#19231D]/60',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
