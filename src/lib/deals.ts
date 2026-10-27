import { v4 as uuid } from 'uuid';
import { addDays, addMonths, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { AppData, CommissionFix, DayAmount, Deal, InstallmentFrequency, PaymentInstallment, WeekEntry } from '../types';
import { formatShortDate, formatWeekLabel, todayISO, weekStartISO } from './dateUtils';
import { commissionAt, hasDayBreakdown, isValidRatePercent, toCents } from './calculations';

type DealCommissionFields = Pick<
  Deal,
  'roleId' | 'saleDate' | 'clientName' | 'totalContractValue' | 'cashCollectedOnCall' | 'installments'
>;

/**
 * The Entries a deal contributes, all tagged with its id: one closed call in the sale's week earning
 * `rate`% of the cash collected on the call, plus one entry per paid installment earning `rate`% of
 * that payment on the date it was paid. Only collected cash earns commission.
 */
export function dealEntries(deal: DealCommissionFields & { id: string }, ratePercent: number): Omit<WeekEntry, 'id'>[] {
  const onCall = commissionAt(deal.cashCollectedOnCall, ratePercent);
  const entries: Omit<WeekEntry, 'id'>[] = [
    {
      roleId: deal.roleId,
      weekStart: weekStartISO(parseISO(deal.saleDate)),
      booked: 1,
      showed: 1,
      closed: 1,
      commission: onCall,
      notes: `Auto-added from deal: ${deal.clientName}`,
      // The sale date is known exactly, so the commission counts in the sale's month even mid-week.
      dayBreakdown: onCall > 0 ? [{ date: deal.saleDate, amount: onCall }] : undefined,
      dealId: deal.id,
    },
  ];
  for (const i of deal.installments) {
    if (!i.paid) continue;
    const date = i.paidDate ?? i.dueDate;
    const commission = commissionAt(i.amount, ratePercent);
    if (commission <= 0) continue;
    entries.push({
      roleId: deal.roleId,
      weekStart: weekStartISO(parseISO(date)),
      booked: 0,
      showed: 0,
      closed: 0,
      commission,
      notes: `Installment from deal: ${deal.clientName}`,
      dayBreakdown: [{ date, amount: commission }],
      dealId: deal.id,
    });
  }
  return entries;
}

export interface DealCommission {
  expected: number; // on the full contract value
  earned: number; // on cash actually collected; the only part counted in totals
  toCome: number; // on the balance not yet collected
}

/** Earned vs outstanding commission at `ratePercent`%. Earned matches the deal's Entries to the cent. */
export function dealCommission(deal: DealCommissionFields, ratePercent: number): DealCommission {
  const expected = commissionAt(deal.totalContractValue, ratePercent);
  const paid = deal.installments.filter((i) => i.paid);
  const earnedCents =
    toCents(commissionAt(deal.cashCollectedOnCall, ratePercent)) +
    paid.reduce((sum, i) => sum + toCents(commissionAt(i.amount, ratePercent)), 0);
  return { expected, earned: earnedCents / 100, toCome: Math.max(0, toCents(expected) - earnedCents) / 100 };
}

/** True for an entry generated from `deal` (tagged with its id, or its close entry from before tagging). */
export function isDealEntry(entry: WeekEntry, deal: Pick<Deal, 'id' | 'linkedEntryId'>): boolean {
  return entry.dealId === deal.id || (deal.linkedEntryId !== undefined && entry.id === deal.linkedEntryId);
}

/** A deal's effective rate, if one has been set (deals saved before rates existed have none). */
export function dealRate(deal: Pick<Deal, 'commissionRate'>): number | null {
  return isValidRatePercent(deal.commissionRate) ? deal.commissionRate : null;
}

export function remainingBalance(deal: Pick<Deal, 'totalContractValue' | 'cashCollectedOnCall'>): number {
  return Math.max(0, deal.totalContractValue - deal.cashCollectedOnCall);
}

export function scheduledTotal(installments: PaymentInstallment[]): number {
  return installments.reduce((sum, i) => sum + i.amount, 0);
}

export function collectedTotal(deal: Deal): number {
  const paidInstallments = deal.installments.filter((i) => i.paid).reduce((sum, i) => sum + i.amount, 0);
  return deal.cashCollectedOnCall + paidInstallments;
}

/** What's still owed right now, i.e. total contract value minus everything actually collected so far. */
export function outstandingBalance(deal: Deal): number {
  return Math.max(0, deal.totalContractValue - collectedTotal(deal));
}

function stepDate(date: Date, frequency: InstallmentFrequency): Date {
  if (frequency === 'Weekly') return addDays(date, 7);
  if (frequency === 'Fortnightly') return addDays(date, 14);
  return addMonths(date, 1);
}

/** Splits `totalAmount` evenly across `count` installments starting at `startDate`, spaced by `frequency`. */
export function generateInstallments(
  startDate: string,
  count: number,
  frequency: InstallmentFrequency,
  totalAmount: number,
): PaymentInstallment[] {
  if (count <= 0 || totalAmount <= 0) return [];
  const base = Math.floor((totalAmount / count) * 100) / 100;
  const installments: PaymentInstallment[] = [];
  let date = parseISO(startDate);
  let allocated = 0;
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const amount = isLast ? Math.round((totalAmount - allocated) * 100) / 100 : base;
    allocated += amount;
    installments.push({
      id: uuid(),
      dueDate: format(date, 'yyyy-MM-dd'),
      amount,
      paid: false,
    });
    date = stepDate(date, frequency);
  }
  return installments;
}

