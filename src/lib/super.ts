/**
 * Superannuation Guarantee (SG) rate, used only to suggest a personal contribution amount for
 * ABN/sole-trader income that doesn't get employer super paid automatically. This is a reference
 * figure, not a legal requirement. Update this constant when the legislated SG rate changes.
 */
export const SUPER_GUARANTEE_RATE = 0.12; // 12%, effective from 1 July 2025

export function suggestedSuperContribution(grossIncome: number): number {
  return Math.max(0, grossIncome) * SUPER_GUARANTEE_RATE;
}
