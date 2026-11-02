import { endOfMonth, format, startOfMonth } from 'date-fns';
import type { Role, WeekEntry } from '../types';
import { commissionInRange, sumEntries, withRates, type RateTotals } from './calculations';
import { weekEndISO, weekStartISO } from './dateUtils';
import { currentFYKey, fyDateRange, fyKeyForISODate, fyLabel } from './financialYear';
import { ALL_ROLES, UNASSIGNED, UNASSIGNED_ROLE, roleKey } from './roles';

/** 'all', 'week', 'month', or a financial year key such as '2026'. */
export type SalesPeriod = string;

export const ALL_TIME = 'all';

export function salesPeriodLabel(period: SalesPeriod): string {
  if (period === ALL_TIME) return 'All-Time';
  if (period === 'week') return 'This Week';
  if (period === 'month') return 'This Month';
  return fyLabel(period);
}

/** Inclusive ISO bounds, or null for all time. */
export function salesPeriodRange(period: SalesPeriod): { startISO: string; endISO: string } | null {
  if (period === ALL_TIME) return null;
  if (period === 'week') {
    const startISO = weekStartISO();
    return { startISO, endISO: weekEndISO(startISO) };
  }
  if (period === 'month') {
    const now = new Date();
    return { startISO: format(startOfMonth(now), 'yyyy-MM-dd'), endISO: format(endOfMonth(now), 'yyyy-MM-dd') };
  }
  return fyDateRange(period);
}

/** Sales numbers are weekly, so a week belongs to the period holding its Monday. */
export function inSalesPeriod(entry: Pick<WeekEntry, 'weekStart'>, period: SalesPeriod): boolean {
  const range = salesPeriodRange(period);
  return !range || (entry.weekStart >= range.startISO && entry.weekStart <= range.endISO);
}

/** Newest first: the current financial year plus any year with entries. */
export function salesFYOptions(entries: WeekEntry[]): string[] {
  const keys = new Set([currentFYKey(), ...entries.map((e) => fyKeyForISODate(e.weekStart))]);
  return [...keys].sort((a, b) => Number(b) - Number(a));
}

export interface SalesRow {
  role: Role;
  totals: RateTotals;
}

export interface SalesBreakdown {
  rows: SalesRow[];
  /** Summed counts for everything shown, with rates worked out from those sums. */
  combined: RateTotals;
}

/** Active roles always appear; archived roles and Unassigned appear when they have entries in the period. */
export function salesBreakdown(entries: WeekEntry[], roles: Role[], roleFilter: string, period: SalesPeriod): SalesBreakdown {
  const range = salesPeriodRange(period);
  const totalsFor = (key: string): RateTotals => {
    const own = entries.filter((e) => roleKey(e.roleId, roles) === key);
    const sum = sumEntries(own.filter((e) => inSalesPeriod(e, period)));
    // Commission follows day breakdowns, so it can't simply use the Monday-based list above.
    return withRates(range ? { ...sum, commission: commissionInRange(own, range.startISO, range.endISO) } : sum);
  };
  const hasEntries = (key: string) => entries.some((e) => roleKey(e.roleId, roles) === key && inSalesPeriod(e, period));
  const candidates = [...roles.filter((r) => !r.archived), ...roles.filter((r) => r.archived && hasEntries(r.id))];
  if (hasEntries(UNASSIGNED)) candidates.push(UNASSIGNED_ROLE);
  const shown =
    roleFilter === ALL_ROLES
      ? candidates
      : [roleFilter === UNASSIGNED ? UNASSIGNED_ROLE : roles.find((r) => r.id === roleFilter)].filter((r): r is Role => r !== undefined);
  const rows = shown.map((role) => ({ role, totals: totalsFor(role.id) }));
  const sum = rows.reduce(
    (acc, r) => ({
      booked: acc.booked + r.totals.booked,
      showed: acc.showed + r.totals.showed,
      closed: acc.closed + r.totals.closed,
      commission: acc.commission + r.totals.commission,
    }),
    { booked: 0, showed: 0, closed: 0, commission: 0 },
  );
  return { rows, combined: withRates(sum) };
}
