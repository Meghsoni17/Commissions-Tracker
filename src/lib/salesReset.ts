import { v4 as uuid } from 'uuid';
import type { AppData, ClearedDealEntry, Deal, DeletedSalesItem, WeekEntry } from '../types';
import { weekDays } from './dateUtils';
import { inRange, type ResetRange } from './reset';
import { ALL_ROLES, matchesRole } from './roles';

type SalesCounts = Pick<WeekEntry, 'booked' | 'showed' | 'closed'>;

export function hasSalesData(e: SalesCounts): boolean {
  return e.booked !== 0 || e.showed !== 0 || e.closed !== 0;
}

export interface SalesPreviewEntry {
  entry: WeekEntry;
  /** True when only some of the entry's Monday to Sunday week falls inside the range. */
  partial: boolean;
  /** The deal this entry is the close of, whose sale date is known exactly. */
  deal?: Deal;
}

/** Entries with sales numbers in the range, oldest first. Commission-only entries have nothing to clear. */
export function buildSalesPreview(
  data: Pick<AppData, 'roles' | 'entries' | 'deals'>,
  range: ResetRange,
  roleFilter: string = ALL_ROLES,
): SalesPreviewEntry[] {
  const rows: SalesPreviewEntry[] = [];
  for (const entry of data.entries) {
    if (!hasSalesData(entry) || !matchesRole(entry, data.roles, roleFilter)) continue;
    const week = weekDays(entry.weekStart);
    if (!week.some((d) => inRange(d, range))) continue;
    rows.push({
      entry,
      partial: !week.every((d) => inRange(d, range)),
      deal: data.deals.find((d) => d.linkedEntryId === entry.id),
    });
  }
  return rows.sort((a, b) => a.entry.weekStart.localeCompare(b.entry.weekStart));
}

/** Entries in the range sitting in the commission Recently Deleted, whose sales numbers this reset can't reach. */
export function binnedEntriesWithSales(
  data: Pick<AppData, 'roles' | 'recentlyDeleted'>,
  range: ResetRange,
  roleFilter: string = ALL_ROLES,
): number {
  return (data.recentlyDeleted ?? []).filter(
    (d) =>
      d.type === 'commission' &&
      hasSalesData(d.item) &&
      matchesRole(d.item, data.roles, roleFilter) &&
      weekDays(d.item.weekStart).some((day) => inRange(day, range)),
  ).length;
}

/** Sets booked, showed and closed to 0 on exactly these entries. Every other field stays as it is. */
export function clearSalesData(data: AppData, ids: ReadonlySet<string>, deletedAt: string): AppData {
  const moved: DeletedSalesItem[] = [];
  const cleared: ClearedDealEntry[] = [];
  const entries = data.entries.map((e) => {
    if (!ids.has(e.id) || !hasSalesData(e)) return e;
    const deal = data.deals.find((d) => d.linkedEntryId === e.id);
    if (deal) cleared.push({ dealId: deal.id, key: e.weekStart });
    moved.push({
      id: uuid(),
      entryId: e.id,
      roleId: e.roleId,
      weekStart: e.weekStart,
      booked: e.booked,
      showed: e.showed,
      closed: e.closed,
      deletedAt,
      dealId: deal?.id,
    });
    return { ...e, booked: 0, showed: 0, closed: 0 };
  });
  return {
    ...data,
    entries,
    recentlyDeletedSales: [...(data.recentlyDeletedSales ?? []), ...moved],
    clearedDealSales: [...(data.clearedDealSales ?? []), ...cleared],
  };
}

type RestoreData = Pick<AppData, 'entries' | 'deals' | 'recentlyDeleted'>;

/** The ids the numbers could go back to: the original entry, or the entry a deal rebuild replaced it with. */
function targetIds(data: RestoreData, item: DeletedSalesItem): string[] {
  const linked = data.deals.find((d) => d.id === item.dealId)?.linkedEntryId;
  return linked ? [item.entryId, linked] : [item.entryId];
}

function findTarget(data: RestoreData, item: DeletedSalesItem): WeekEntry | undefined {
  const ids = targetIds(data, item);
  const live = data.entries.find((e) => ids.includes(e.id));
  if (live) return live;
  for (const d of data.recentlyDeleted ?? []) if (d.type === 'commission' && ids.includes(d.item.id)) return d.item;
  return undefined;
}

/** False once the entry has new numbers: restoring would overwrite them. */
export function canRestoreSales(data: RestoreData, item: DeletedSalesItem): boolean {
  const target = findTarget(data, item);
  return !target || !hasSalesData(target);
}

/**
 * Puts cleared numbers back, leaving commission alone. If the entry now sits in the commission
 * Recently Deleted they go back there; if it's gone for good they return as a $0 commission entry.
 * Items whose entry has new numbers stay put. Without `ids`, restores everything it can.
 */
export function restoreSalesData(data: AppData, ids?: ReadonlySet<string>): AppData {
  let next = data;
  for (const item of data.recentlyDeletedSales ?? []) {
    if ((ids && !ids.has(item.id)) || !canRestoreSales(next, item)) continue;
    const counts = { booked: item.booked, showed: item.showed, closed: item.closed };
    const target = findTarget(next, item);
    const isLive = next.entries.some((e) => e.id === target?.id);
    next = {
      ...next,
      entries: !target
        ? [...next.entries, { id: item.entryId, roleId: item.roleId, weekStart: item.weekStart, commission: 0, ...counts }]
        : next.entries.map((e) => (e.id === target.id ? { ...e, ...counts } : e)),
      recentlyDeleted:
        target && !isLive
          ? next.recentlyDeleted?.map((d) => (d.type === 'commission' && d.item.id === target.id ? { ...d, item: { ...d.item, ...counts } } : d))
          : next.recentlyDeleted,
      recentlyDeletedSales: next.recentlyDeletedSales?.filter((d) => d.id !== item.id),
      clearedDealSales: next.clearedDealSales?.filter((c) => !(c.dealId === item.dealId && c.key === item.weekStart)),
    };
  }
  return next;
}
