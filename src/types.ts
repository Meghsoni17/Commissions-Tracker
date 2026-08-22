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

export const PAYMENT_METHODS = [
  'Bank Transfer',
  'Debit Card',
  'Credit Card',
  'Direct Debit',
  'Wise',
  'PayPal',
  'Cash',
  'Other',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface Deduction {
  id: string;
  financialYear: string; // FY key = the calendar year the FY starts in, e.g. "2026" for FY2026-27
  description: string;
  category: string; // one of DEDUCTION_CATEGORIES, or a user-defined custom category
  amount: number;
  purchaseDate: string; // ISO date the expense was incurred
  vendor: string; // who the payment was made to
  paymentMethod: string; // one of PAYMENT_METHODS
  notes?: string;
  createdAt: string; // ISO date the line item was logged
}

export interface SuperContribution {
  id: string;
  date: string; // ISO date the contribution was made
  amount: number;
  notes?: string; // e.g. which fund
}

export interface AppData {
  roles: Role[];
  entries: WeekEntry[];
  monthlyGoals: MonthlyGoal[];
  deductions: Deduction[];
  superContributions: SuperContribution[];
  isSample?: boolean;
}
