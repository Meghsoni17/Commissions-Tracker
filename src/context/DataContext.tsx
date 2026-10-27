import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { v4 as uuid } from 'uuid';
import type { AppData, CommissionFix, Deal, Deduction, MonthlyGoal, Role, SuperContribution, WeekEntry } from '../types';
import { saveVault } from '../lib/vault';
import { todayISO } from '../lib/dateUtils';
import { applyCommissionRates, dealEntries, dealRate, isDealEntry } from '../lib/deals';

interface DataContextValue {
  roles: Role[];
  entries: WeekEntry[];
  monthlyGoals: MonthlyGoal[];
  deductions: Deduction[];
  superContributions: SuperContribution[];
  deals: Deal[];
  commissionFixes: CommissionFix[];
  isSampleData: boolean;
  addRole: (name: string) => void;
  renameRole: (id: string, name: string) => void;
  setRoleColor: (id: string, colorSlot: number) => void;
  archiveRole: (id: string, archived: boolean) => void;
  setRoleRate: (id: string, commissionRate: number | undefined) => void;
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
  clearSampleData: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

const NEXT_COLOR_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Swaps a deal's generated entries (close + paid installments) for fresh ones at its rate. Deals
 * saved before rates existed have none, so their entries stay as they are until reviewed.
 */
function withDealEntries(entries: WeekEntry[], deal: Deal, previous?: Deal): { entries: WeekEntry[]; linkedEntryId?: string } {
  const rate = dealRate(deal);
  if (rate === null) return { entries, linkedEntryId: deal.linkedEntryId };
  const kept = entries.filter((e) => !isDealEntry(e, previous ?? deal));
  const fresh = dealEntries(deal, rate).map((e) => ({ ...e, id: uuid() }));
  return { entries: [...kept, ...fresh], linkedEntryId: fresh[0].id };
}

export function DataProvider({
  cryptoKey,
  initialData,
  children,
}: {
  cryptoKey: CryptoKey;
  initialData: AppData;
  children: ReactNode;
}) {
  const [data, setData] = useState<AppData>(initialData);

  useEffect(() => {
    saveVault(cryptoKey, data).catch((err) => {
      console.error('Failed to save encrypted data:', err);
    });
  }, [cryptoKey, data]);

  const mutate = useCallback((fn: (prev: AppData) => AppData) => {
    setData((prev) => ({ ...fn(prev), isSample: false }));
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
        const { entries, linkedEntryId } = withDealEntries(prev.entries, newDeal);
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
        const { entries, linkedEntryId } = withDealEntries(prev.entries, next, existing);
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
          .map((e) => ({ ...e, id: uuid() }));
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

  const clearSampleData = useCallback(() => {
    setData({ roles: [], entries: [], monthlyGoals: [], deductions: [], superContributions: [], deals: [], isSample: false });
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      roles: data.roles,
      entries: data.entries,
      monthlyGoals: data.monthlyGoals,
      deductions: data.deductions,
      superContributions: data.superContributions,
      deals: data.deals,
      commissionFixes: data.commissionFixes ?? [],
      isSampleData: data.isSample === true,
      addRole,
      renameRole,
      setRoleColor,
      archiveRole,
      setRoleRate,
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
      clearSampleData,
    }),
    [
      data,
      addRole,
      renameRole,
      setRoleColor,
      archiveRole,
      setRoleRate,
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
      clearSampleData,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
