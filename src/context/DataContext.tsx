import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { v4 as uuid } from 'uuid';
import type { AppData, Role, WeekEntry } from '../types';
import { loadData, saveData } from '../lib/storage';
import { buildSeedData } from '../lib/seedData';

interface DataContextValue {
  roles: Role[];
  entries: WeekEntry[];
  isSampleData: boolean;
  addRole: (name: string) => void;
  renameRole: (id: string, name: string) => void;
  setRoleColor: (id: string, colorSlot: number) => void;
  archiveRole: (id: string, archived: boolean) => void;
  addEntry: (entry: Omit<WeekEntry, 'id'>) => void;
  updateEntry: (id: string, entry: Omit<WeekEntry, 'id'>) => void;
  deleteEntry: (id: string) => void;
  clearSampleData: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

const NEXT_COLOR_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8];

function loadInitial(): AppData {
  const stored = loadData();
  if (stored) return stored;
  return { ...buildSeedData(), isSample: true };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadInitial);

  useEffect(() => {
    saveData(data);
  }, [data]);

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

  const clearSampleData = useCallback(() => {
    setData({ roles: [], entries: [], isSample: false });
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      roles: data.roles,
      entries: data.entries,
      isSampleData: data.isSample === true,
      addRole,
      renameRole,
      setRoleColor,
      archiveRole,
      addEntry,
      updateEntry,
      deleteEntry,
      clearSampleData,
    }),
    [data, addRole, renameRole, setRoleColor, archiveRole, addEntry, updateEntry, deleteEntry, clearSampleData],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
