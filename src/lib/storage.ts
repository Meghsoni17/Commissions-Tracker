import type { AppData } from '../types';

const STORAGE_KEY = 'commissions-tracker-v1';

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
      deductions: Array.isArray(parsed.deductions) ? parsed.deductions : [],
      isSample: parsed.isSample,
    };
  } catch {
    return null;
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
