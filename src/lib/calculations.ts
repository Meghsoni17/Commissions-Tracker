import type { WeekEntry } from '../types';
import { monthKey } from './dateUtils';

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

export function groupByMonth(entries: WeekEntry[]): Map<string, Totals> {
  const map = new Map<string, Totals>();
  for (const e of entries) {
    const key = monthKey(e.weekStart);
    const cur = map.get(key) ?? emptyTotals();
    map.set(key, {
      booked: cur.booked + e.booked,
      showed: cur.showed + e.showed,
      closed: cur.closed + e.closed,
      commission: cur.commission + e.commission,
    });
  }
  return map;
}

/** weekStart|monthKey -> roleId -> Totals, for stacked-by-role charts. */
export function groupByPeriodAndRole(
  entries: WeekEntry[],
  periodOf: (e: WeekEntry) => string,
): Map<string, Map<string, Totals>> {
  const map = new Map<string, Map<string, Totals>>();
  for (const e of entries) {
    const period = periodOf(e);
    const inner = map.get(period) ?? new Map<string, Totals>();
    const cur = inner.get(e.roleId) ?? emptyTotals();
    inner.set(e.roleId, {
      booked: cur.booked + e.booked,
      showed: cur.showed + e.showed,
      closed: cur.closed + e.closed,
      commission: cur.commission + e.commission,
    });
    map.set(period, inner);
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
