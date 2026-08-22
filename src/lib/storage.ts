import type { AppData, Deduction } from '../types';
import { todayISO } from './dateUtils';

const STORAGE_KEY = 'commissions-tracker-v1';

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

export function loadData(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    if (!Array.isArray(parsed.roles) || !Array.isArray(parsed.entries)) return null;
    return {
      roles: parsed.roles,
      entries: parsed.entries,
      monthlyGoals: Array.isArray(parsed.monthlyGoals) ? parsed.monthlyGoals : [],
      deductions: Array.isArray(parsed.deductions) ? parsed.deductions.map(normalizeDeduction) : [],
      isSample: parsed.isSample,
    };
  } catch {
    return null;
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
