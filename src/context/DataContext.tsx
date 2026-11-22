import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { v4 as uuid } from 'uuid';
import type { AppData, ClearedDealEntry, CommissionFix, Deal, Deduction, DeletedItem, DeletedSalesItem, MonthlyGoal, Role, SuperContribution, WeekEntry } from '../types';
import { fetchCloudData, hasChanges, mergeLocalIntoCloud, pruneExpired, pushChanges, type ImportCounts } from '../lib/cloud';
import { errorMessage } from '../lib/supabase';
import { todayISO } from '../lib/dateUtils';
import { applyCommissionRates, dealEntries, dealRate, isClearedDealEntry, isDealEntry } from '../lib/deals';
import { moveToRecentlyDeleted, restoreDeleted } from '../lib/reset';
import { clearSalesData, restoreSalesData } from '../lib/salesReset';
import { assignRole as assignEntriesToRole, deleteRole as removeRole } from '../lib/roles';

interface DataContextValue {
  roles: Role[];
  entries: WeekEntry[];
  monthlyGoals: MonthlyGoal[];
  deductions: Deduction[];
  superContributions: SuperContribution[];
  deals: Deal[];
  commissionFixes: CommissionFix[];
  recentlyDeleted: DeletedItem[];
  recentlyDeletedSales: DeletedSalesItem[];
  /** 'saving' while changes are being written to Supabase, 'error' if the last save failed. */
  saveStatus: SaveStatus;
  saveError: string | null;
  retrySave: () => void;
  /** Reloads from Supabase, e.g. after unlocking, unless there are unsaved changes on screen. */
  refresh: () => Promise<void>;
  /** Uploads local records the cloud doesn't have yet (matched by id). Safe to run more than once. */
  importLocalData: (local: AppData) => Promise<ImportCounts>;
  addRole: (name: string) => void;
  renameRole: (id: string, name: string) => void;
  setRoleColor: (id: string, colorSlot: number) => void;
  archiveRole: (id: string, archived: boolean) => void;
  setRoleRate: (id: string, commissionRate: number | undefined) => void;
  deleteRole: (id: string, reassignTo?: string) => void;
  assignRole: (entryIds: ReadonlySet<string>, roleId: string) => void;
  addEntry: (entry: Omit<WeekEntry, 'id'>) => string;
  updateEntry: (id: string, entry: Omit<WeekEntry, 'id'>) => void;
  deleteEntry: (id: string) => void;
  setMonthlyGoal: (monthKey: string, amount: number) => void;
  addDeduction: (deduction: Omit<Deduction, 'id'>) => void;
  updateDeduction: (id: string, deduction: Omit<Deduction, 'id'>) => void;
  deleteDeduction: (id: string) => void;
  addSuperContribution: (contribution: Omit<SuperContribution, 'id'>) => void;
  updateSuperContribution: (id: string, contribution: Omit<SuperContribution, 'id'>) => void;
  deleteSuperContribution: (id: string) => void;
  addDeal: (deal: Omit<Deal, 'id'>) => void;
  updateDeal: (id: string, deal: Omit<Deal, 'id'>) => void;
  deleteDeal: (id: string) => void;
  setInstallmentPaid: (dealId: string, installmentId: string, paid: boolean) => void;
  applyDealRates: (rates: Map<string, number>) => void;
  dismissCommissionFixes: () => void;
  deleteToRecentlyDeleted: (ids: ReadonlySet<string>) => void;
  restoreRecentlyDeleted: (ids?: ReadonlySet<string>) => void;
  emptyRecentlyDeleted: () => void;
  clearSales: (ids: ReadonlySet<string>) => void;
  restoreSales: (ids?: ReadonlySet<string>) => void;
  emptyRecentlyDeletedSales: () => void;
}

export type SaveStatus = 'idle' | 'saving' | 'error';

const DataContext = createContext<DataContextValue | null>(null);

const NEXT_COLOR_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Swaps a deal's generated entries (close + paid installments) for fresh ones at its rate. Deals
 * saved before rates existed have none, so their entries stay as they are until reviewed. Entries
 * cleared by Reset By Date Range stay cleared, and so do close numbers cleared by Reset Sales Data.
 */
