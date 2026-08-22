import {
  startOfWeek,
  endOfWeek,
  format,
  parseISO,
  subWeeks,
  subMonths,
  startOfMonth,
} from 'date-fns';

const ISO_DATE = 'yyyy-MM-dd';

export function weekStartISO(date: Date = new Date()): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), ISO_DATE);
}

export function weekEndISO(weekStart: string): string {
  return format(endOfWeek(parseISO(weekStart), { weekStartsOn: 1 }), ISO_DATE);
}

export function formatWeekLabel(weekStart: string): string {
  const start = parseISO(weekStart);
  const end = endOfWeek(start, { weekStartsOn: 1 });
  const sameMonth = start.getMonth() === end.getMonth();
  const startFmt = format(start, sameMonth ? 'MMM d' : 'MMM d');
  const endFmt = format(end, sameMonth ? 'd, yyyy' : 'MMM d, yyyy');
  return `${startFmt}–${endFmt}`;
}

export function formatWeekLabelShort(weekStart: string): string {
  return format(parseISO(weekStart), 'MMM d');
}

export function monthKey(weekStart: string): string {
  return format(startOfMonth(parseISO(weekStart)), 'yyyy-MM');
}

export function currentMonthKey(): string {
  return format(startOfMonth(new Date()), 'yyyy-MM');
}

export function formatMonthLabel(key: string): string {
  return format(parseISO(`${key}-01`), 'MMMM yyyy');
}

export function formatMonthLabelShort(key: string): string {
  return format(parseISO(`${key}-01`), 'MMM yyyy');
}

/** Most-recent-last list of `count` week-start ISO dates ending at the current week. */
export function recentWeeks(count: number): string[] {
  const now = new Date();
  const weeks: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    weeks.push(weekStartISO(subWeeks(now, i)));
  }
  return weeks;
}

/** Most-recent-last list of `count` month keys ending at the current month. */
export function recentMonths(count: number): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    months.push(format(startOfMonth(subMonths(now, i)), 'yyyy-MM'));
  }
  return months;
}

export function todayISO(): string {
  return format(new Date(), ISO_DATE);
}
