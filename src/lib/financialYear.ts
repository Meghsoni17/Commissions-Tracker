import { parseISO } from 'date-fns';

/** FY key = the calendar year the financial year starts in (e.g. "2026" for FY 1 Jul 2026 – 30 Jun 2027). */
export function fyKeyForDate(date: Date): string {
  const month = date.getMonth(); // 0-based; June = 5, July = 6
  const year = date.getFullYear();
  return String(month >= 6 ? year : year - 1);
}

export function fyKeyForISODate(iso: string): string {
  return fyKeyForDate(parseISO(iso));
}

export function currentFYKey(): string {
  return fyKeyForDate(new Date());
}

export function fyLabel(fyKey: string): string {
  const startYear = Number(fyKey);
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return `FY ${startYear}–${endYearShort}`;
}

export function fyDateRange(fyKey: string): { startISO: string; endISO: string } {
  const startYear = Number(fyKey);
  return { startISO: `${startYear}-07-01`, endISO: `${startYear + 1}-06-30` };
}

export function isISODateInFY(iso: string, fyKey: string): boolean {
  const { startISO, endISO } = fyDateRange(fyKey);
  return iso >= startISO && iso <= endISO;
}

/** Descending list of FY keys spanning the given keys plus some padding for planning ahead/back. */
export function fyKeyOptions(knownKeys: string[], padPastYears = 3, padFutureYears = 1): string[] {
  const current = Number(currentFYKey());
  const nums = [...knownKeys.map(Number), current];
  const min = Math.min(...nums) - padPastYears;
  const max = Math.max(...nums) + padFutureYears;
  const result: string[] = [];
  for (let y = max; y >= min; y--) result.push(String(y));
  return result;
}
