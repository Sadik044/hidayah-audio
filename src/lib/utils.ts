import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Convert English numbers to Bengali numerals
export function toBengaliNumber(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num
    .toString()
    .replace(/[0-9]/g, (digit) => bengaliDigits[parseInt(digit, 10)]);
}

// Format duration in seconds to Bengali MM:SS or HH:MM:SS
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '০০:০০';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hrs > 0) {
    return toBengaliNumber(`${pad(hrs)}:${pad(mins)}:${pad(secs)}`);
  }
  return toBengaliNumber(`${pad(mins)}:${pad(secs)}`);
}
