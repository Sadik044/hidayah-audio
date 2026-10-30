import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'lg',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div
          className={cn(
            'relative transform overflow-hidden rounded-2xl bg-white dark:bg-emerald-night border border-sand-300 dark:border-emerald-800/70 p-6 text-left shadow-xl transition-all w-full my-8 animate-in fade-in zoom-in-95 duration-200',
            maxWidthClasses[maxWidth]
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-3 border-b border-sand-200 dark:border-emerald-900/40">
            <div>
              <h3 className="text-lg font-bold text-sand-900 dark:text-stone-100">
                {title}
              </h3>
              {description && (
                <p className="text-xs text-sand-800/80 dark:text-stone-400 mt-0.5">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-sand-100 dark:hover:bg-emerald-900/40 transition-colors"
              aria-label="বন্ধ করুন"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  );
};
