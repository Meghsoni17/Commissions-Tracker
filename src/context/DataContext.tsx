import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { v4 as uuid } from 'uuid';
import type { AppData, Deduction, MonthlyGoal, Role, SuperContribution, WeekEntry } from '../types';
import { saveVault } from '../lib/vault';

interface DataContextValue {
  roles: Role[];
  entries: WeekEntry[];
  monthlyGoals: MonthlyGoal[];
  deductions: Deduction[];
  superContributions: SuperContribution[];
  isSampleData: boolean;
  addRole: (name: string) => void;
  renameRole: (id: string, name: string) => void;
  setRoleColor: (id: string, colorSlot: number) => void;
  archiveRole: (id: string, archived: boolean) => void;
  addEntry: (entry: Omit<WeekEntry, 'id'>) => void;
  updateEntry: (id: string, entry: Omit<WeekEntry, 'id'>) => void;
  deleteEntry: (id: string) => void;
  setMonthlyGoal: (monthKey: string, amount: number) => void;
  addDeduction: (deduction: Omit<Deduction, 'id'>) => void;
  updateDeduction: (id: string, deduction: Omit<Deduction, 'id'>) => void;
  deleteDeduction: (id: string) => void;
  addSuperContribution: (contribution: Omit<SuperContribution, 'id'>) => void;
  updateSuperContribution: (id: string, contribution: Omit<SuperContribution, 'id'>) => void;
  deleteSuperContribution: (id: string) => void;
  clearSampleData: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

const NEXT_COLOR_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8];

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

  const addEntry = useCallback(
    (entry: Omit<WeekEntry, 'id'>) => {
      mutate((prev) => ({ ...prev, entries: [...prev.entries, { ...entry, id: uuid() }] }));
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

  const clearSampleData = useCallback(() => {
    setData({ roles: [], entries: [], monthlyGoals: [], deductions: [], superContributions: [], isSample: false });
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      roles: data.roles,
      entries: data.entries,
      monthlyGoals: data.monthlyGoals,
      deductions: data.deductions,
      superContributions: data.superContributions,
      isSampleData: data.isSample === true,
      addRole,
      renameRole,
      setRoleColor,
      archiveRole,
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
      clearSampleData,
    }),
    [
      data,
      addRole,
      renameRole,
      setRoleColor,
      archiveRole,
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
