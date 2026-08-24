import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Local calendar date as YYYY-MM-DD. Deliberately not toISOString() — that
// reads the UTC date, which drifts a day off from the viewer's actual "today"
// for part of the day in any timezone ahead of UTC (e.g. IST, +5:30).
export function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
