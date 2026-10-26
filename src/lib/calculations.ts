import type { DayAmount, WeekEntry } from '../types';
import { monthKey, weekEndISO } from './dateUtils';

export interface Totals {
  booked: number;
  showed: number;
  closed: number;
  commission: number;
}

export interface RateTotals extends Totals {
  showRate: number | null; // showed / booked
  closeRate: number | null; // closed / showed
}

/** Money in whole cents, so day amounts like 10.99 add up exactly. */
export function toCents(n: number): number {
  return Math.round(n * 100);
}

/** True when a breakdown covers only days of the entry's week and adds up exactly to its commission. */
export function isValidDayBreakdown(weekStart: string, commission: number, breakdown: DayAmount[] | undefined): boolean {
  if (!breakdown || breakdown.length === 0) return false;
  const weekEnd = weekEndISO(weekStart);
  if (breakdown.some((d) => d.date < weekStart || d.date > weekEnd || d.amount < 0)) return false;
  return breakdown.reduce((sum, d) => sum + toCents(d.amount), 0) === toCents(commission);
}

export function hasDayBreakdown(e: WeekEntry): boolean {
  return isValidDayBreakdown(e.weekStart, e.commission, e.dayBreakdown);
}

/**
 * Where an entry's commission is counted: on each day of a valid day breakdown, otherwise (as
 * always) entirely on the week's Monday. Booked/showed/closed are weekly and stay on the Monday.
 */
export function commissionAllocations(e: WeekEntry): DayAmount[] {
  if (hasDayBreakdown(e)) return (e.dayBreakdown as DayAmount[]).filter((d) => d.amount !== 0);
  return [{ date: e.weekStart, amount: e.commission }];
}

/** Commission counted between two ISO dates inclusive, using each entry's day breakdown. */
export function commissionInRange(entries: WeekEntry[], startISO: string, endISO: string): number {
  let total = 0;
  for (const e of entries) {
    for (const a of commissionAllocations(e)) {
      if (a.date >= startISO && a.date <= endISO) total += a.amount;
    }
  }
  return total;
}

export function emptyTotals(): Totals {
  return { booked: 0, showed: 0, closed: 0, commission: 0 };
}

export function addTotals(a: Totals, b: Totals): Totals {
  return {
    booked: a.booked + b.booked,
    showed: a.showed + b.showed,
    closed: a.closed + b.closed,
    commission: a.commission + b.commission,
  };
}

export function showRate(showed: number, booked: number): number | null {
  return booked > 0 ? showed / booked : null;
}

export function closeRate(closed: number, showed: number): number | null {
  return showed > 0 ? closed / showed : null;
}

export function withRates(t: Totals): RateTotals {
  return { ...t, showRate: showRate(t.showed, t.booked), closeRate: closeRate(t.closed, t.showed) };
}

export function sumEntries(entries: WeekEntry[]): Totals {
  return entries.reduce(
    (acc, e) => ({
      booked: acc.booked + e.booked,
      showed: acc.showed + e.showed,
      closed: acc.closed + e.closed,
      commission: acc.commission + e.commission,
    }),
    emptyTotals(),
  );
}

export function groupByRole(entries: WeekEntry[]): Map<string, Totals> {
  const map = new Map<string, Totals>();
  for (const e of entries) {
    const cur = map.get(e.roleId) ?? emptyTotals();
    map.set(e.roleId, {
      booked: cur.booked + e.booked,
      showed: cur.showed + e.showed,
      closed: cur.closed + e.closed,
      commission: cur.commission + e.commission,
    });
  }
  return map;
}

export function groupByWeek(entries: WeekEntry[]): Map<string, Totals> {
  const map = new Map<string, Totals>();
  for (const e of entries) {
    const cur = map.get(e.weekStart) ?? emptyTotals();
    map.set(e.weekStart, {
      booked: cur.booked + e.booked,
      showed: cur.showed + e.showed,
      closed: cur.closed + e.closed,
      commission: cur.commission + e.commission,
    });
  }
  return map;
}

/** Month key -> Totals. Commission follows each entry's day breakdown; call counts follow its week's Monday. */
export function groupByMonth(entries: WeekEntry[]): Map<string, Totals> {
  const map = new Map<string, Totals>();
  const add = (key: string, partial: Partial<Totals>) => {
    map.set(key, addTotals(map.get(key) ?? emptyTotals(), { ...emptyTotals(), ...partial }));
  };
  for (const e of entries) {
    add(monthKey(e.weekStart), { booked: e.booked, showed: e.showed, closed: e.closed });
    for (const a of commissionAllocations(e)) add(monthKey(a.date), { commission: a.amount });
  }
  return map;
}

/**
 * period -> roleId -> Totals, for stacked-by-role charts. `periodOf` maps an ISO date to its period
 * (week start or month key); commission is grouped by its day breakdown, call counts by the week's Monday.
 */
export function groupByPeriodAndRole(
  entries: WeekEntry[],
  periodOf: (iso: string) => string,
): Map<string, Map<string, Totals>> {
  const map = new Map<string, Map<string, Totals>>();
  const add = (period: string, roleId: string, partial: Partial<Totals>) => {
    const inner = map.get(period) ?? new Map<string, Totals>();
    inner.set(roleId, addTotals(inner.get(roleId) ?? emptyTotals(), { ...emptyTotals(), ...partial }));
    map.set(period, inner);
  };
  for (const e of entries) {
    add(periodOf(e.weekStart), e.roleId, { booked: e.booked, showed: e.showed, closed: e.closed });
    for (const a of commissionAllocations(e)) add(periodOf(a.date), e.roleId, { commission: a.amount });
  }
  return map;
}

export function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** Never abbreviates and always shows exact cents — for ledger-style figures (deductions, tax estimates) where precision must not be lost. */
export function formatCurrencyExact(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(0)}%`;
}
