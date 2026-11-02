import type { AppData, ClearedDealEntry, Deal, Deduction, DeletedItem, SuperContribution, WeekEntry } from '../types';
import { weekDays } from './dateUtils';
import { dealEntryKey, isDealEntry } from './deals';
import { hasDayBreakdown } from './calculations';

export const RECENTLY_DELETED_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Sorts before every real ISO date, for "Everything Before A Date". */
export const EARLIEST_ISO = '0000-01-01';

/** Inclusive at both ends. */
export interface ResetRange {
  fromISO: string;
  toISO: string;
}

export interface ResetTypes {
  commissions: boolean;
  deductions: boolean;
  superContributions: boolean;
}

export interface PreviewDay {
  date: string;
  amount: number;
  inRange: boolean;
}

export interface PreviewEntry {
  entry: WeekEntry;
  /** True when only some of the entry's Monday to Sunday week falls inside the range. */
  partial: boolean;
  /** The entry's day breakdown, or empty when it has none. */
  days: PreviewDay[];
  deal?: Deal;
}

export interface ResetPreview {
  entries: PreviewEntry[];
  deductions: Deduction[];
  superContributions: SuperContribution[];
}

export function inRange(iso: string, range: ResetRange): boolean {
  return iso >= range.fromISO && iso <= range.toISO;
}

export function buildResetPreview(
  data: Pick<AppData, 'entries' | 'deductions' | 'superContributions' | 'deals'>,
  range: ResetRange,
  types: ResetTypes,
): ResetPreview {
  const entries: PreviewEntry[] = [];
  if (types.commissions) {
    for (const entry of data.entries) {
      const week = weekDays(entry.weekStart);
      if (!week.some((d) => inRange(d, range))) continue;
      entries.push({
        entry,
        partial: !week.every((d) => inRange(d, range)),
        days: hasDayBreakdown(entry)
          ? [...(entry.dayBreakdown ?? [])]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((d) => ({ ...d, inRange: inRange(d.date, range) }))
          : [],
        deal: data.deals.find((d) => isDealEntry(entry, d)),
      });
    }
  }
  return {
    entries: entries.sort((a, b) => a.entry.weekStart.localeCompare(b.entry.weekStart)),
    deductions: types.deductions
      ? data.deductions.filter((d) => inRange(d.purchaseDate, range)).sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate))
      : [],
    superContributions: types.superContributions
      ? data.superContributions.filter((s) => inRange(s.date, range)).sort((a, b) => a.date.localeCompare(b.date))
      : [],
  };
}

/** Moves exactly the given entries, deductions and contributions into Recently Deleted. */
export function moveToRecentlyDeleted(data: AppData, ids: ReadonlySet<string>, deletedAt: string): AppData {
  const moved: DeletedItem[] = [];
  const cleared: ClearedDealEntry[] = [];
  for (const item of data.entries) {
    if (!ids.has(item.id)) continue;
    const deal = data.deals.find((d) => isDealEntry(item, d));
    const dealRef = deal ? { dealId: deal.id, key: dealEntryKey(item, deal) } : undefined;
    if (dealRef) cleared.push(dealRef);
    moved.push({ type: 'commission', deletedAt, item, dealRef });
  }
  for (const item of data.deductions) if (ids.has(item.id)) moved.push({ type: 'deduction', deletedAt, item });
  for (const item of data.superContributions) if (ids.has(item.id)) moved.push({ type: 'super', deletedAt, item });
  return {
    ...data,
    entries: data.entries.filter((e) => !ids.has(e.id)),
    deductions: data.deductions.filter((d) => !ids.has(d.id)),
    superContributions: data.superContributions.filter((s) => !ids.has(s.id)),
    recentlyDeleted: [...(data.recentlyDeleted ?? []), ...moved],
    clearedDealEntries: [...(data.clearedDealEntries ?? []), ...cleared],
  };
}

/** Puts items back where they came from. Without `ids`, restores everything in Recently Deleted. */
export function restoreDeleted(data: AppData, ids?: ReadonlySet<string>): AppData {
  const bin = data.recentlyDeleted ?? [];
  const restoring = ids ? bin.filter((d) => ids.has(d.item.id)) : bin;
  const entries = restoring.flatMap((d) => (d.type === 'commission' ? [d.item] : []));
  const dealRefs = restoring.flatMap((d) => (d.type === 'commission' && d.dealRef ? [{ ref: d.dealRef, entryId: d.item.id }] : []));
  return {
    ...data,
    entries: [...data.entries, ...entries],
    deductions: [...data.deductions, ...restoring.flatMap((d) => (d.type === 'deduction' ? [d.item] : []))],
    superContributions: [...data.superContributions, ...restoring.flatMap((d) => (d.type === 'super' ? [d.item] : []))],
    // A rebuild while the close entry was away gives the deal a new link, so point it back.
    deals: data.deals.map((deal) => {
      const close = dealRefs.find(({ ref }) => ref.dealId === deal.id && ref.key === 'close');
      return close ? { ...deal, linkedEntryId: close.entryId } : deal;
    }),
    recentlyDeleted: bin.filter((d) => !restoring.includes(d)),
    clearedDealEntries: (data.clearedDealEntries ?? []).filter(
      (c) => !dealRefs.some(({ ref }) => ref.dealId === c.dealId && ref.key === c.key),
    ),
  };
}

export function deletedItemDaysLeft(item: Pick<DeletedItem, 'deletedAt'>, nowMs: number): number {
  return Math.ceil((Date.parse(item.deletedAt) + RECENTLY_DELETED_DAYS * DAY_MS - nowMs) / DAY_MS);
}

/** Drops items past their 30 days. */
export function withoutExpired<T extends Pick<DeletedItem, 'deletedAt'>>(items: T[], nowMs: number): T[] {
  return items.filter((d) => deletedItemDaysLeft(d, nowMs) > 0);
}
