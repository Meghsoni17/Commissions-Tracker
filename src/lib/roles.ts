import type { AppData, Role, WeekEntry } from '../types';
import { isDealEntry } from './deals';

/** Filter value and group key for entries with no role, or a role that no longer exists. */
export const UNASSIGNED = 'unassigned';

export const ALL_ROLES = 'all';

/** Stands in for a real role in tables and charts. Slot 0 is the neutral colour. */
export const UNASSIGNED_ROLE: Role = { id: UNASSIGNED, name: 'Unassigned', colorSlot: 0, archived: false, createdAt: '' };

/** The entry's real role id, or UNASSIGNED. Nothing is guessed and nothing stored changes. */
export function roleKey(roleId: string | undefined, roles: Role[]): string {
  return roles.some((r) => r.id === roleId) ? (roleId as string) : UNASSIGNED;
}

export function matchesRole(entry: Pick<WeekEntry, 'roleId'>, roles: Role[], filter: string): boolean {
  return filter === ALL_ROLES || roleKey(entry.roleId, roles) === filter;
}

/** Copies with unassigned entries grouped under UNASSIGNED, for per-role calculations. */
export function withRoleKeys(entries: WeekEntry[], roles: Role[]): WeekEntry[] {
  return entries.map((e) => ({ ...e, roleId: roleKey(e.roleId, roles) }));
}

/**
 * Gives unassigned entries a role. Entries that already have one are left alone. A deal without a
 * valid role takes the role too, with all its entries, because deals rebuild entries from their role.
 */
export function assignRole(data: AppData, ids: ReadonlySet<string>, roleId: string): AppData {
  const unassigned = (id: string | undefined) => roleKey(id, data.roles) === UNASSIGNED;
  const picked = data.entries.filter((e) => ids.has(e.id) && unassigned(e.roleId));
  const dealsToFix = data.deals.filter((d) => unassigned(d.roleId) && picked.some((e) => isDealEntry(e, d)));
  const dealIds = new Set(dealsToFix.map((d) => d.id));
  const moved = new Set([...picked, ...data.entries.filter((e) => dealsToFix.some((d) => isDealEntry(e, d)))].map((e) => e.id));
  return {
    ...data,
    entries: data.entries.map((e) => (moved.has(e.id) ? { ...e, roleId } : e)),
    deals: data.deals.map((d) => (dealIds.has(d.id) ? { ...d, roleId } : d)),
    recentlyDeletedSales: data.recentlyDeletedSales?.map((d) => (moved.has(d.entryId) ? { ...d, roleId } : d)),
  };
}

export interface RoleUsage {
  entries: number;
  deals: number;
  deleted: number;
}

/** What points at a role, including items waiting in Recently Deleted. */
export function roleUsage(
  data: Pick<AppData, 'entries' | 'deals' | 'recentlyDeleted' | 'recentlyDeletedSales'>,
  roleId: string,
): RoleUsage {
  return {
    entries: data.entries.filter((e) => e.roleId === roleId).length,
    deals: data.deals.filter((d) => d.roleId === roleId).length,
    deleted:
      (data.recentlyDeleted ?? []).filter((d) => d.type === 'commission' && d.item.roleId === roleId).length +
      (data.recentlyDeletedSales ?? []).filter((d) => d.roleId === roleId).length,
  };
}

/**
 * Removes a role and never its data. With `reassignTo`, everything moves to that role. Without it,
 * entries keep the old id, which no longer matches a role, so they show as Unassigned.
 */
export function deleteRole(data: AppData, roleId: string, reassignTo?: string): AppData {
  const roles = data.roles.filter((r) => r.id !== roleId);
  if (!reassignTo) return { ...data, roles };
  const swap = <T extends { roleId: string }>(x: T): T => (x.roleId === roleId ? { ...x, roleId: reassignTo } : x);
  return {
    ...data,
    roles,
    entries: data.entries.map(swap),
    deals: data.deals.map(swap),
    recentlyDeleted: data.recentlyDeleted?.map((d) => (d.type === 'commission' ? { ...d, item: swap(d.item) } : d)),
    recentlyDeletedSales: data.recentlyDeletedSales?.map(swap),
  };
}
