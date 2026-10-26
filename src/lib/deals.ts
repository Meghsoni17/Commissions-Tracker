import { v4 as uuid } from 'uuid';
import { addDays, addMonths, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { Deal, InstallmentFrequency, PaymentInstallment, WeekEntry } from '../types';
import { todayISO, weekStartISO } from './dateUtils';

/**
 * The weekly Entry a deal contributes on close: one booked/showed/closed call, with the cash
 * collected on the call recognized as that week's commission. Follow-up installment payments
 * aren't reflected here — they're tracked on the deal itself, not added to Entries.
 */
export function dealToEntry(deal: Pick<Deal, 'roleId' | 'saleDate' | 'cashCollectedOnCall' | 'clientName'>): Omit<WeekEntry, 'id'> {
  return {
    roleId: deal.roleId,
    weekStart: weekStartISO(parseISO(deal.saleDate)),
    booked: 1,
    showed: 1,
    closed: 1,
    commission: deal.cashCollectedOnCall,
    notes: `Auto-added from deal: ${deal.clientName}`,
    // The sale date is known exactly, so the commission counts in the sale's month even mid-week.
    dayBreakdown: deal.cashCollectedOnCall > 0 ? [{ date: deal.saleDate, amount: deal.cashCollectedOnCall }] : undefined,
  };
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
