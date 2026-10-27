export interface Role {
  id: string;
  name: string;
  colorSlot: number; // 1-8, index into the categorical palette
  archived: boolean;
  createdAt: string; // ISO date
  /** Default commission rate for new deals in this role, as a percentage: 10 means 10%. */
  commissionRate?: number;
}

/** One day's share of a week's commission. */
export interface DayAmount {
  date: string; // ISO date within the entry's week
  amount: number;
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
  /**
   * Optional: which days the commission was earned on, summing exactly to `commission`. When present
   * (and valid), monthly/FY figures use these days; without it the whole week counts on its Monday.
   */
  dayBreakdown?: DayAmount[];
  /** Set on entries generated from a deal (its close, or a paid installment), so they can be rebuilt. */
  dealId?: string;
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

export const PAYMENT_STRUCTURES = ['Paid in Full', 'Installments', 'Custom Schedule'] as const;

export type PaymentStructure = (typeof PAYMENT_STRUCTURES)[number];

export const INSTALLMENT_FREQUENCIES = ['Weekly', 'Fortnightly', 'Monthly'] as const;

export type InstallmentFrequency = (typeof INSTALLMENT_FREQUENCIES)[number];

export interface PaymentInstallment {
  id: string;
  dueDate: string; // ISO date the follow-up payment is expected
  amount: number;
  paid: boolean;
  paidDate?: string; // ISO date it was actually collected
}

export interface Deal {
  id: string;
  roleId: string;
  clientName: string;
  saleDate: string; // ISO date of the call the deal was closed on
  totalContractValue: number;
  cashCollectedOnCall: number; // deposit/cash collected on the closing call itself
  paymentStructure: PaymentStructure;
  installments: PaymentInstallment[]; // follow-up payments covering the remaining balance
  notes?: string;
  createdAt: string; // ISO date the deal was logged
  linkedEntryId?: string; // id of the WeekEntry auto-created from this deal's close, for commission totals
  /**
   * Commission rate as a percentage (10 means 10%). Missing on deals saved before rates existed,
   * whose entries counted the full cash collected as commission until reviewed.
   */
  commissionRate?: number;
}

/** One change made when existing deal entries were recalculated with a commission rate. */
export interface CommissionFix {
  dealId: string;
  clientName: string;
  label: string; // e.g. "Close, Week Of Sep 28–Oct 4, 2026" or "Installment Paid 12 Oct 2026"
  oldCommission: number;
  newCommission: number;
  rate: number;
  appliedAt: string; // ISO date
}

export interface AppData {
  roles: Role[];
  entries: WeekEntry[];
  monthlyGoals: MonthlyGoal[];
  deductions: Deduction[];
  superContributions: SuperContribution[];
  deals: Deal[];
  /** The last commission recalculation, kept so the changes can be reviewed until dismissed. */
  commissionFixes?: CommissionFix[];
  isSample?: boolean;
}
