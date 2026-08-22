export const COLOR_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

function normalizeSlot(slot: number): number {
  return ((slot - 1 + 8) % 8) + 1;
}

export function roleColorVar(slot: number): string {
  return `var(--series-${normalizeSlot(slot)})`;
}

const LIGHT_HEX = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const DARK_HEX = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

/** Literal hex for contexts (SVG chart fills) that need a resolved color rather than a CSS var. */
export function roleColorHex(slot: number, isDark: boolean): string {
  const idx = normalizeSlot(slot) - 1;
  return (isDark ? DARK_HEX : LIGHT_HEX)[idx];
}