function withDealEntries(
  entries: WeekEntry[],
  deal: Deal,
  cleared: ClearedDealEntry[] | undefined,
  clearedSales: ClearedDealEntry[] | undefined,
  previous?: Deal,
): { entries: WeekEntry[]; linkedEntryId?: string } {
  const rate = dealRate(deal);
  if (rate === null) return { entries, linkedEntryId: deal.linkedEntryId };
  const kept = entries.filter((e) => !isDealEntry(e, previous ?? deal));
  const fresh = dealEntries(deal, rate).map((e) => ({ ...e, id: uuid() }));
  const linkedEntryId = fresh[0].id;
  const live = fresh.filter((e) => !isClearedDealEntry(e, { id: deal.id, linkedEntryId }, cleared));
  const salesCleared = (e: WeekEntry) => (clearedSales ?? []).some((c) => c.dealId === deal.id && c.key === e.weekStart);
  const counted = live.map((e) => (e.id === linkedEntryId && salesCleared(e) ? { ...e, booked: 0, showed: 0, closed: 0 } : e));
  return { entries: [...kept, ...counted], linkedEntryId };
}

export function DataProvider({
  userId,
  initialData,
  children,
}: {
  userId: string;
  /** Exactly what Supabase returned; anything that differs from it on screen gets saved. */
  initialData: AppData;
  children: ReactNode;
}) {
  // Expired Recently Deleted items are dropped on load, which the first save then deletes from the cloud.
  const [data, setData] = useState<AppData>(() => pruneExpired(initialData));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  /** What the database is known to hold. Saves send the difference between this and `latestRef`. */
  const syncedRef = useRef<AppData>(initialData);
  const latestRef = useRef<AppData>(data);
  const savingRef = useRef(false);

  /** Saves until the database matches what's on screen. Changes made mid-save are picked up by the loop. */
  const flush = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      while (latestRef.current !== syncedRef.current) {
        const target = latestRef.current;
        if (!hasChanges(syncedRef.current, target)) {
          syncedRef.current = target;
          continue;
        }
        setSaveStatus('saving');
        await pushChanges(userId, syncedRef.current, target);
        syncedRef.current = target;
      }
      setSaveStatus('idle');
      setSaveError(null);
    } catch (err) {
      console.error('Failed to save to Supabase:', err);
      setSaveStatus('error');
      setSaveError(errorMessage(err));
    } finally {
      savingRef.current = false;
    }
  }, [userId]);

  useEffect(() => {
    latestRef.current = data;
    void flush();
  }, [data, flush]);

  const retrySave = useCallback(() => {
    void flush();
  }, [flush]);

  // Warn before closing the tab while changes are unsaved.
  useEffect(() => {
    if (saveStatus === 'idle') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [saveStatus]);

  const refresh = useCallback(async () => {
    if (savingRef.current || latestRef.current !== syncedRef.current) return;
    const { data: fresh } = await fetchCloudData();
    // Skip if something was edited while the fetch was in flight.
    if (savingRef.current || latestRef.current !== syncedRef.current) return;
    syncedRef.current = fresh;
    setData(pruneExpired(fresh));
  }, []);

  const importLocalData = useCallback(
    async (local: AppData) => {
      if (savingRef.current || latestRef.current !== syncedRef.current) {
        throw new Error('Please wait for your latest changes to finish saving, then try again.');
      }
      // Merge against what's in the cloud right now, not what this tab loaded earlier.
      const { data: cloud } = await fetchCloudData();
      const { merged, counts } = mergeLocalIntoCloud(cloud, local);
      await pushChanges(userId, cloud, merged);
      syncedRef.current = merged;
      setData(pruneExpired(merged));
      return counts;
    },
    [userId],
  );

  const mutate = useCallback((fn: (prev: AppData) => AppData) => {
    setData((prev) => fn(prev));
  }, []);

  const addRole = useCallback(
    (name: string) => {
      mutate((prev) => {
        const used = new Set(prev.roles.map((r) => r.colorSlot));
        const colorSlot = NEXT_COLOR_SLOTS.find((s) => !used.has(s)) ?? ((prev.roles.length % 8) + 1);
        const role: Role = { id: uuid(), name, colorSlot, archived: false, createdAt: new Date().toISOString() };
        return { ...prev, roles: [...prev.roles, role] };
      });
    },
    [mutate],
  );

  const renameRole = useCallback(
    (id: string, name: string) => {
      mutate((prev) => ({ ...prev, roles: prev.roles.map((r) => (r.id === id ? { ...r, name } : r)) }));
    },
    [mutate],
  );

  const setRoleColor = useCallback(
    (id: string, colorSlot: number) => {
      mutate((prev) => ({ ...prev, roles: prev.roles.map((r) => (r.id === id ? { ...r, colorSlot } : r)) }));
    },
    [mutate],
  );

  const archiveRole = useCallback(
    (id: string, archived: boolean) => {
      mutate((prev) => ({ ...prev, roles: prev.roles.map((r) => (r.id === id ? { ...r, archived } : r)) }));
    },
    [mutate],
  );

  const setRoleRate = useCallback(
    (id: string, commissionRate: number | undefined) => {
      mutate((prev) => ({ ...prev, roles: prev.roles.map((r) => (r.id === id ? { ...r, commissionRate } : r)) }));
    },
    [mutate],
  );

  const deleteRole = useCallback(
    (id: string, reassignTo?: string) => {
      mutate((prev) => removeRole(prev, id, reassignTo));
    },
    [mutate],
  );

  const assignRole = useCallback(
    (entryIds: ReadonlySet<string>, roleId: string) => {
      mutate((prev) => assignEntriesToRole(prev, entryIds, roleId));
    },
    [mutate],
  );

  const addEntry = useCallback(
    (entry: Omit<WeekEntry, 'id'>) => {
      const id = uuid();
      mutate((prev) => ({ ...prev, entries: [...prev.entries, { ...entry, id }] }));
      return id;
    },
    [mutate],
  );

  const updateEntry = useCallback(
    (id: string, entry: Omit<WeekEntry, 'id'>) => {
      mutate((prev) => ({ ...prev, entries: prev.entries.map((e) => (e.id === id ? { ...entry, id } : e)) }));
    },
    [mutate],
  );

  const deleteEntry = useCallback(
    (id: string) => {
      mutate((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.id !== id) }));
    },
    [mutate],
  );

  const setMonthlyGoal = useCallback(
    (monthKey: string, amount: number) => {
      mutate((prev) => {
        const monthlyGoals =
          amount > 0
            ? prev.monthlyGoals.some((g) => g.monthKey === monthKey)
              ? prev.monthlyGoals.map((g) => (g.monthKey === monthKey ? { ...g, amount } : g))
              : [...prev.monthlyGoals, { monthKey, amount }]
            : prev.monthlyGoals.filter((g) => g.monthKey !== monthKey);
        return { ...prev, monthlyGoals };
      });
    },
    [mutate],
  );

  const addDeduction = useCallback(
    (deduction: Omit<Deduction, 'id'>) => {
      mutate((prev) => ({ ...prev, deductions: [...prev.deductions, { ...deduction, id: uuid() }] }));
    },
    [mutate],
  );

  const updateDeduction = useCallback(
    (id: string, deduction: Omit<Deduction, 'id'>) => {
      mutate((prev) => ({ ...prev, deductions: prev.deductions.map((d) => (d.id === id ? { ...deduction, id } : d)) }));
    },
    [mutate],
  );

  const deleteDeduction = useCallback(
    (id: string) => {
      mutate((prev) => ({ ...prev, deductions: prev.deductions.filter((d) => d.id !== id) }));
    },
    [mutate],
  );

  const addSuperContribution = useCallback(
    (contribution: Omit<SuperContribution, 'id'>) => {
      mutate((prev) => ({ ...prev, superContributions: [...prev.superContributions, { ...contribution, id: uuid() }] }));
    },
    [mutate],
  );

  const updateSuperContribution = useCallback(
    (id: string, contribution: Omit<SuperContribution, 'id'>) => {
      mutate((prev) => ({
        ...prev,
        superContributions: prev.superContributions.map((s) => (s.id === id ? { ...contribution, id } : s)),
      }));
    },
    [mutate],
  );

  const deleteSuperContribution = useCallback(
    (id: string) => {
      mutate((prev) => ({ ...prev, superContributions: prev.superContributions.filter((s) => s.id !== id) }));
    },
    [mutate],
  );

  const addDeal = useCallback(
    (deal: Omit<Deal, 'id'>) => {
      mutate((prev) => {
        const newDeal: Deal = { ...deal, id: uuid() };
        const { entries, linkedEntryId } = withDealEntries(prev.entries, newDeal, prev.clearedDealEntries, prev.clearedDealSales);
        return { ...prev, entries, deals: [...prev.deals, { ...newDeal, linkedEntryId }] };
      });
    },
    [mutate],
  );

  const updateDeal = useCallback(
    (id: string, deal: Omit<Deal, 'id'>) => {
      mutate((prev) => {
        const existing = prev.deals.find((d) => d.id === id);
        const next: Deal = { ...deal, id, linkedEntryId: existing?.linkedEntryId };
        const { entries, linkedEntryId } = withDealEntries(prev.entries, next, prev.clearedDealEntries, prev.clearedDealSales, existing);
        return { ...prev, entries, deals: prev.deals.map((d) => (d.id === id ? { ...next, linkedEntryId } : d)) };
      });
    },
    [mutate],
  );

  const deleteDeal = useCallback(
    (id: string) => {
      mutate((prev) => {
        const existing = prev.deals.find((d) => d.id === id);
        const entries = existing ? prev.entries.filter((e) => !isDealEntry(e, existing)) : prev.entries;
        return { ...prev, entries, deals: prev.deals.filter((d) => d.id !== id) };
      });
    },
    [mutate],
  );

  const setInstallmentPaid = useCallback(
    (dealId: string, installmentId: string, paid: boolean) => {
      mutate((prev) => {
        const existing = prev.deals.find((d) => d.id === dealId);
        if (!existing) return prev;
        const deal: Deal = {
          ...existing,
          installments: existing.installments.map((i) =>
            i.id === installmentId ? { ...i, paid, paidDate: paid ? todayISO() : undefined } : i,
          ),
        };
        const deals = prev.deals.map((d) => (d.id === dealId ? deal : d));
        const rate = dealRate(deal);
        if (rate === null) return { ...prev, deals };
        // Only the installment entries are rebuilt; the close entry (and any edits to it) stays.
        const entries = prev.entries.filter((e) => !(e.dealId === dealId && e.id !== deal.linkedEntryId));
        const installmentEntries = dealEntries(deal, rate)
          .slice(1)
          .map((e) => ({ ...e, id: uuid() }))
          .filter((e) => !isClearedDealEntry(e, deal, prev.clearedDealEntries));
        return { ...prev, deals, entries: [...entries, ...installmentEntries] };
      });
    },
    [mutate],
  );

  const applyDealRates = useCallback(
    (rates: Map<string, number>) => {
      mutate((prev) => applyCommissionRates(prev, rates));
    },
    [mutate],
  );

  const dismissCommissionFixes = useCallback(() => {
    mutate((prev) => ({ ...prev, commissionFixes: undefined }));
  }, [mutate]);

  const deleteToRecentlyDeleted = useCallback(
    (ids: ReadonlySet<string>) => {
      mutate((prev) => moveToRecentlyDeleted(prev, ids, new Date().toISOString()));
    },
    [mutate],
  );

  const restoreRecentlyDeleted = useCallback(
    (ids?: ReadonlySet<string>) => {
      mutate((prev) => restoreDeleted(prev, ids));
    },
    [mutate],
  );

  const emptyRecentlyDeleted = useCallback(() => {
    mutate((prev) => ({ ...prev, recentlyDeleted: [] }));
  }, [mutate]);

  const clearSales = useCallback(
    (ids: ReadonlySet<string>) => {
      mutate((prev) => clearSalesData(prev, ids, new Date().toISOString()));
    },
    [mutate],
  );

  const restoreSales = useCallback(
    (ids?: ReadonlySet<string>) => {
      mutate((prev) => restoreSalesData(prev, ids));
    },
    [mutate],
  );

  const emptyRecentlyDeletedSales = useCallback(() => {
    mutate((prev) => ({ ...prev, recentlyDeletedSales: [] }));
  }, [mutate]);

  const value = useMemo<DataContextValue>(
    () => ({
      roles: data.roles,
      entries: data.entries,
      monthlyGoals: data.monthlyGoals,
      deductions: data.deductions,
      superContributions: data.superContributions,
      deals: data.deals,
      commissionFixes: data.commissionFixes ?? [],
      recentlyDeleted: data.recentlyDeleted ?? [],
      recentlyDeletedSales: data.recentlyDeletedSales ?? [],
      saveStatus,
      saveError,
      retrySave,
      refresh,
      importLocalData,
      addRole,
      renameRole,
      setRoleColor,
      archiveRole,
      setRoleRate,
      deleteRole,
      assignRole,
      addEntry,
      updateEntry,
      deleteEntry,
      setMonthlyGoal,
      addDeduction,
      updateDeduction,
      deleteDeduction,
      addSuperContribution,
      updateSuperContribution,
      deleteSuperContribution,
      addDeal,
      updateDeal,
      deleteDeal,
      setInstallmentPaid,
      applyDealRates,
      dismissCommissionFixes,
      deleteToRecentlyDeleted,
      restoreRecentlyDeleted,
      emptyRecentlyDeleted,
      clearSales,
      restoreSales,
      emptyRecentlyDeletedSales,
    }),
    [
      data,
      saveStatus,
      saveError,
      retrySave,
      refresh,
      importLocalData,
      addRole,
      renameRole,
      setRoleColor,
      archiveRole,
      setRoleRate,
      deleteRole,
      assignRole,
      addEntry,
      updateEntry,
      deleteEntry,
      setMonthlyGoal,
      addDeduction,
      updateDeduction,
      deleteDeduction,
      addSuperContribution,
      updateSuperContribution,
      deleteSuperContribution,
      addDeal,
      updateDeal,
      deleteDeal,
      setInstallmentPaid,
      applyDealRates,
      dismissCommissionFixes,
      deleteToRecentlyDeleted,
      restoreRecentlyDeleted,
      emptyRecentlyDeleted,
      clearSales,
      restoreSales,
      emptyRecentlyDeletedSales,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
