import type { AppData, Deduction } from '../types';
import { todayISO } from './dateUtils';

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

/** Validates and backfills a parsed blob (decrypted, or legacy plaintext) into a well-formed AppData. */
export function normalizeAppData(parsed: unknown): AppData | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as Partial<AppData>;
  if (!Array.isArray(p.roles) || !Array.isArray(p.entries)) return null;
  return {
    roles: p.roles,
    entries: p.entries,
    monthlyGoals: Array.isArray(p.monthlyGoals) ? p.monthlyGoals : [],
    deductions: Array.isArray(p.deductions) ? p.deductions.map(normalizeDeduction) : [],
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
