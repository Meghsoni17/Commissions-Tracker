import type { AppData, Deal, Deduction, PaymentInstallment, SuperContribution, WeekEntry } from '../types';
import { todayISO } from './dateUtils';
import { isValidRatePercent } from './calculations';

/** Pre-encryption plaintext key from before the encrypted vault existed. Only read once, to migrate. */
const LEGACY_DATA_KEY = 'commissions-tracker-v1';

/** Backfills fields added to Deduction after data may have already been saved without them. */
function normalizeDeduction(d: Partial<Deduction> & { id: string }): Deduction {
  return {
    id: d.id,
    financialYear: d.financialYear ?? '',
    description: d.description ?? '',
    category: d.category ?? 'Other',
    amount: typeof d.amount === 'number' ? d.amount : Number(d.amount) || 0,
    purchaseDate: d.purchaseDate ?? d.createdAt ?? todayISO(),
    vendor: d.vendor ?? '',
    paymentMethod: d.paymentMethod ?? 'Other',
    notes: d.notes,
    createdAt: d.createdAt ?? todayISO(),
  };
}

/** Backfills fields for contributions saved before this feature existed. */
function normalizeSuperContribution(s: Partial<SuperContribution> & { id: string }): SuperContribution {
  return {
    id: s.id,
    date: s.date ?? todayISO(),
    amount: typeof s.amount === 'number' ? s.amount : Number(s.amount) || 0,
    notes: s.notes,
  };
}

/** Backfills fields for a payment installment saved before this feature existed. */
function normalizeInstallment(i: Partial<PaymentInstallment> & { id: string }): PaymentInstallment {
  return {
    id: i.id,
    dueDate: i.dueDate ?? todayISO(),
    amount: typeof i.amount === 'number' ? i.amount : Number(i.amount) || 0,
    paid: i.paid === true,
    paidDate: i.paidDate,
  };
}

/** Backfills fields for a deal saved before this feature existed. */
function normalizeDeal(d: Partial<Deal> & { id: string }): Deal {
  return {
    id: d.id,
    roleId: d.roleId ?? '',
    clientName: d.clientName ?? '',
    saleDate: d.saleDate ?? d.createdAt ?? todayISO(),
    totalContractValue: typeof d.totalContractValue === 'number' ? d.totalContractValue : Number(d.totalContractValue) || 0,
    cashCollectedOnCall: typeof d.cashCollectedOnCall === 'number' ? d.cashCollectedOnCall : Number(d.cashCollectedOnCall) || 0,
    paymentStructure: d.paymentStructure ?? 'Paid in Full',
    installments: Array.isArray(d.installments) ? d.installments.map(normalizeInstallment) : [],
    notes: d.notes,
    createdAt: d.createdAt ?? todayISO(),
    linkedEntryId: d.linkedEntryId,
    // Only a real percentage is kept; anything else leaves the deal flagged for review, never guessed.
    commissionRate: isValidRatePercent(d.commissionRate) ? d.commissionRate : undefined,
  };
}

/**
 * Entries are kept exactly as saved; the only change is dropping malformed rows from an optional
 * day breakdown. Entries saved before day breakdowns existed simply have none and keep counting on
 * their week's Monday, as before.
 */
function normalizeEntry(e: WeekEntry): WeekEntry {
  if (e.dayBreakdown === undefined) return e;
  const dayBreakdown = Array.isArray(e.dayBreakdown)
    ? e.dayBreakdown
        .filter((d) => d && typeof d.date === 'string')
        .map((d) => ({ date: d.date, amount: typeof d.amount === 'number' ? d.amount : Number(d.amount) || 0 }))
    : [];
  return { ...e, dayBreakdown: dayBreakdown.length > 0 ? dayBreakdown : undefined };
}

/** Validates and backfills a parsed blob (decrypted, or legacy plaintext) into a well-formed AppData. */
export function normalizeAppData(parsed: unknown): AppData | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as Partial<AppData>;
  if (!Array.isArray(p.roles) || !Array.isArray(p.entries)) return null;
  return {
    roles: p.roles,
    entries: p.entries.map(normalizeEntry),
    monthlyGoals: Array.isArray(p.monthlyGoals) ? p.monthlyGoals : [],
    deductions: Array.isArray(p.deductions) ? p.deductions.map(normalizeDeduction) : [],
    superContributions: Array.isArray(p.superContributions) ? p.superContributions.map(normalizeSuperContribution) : [],
    deals: Array.isArray(p.deals) ? p.deals.map(normalizeDeal) : [],
    commissionFixes: Array.isArray(p.commissionFixes) ? p.commissionFixes : undefined,
    isSample: p.isSample,
  };
}

/** One-time read of pre-encryption plaintext data, for migrating it into the vault. */
export function loadLegacyPlaintextData(): AppData | null {
  try {
    const raw = localStorage.getItem(LEGACY_DATA_KEY);
    if (!raw) return null;
    return normalizeAppData(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function hasLegacyPlaintextData(): boolean {
  return localStorage.getItem(LEGACY_DATA_KEY) !== null;
}

export function clearLegacyPlaintextData(): void {
  localStorage.removeItem(LEGACY_DATA_KEY);
}
