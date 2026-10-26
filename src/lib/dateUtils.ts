import {
  addDays,
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

/** Monday of the week containing the ISO date `iso`. */
export function weekStartOf(iso: string): string {
  return weekStartISO(parseISO(iso));
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

/** The seven ISO dates (Monday to Sunday) of the week starting `weekStart`. */
export function weekDays(weekStart: string): string[] {
  const start = parseISO(weekStart);
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), ISO_DATE));
}

export interface WeekMonthSegment {
  monthKey: string; // yyyy-MM
  startISO: string;
  endISO: string;
  label: string; // e.g. "28–30 Sep", or "30 Sep" for a single day
}

/** The week split at month boundaries: one segment normally, two when the week straddles a month change. */
export function weekMonthSegments(weekStart: string): WeekMonthSegment[] {
  const segments: WeekMonthSegment[] = [];
  for (const day of weekDays(weekStart)) {
    const key = monthKey(day);
    const last = segments[segments.length - 1];
    if (last && last.monthKey === key) last.endISO = day;
    else segments.push({ monthKey: key, startISO: day, endISO: day, label: '' });
  }
  for (const s of segments) {
    const start = parseISO(s.startISO);
    s.label = s.startISO === s.endISO ? format(start, 'd MMM') : `${format(start, 'd')}–${format(parseISO(s.endISO), 'd MMM')}`;
  }
  return segments;
}

export function weekStraddlesMonths(weekStart: string): boolean {
  return weekMonthSegments(weekStart).length > 1;
}

export function formatWeekLabelShort(weekStart: string): string {
  return format(parseISO(weekStart), 'MMM d');
}

/** yyyy-MM month key of an ISO date (a week start, or an exact day). */
export function monthKey(iso: string): string {
  return format(startOfMonth(parseISO(iso)), 'yyyy-MM');
}

export function currentMonthKey(): string {
  return format(startOfMonth(new Date()), 'yyyy-MM');
}

export function previousMonthKey(): string {
  return format(subMonths(startOfMonth(new Date()), 1), 'yyyy-MM');
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

export function formatShortDate(iso: string): string {
  return format(parseISO(iso), 'd MMM yyyy');
}

/** e.g. "Mon 28 Sep" */
export function formatDayLabel(iso: string): string {
  return format(parseISO(iso), 'EEE d MMM');
}
