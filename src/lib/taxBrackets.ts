export interface TaxBracket {
  /** Income above this threshold is taxed at `rate` up to the next bracket's threshold. */
  threshold: number;
  rate: number;
}

/**
 * Resident individual marginal tax brackets, keyed by financial-year key (the calendar year
 * the FY starts in — see `financialYear.ts`). Add/update an entry here when the ATO publishes
 * rates for a new financial year; nothing else in the tax calculator needs to change.
 */
export const TAX_BRACKETS_BY_FY: Record<string, TaxBracket[]> = {
  // FY2026-27 (1 Jul 2026 – 30 Jun 2027)
  '2026': [
    { threshold: 0, rate: 0 },
    { threshold: 18_200, rate: 0.15 },
    { threshold: 45_000, rate: 0.3 },
    { threshold: 135_000, rate: 0.37 },
    { threshold: 190_000, rate: 0.45 },
  ],
};

const FALLBACK_FY = '2026';

export function hasBracketsForFY(fyKey: string): boolean {
  return fyKey in TAX_BRACKETS_BY_FY;
}

export function bracketsForFY(fyKey: string): TaxBracket[] {
  return TAX_BRACKETS_BY_FY[fyKey] ?? TAX_BRACKETS_BY_FY[FALLBACK_FY];
}

export const MEDICARE_LEVY_RATE = 0.02;

export function calculateIncomeTax(taxableIncome: number, brackets: TaxBracket[]): number {
  const income = Math.max(0, taxableIncome);
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const { threshold, rate } = brackets[i];
    if (income <= threshold) break;
    const nextThreshold = brackets[i + 1]?.threshold ?? Infinity;
    const upper = Math.min(income, nextThreshold);
    tax += (upper - threshold) * rate;
  }
  return tax;
}

export function calculateMedicareLevy(taxableIncome: number): number {
  return Math.max(0, taxableIncome) * MEDICARE_LEVY_RATE;
}
