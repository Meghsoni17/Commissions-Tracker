import { addDays, addMonths, format, parseISO } from 'date-fns';
import type { Deduction, RecurringDeduction, RecurringFrequency } from '../types';
import { toCents } from './calculations';
import { fyDateRange } from './financialYear';

const ISO_DATE = 'yyyy-MM-dd';

/** Work-use share of `amount`, rounded to the cent. A missing or invalid percentage counts as 100%. */
export function workPortion(amount: number, workUsePercent: number | undefined): number {
  const pct = isValidWorkUsePercent(workUsePercent) ? workUsePercent : 100;
  return Math.round(toCents(amount) * pct / 100) / 100;
}

export function isValidWorkUsePercent(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100;
}

/** The part of a one-off deduction that can be claimed. */
export function claimableAmount(d: Deduction): number {
  return workPortion(d.amount, d.workUsePercent);
}

/** Date of the `n`th payment (0 = the start date). Months are added from the start, so the 31st never drifts. */
function nthPaymentDate(start: Date, frequency: RecurringFrequency, n: number): Date {
  switch (frequency) {
    case 'Weekly':
      return addDays(start, 7 * n);
    case 'Fortnightly':
      return addDays(start, 14 * n);
    case 'Monthly':
      return addMonths(start, n);
    case 'Quarterly':
      return addMonths(start, 3 * n);
    case 'Yearly':
      return addMonths(start, 12 * n);
  }
}

/** ISO dates of every payment between `fromISO` and `toISO` inclusive, within the item's start and end dates. */
export function paymentDatesBetween(r: RecurringDeduction, fromISO: string, toISO: string): string[] {
  const last = r.endDate && r.endDate < toISO ? r.endDate : toISO;
  if (!r.startDate || last < r.startDate || last < fromISO) return [];
  const start = parseISO(r.startDate);
  const dates: string[] = [];
  for (let n = 0; ; n++) {
    const iso = format(nthPaymentDate(start, r.frequency, n), ISO_DATE);
    if (iso > last) break;
    if (iso >= fromISO) dates.push(iso);
  }
  return dates;
}

export interface RecurringFYTotals {
  /** Work-use share of payments in the FY up to and including `todayISO`. */
  claimedSoFar: number;
  /** Work-use share of every payment in the FY. */
  projected: number;
  paymentsSoFar: number;
  paymentsInFY: number;
}

/** How much a recurring item adds up to in the FY, counting only payments inside it and inside its own dates. */
export function recurringFYTotals(r: RecurringDeduction, fyKey: string, todayISO: string): RecurringFYTotals {
  const { startISO, endISO } = fyDateRange(fyKey);
  const dates = paymentDatesBetween(r, startISO, endISO);
  const soFar = dates.filter((d) => d <= todayISO).length;
  return {
    claimedSoFar: workPortion(r.amount * soFar, r.workUsePercent),
    projected: workPortion(r.amount * dates.length, r.workUsePercent),
    paymentsSoFar: soFar,
    paymentsInFY: dates.length,
  };
}

const PAYMENTS_PER_YEAR: Record<RecurringFrequency, number> = {
  Weekly: 52,
  Fortnightly: 26,
  Monthly: 12,
  Quarterly: 4,
  Yearly: 1,
};

/** Average cost per month, e.g. $20 weekly ≈ $86.67 a month. */
export function monthlyEquivalent(amount: number, frequency: RecurringFrequency): number {
  return Math.round(toCents(amount) * PAYMENTS_PER_YEAR[frequency] / 12) / 100;
}

/** True once the item has an end date of today or earlier. */
export function hasEnded(r: RecurringDeduction, todayISO: string): boolean {
  return r.endDate !== undefined && r.endDate <= todayISO;
}