export interface ReminderRow {
  deal: Deal;
  installment: PaymentInstallment;
  daysUntilDue: number;
  overdue: boolean;
}

/** Unpaid installments across all deals, soonest-due first. */
export function upcomingReminders(deals: Deal[], withinDays?: number): ReminderRow[] {
  const today = parseISO(todayISO());
  const rows: ReminderRow[] = [];
  for (const deal of deals) {
    for (const installment of deal.installments) {
      if (installment.paid) continue;
      const daysUntilDue = differenceInCalendarDays(parseISO(installment.dueDate), today);
      if (withinDays !== undefined && daysUntilDue > withinDays) continue;
      rows.push({ deal, installment, daysUntilDue, overdue: daysUntilDue < 0 });
    }
  }
  return rows.sort((a, b) => a.installment.dueDate.localeCompare(b.installment.dueDate));
}

/** A breakdown re-scaled to `ratePercent`%, still adding up exactly to the new commission. */
function scaleBreakdown(breakdown: DayAmount[], ratePercent: number, newCommission: number): DayAmount[] {
  const cents = breakdown.map((d) => Math.round((toCents(d.amount) * ratePercent) / 100));
  const diff = toCents(newCommission) - cents.reduce((sum, c) => sum + c, 0);
  const largest = cents.indexOf(Math.max(...cents));
  cents[largest] += diff;
  return breakdown.map((d, i) => ({ date: d.date, amount: cents[i] / 100 }));
}

/**
 * Applies a commission rate to deals saved before rates existed, whose close entry counted the full
 * cash collected as commission. Each close entry is corrected in place (only its commission and day
 * breakdown change), paid installments get their commission entries, and every change is returned
 * for review. Deals without a rate in `rates`, and all other data, are left untouched.
 */
export function applyCommissionRates(data: AppData, rates: Map<string, number>): AppData {
  const fixes: CommissionFix[] = [];
  let entries = data.entries;
  const deals = data.deals.map((deal) => {
    const rate = rates.get(deal.id);
    if (dealRate(deal) !== null || rate === undefined || !isValidRatePercent(rate)) return deal;
    const fixed: Deal = { ...deal, commissionRate: rate };
    const [close, ...installmentEntries] = dealEntries(fixed, rate);
    const old = deal.linkedEntryId ? entries.find((e) => e.id === deal.linkedEntryId) : undefined;
    if (old) {
      const dayBreakdown = hasDayBreakdown(old) ? scaleBreakdown(old.dayBreakdown as DayAmount[], rate, close.commission) : old.dayBreakdown;
      entries = entries.map((e) => (e.id === old.id ? { ...e, commission: close.commission, dayBreakdown, dealId: deal.id } : e));
      if (toCents(old.commission) !== toCents(close.commission)) fixes.push({
        dealId: deal.id,
        clientName: deal.clientName,
        label: `Close, Week Of ${formatWeekLabel(old.weekStart)}`,
        oldCommission: old.commission,
        newCommission: close.commission,
        rate,
        appliedAt: todayISO(),
      });
    }
    for (const entry of installmentEntries) {
      entries = [...entries, { ...entry, id: uuid() }];
      fixes.push({
        dealId: deal.id,
        clientName: deal.clientName,
        label: `Installment Paid ${formatShortDate(entry.dayBreakdown?.[0]?.date ?? entry.weekStart)} (New Entry)`,
        oldCommission: 0,
        newCommission: entry.commission,
        rate,
        appliedAt: todayISO(),
      });
    }
    return fixed;
  });
  return { ...data, entries, deals, commissionFixes: [...(data.commissionFixes ?? []), ...fixes] };
}
