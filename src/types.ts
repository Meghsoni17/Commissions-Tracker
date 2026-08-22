export interface Role {
  id: string;
  name: string;
  colorSlot: number; // 1-8, index into the categorical palette
  archived: boolean;
  createdAt: string; // ISO date
}

export interface WeekEntry {
  id: string;
  roleId: string;
  weekStart: string; // ISO date (Monday) identifying the week
  booked: number;
  showed: number;
  closed: number;
  commission: number;
  notes?: string;
}

export interface MonthlyGoal {
  monthKey: string; // yyyy-MM
  amount: number;
}

/** Standard ATO work-related expense categories, plus room for a user-defined custom one. */
export const DEDUCTION_CATEGORIES = [
  'Vehicle & Travel',
  'Home Office',
  'Tools & Equipment',
  'Professional Development',
  'Memberships & Subscriptions',
  'Uniforms & Protective Clothing',
  'Insurance',
  'Other',
] as const;

export type StandardDeductionCategory = (typeof DEDUCTION_CATEGORIES)[number];

export interface Deduction {
  id: string;
  financialYear: string; // FY key = the calendar year the FY starts in, e.g. "2026" for FY2026-27
  description: string;
  category: string; // one of DEDUCTION_CATEGORIES, or a user-defined custom category
  amount: number;
  createdAt: string; // ISO date
}

export interface AppData {
  roles: Role[];
  entries: WeekEntry[];
  monthlyGoals: MonthlyGoal[];
  deductions: Deduction[];
  isSample?: boolean;
}
