/**
 * Supabase persistence for AppData. The app keeps working on one in-memory AppData object; this module
 * maps it to one table per collection, loads it, and saves changes by diffing the last saved copy against
 * the new one, so only rows that were added, changed or removed are sent.
 */
import type {
  AppData,
  ClearedDealEntry,
  CommissionFix,
  Deal,
  Deduction,
  DeletedItem,
  DeletedSalesItem,
  MonthlyGoal,
  Role,
  SuperContribution,
  WeekEntry,
} from '../types';
import { requireSupabase } from './supabase';
import { withoutExpired } from './reset';

type Row = Record<string, unknown>;

export interface PinRecord {
  hash: string;
  salt: string;
  iterations: number;
}

export interface CloudSnapshot {
  data: AppData;
  pin: PinRecord | null;
}

// ---------- value helpers ----------

/** Optional values: null in the database, absent (undefined) in the app. */
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);
const orNull = <T>(v: T | undefined): T | null => (v === undefined ? null : v);
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
const optNum = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : num(v));
const str = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));
/** Date columns can't hold '', so empty dates are stored as null. */
const dateOrNull = (v: string | undefined): string | null => (v ? v : null);

// ---------- per-table mapping ----------

interface TableSpec<T> {
  table: string;
  /** Column that, with user_id, is the primary key. */
  keyColumn: string;
  keyOf: (item: T) => string;
  select: (data: AppData) => T[];
  toRow: (item: T) => Row;
  fromRow: (row: Row) => T;
}

const rolesSpec: TableSpec<Role> = {
  table: 'roles',
  keyColumn: 'id',
  keyOf: (r) => r.id,
  select: (d) => d.roles,
  toRow: (r) => ({
    id: r.id,
    name: r.name,
    color_slot: r.colorSlot,
    archived: r.archived,
    created_at: dateOrNull(r.createdAt),
    commission_rate: orNull(r.commissionRate),
  }),
  fromRow: (row) => ({
    id: str(row.id),
    name: str(row.name),
    colorSlot: num(row.color_slot),
    archived: row.archived === true,
    createdAt: str(row.created_at),
    commissionRate: optNum(row.commission_rate),
  }),
};

const entriesSpec: TableSpec<WeekEntry> = {
  table: 'commission_entries',
  keyColumn: 'id',
  keyOf: (e) => e.id,
  select: (d) => d.entries,
  toRow: (e) => ({
    id: e.id,
    role_id: e.roleId,
    week_start: dateOrNull(e.weekStart),
    booked: e.booked,
    showed: e.showed,
    closed: e.closed,
    commission: e.commission,
    notes: orNull(e.notes),
    day_breakdown: orNull(e.dayBreakdown),
    deal_id: orNull(e.dealId),
  }),
  fromRow: (row) => ({
    id: str(row.id),
    roleId: str(row.role_id),
    weekStart: str(row.week_start),
    booked: num(row.booked),
    showed: num(row.showed),
    closed: num(row.closed),
    commission: num(row.commission),
    notes: opt(row.notes as string | null),
    dayBreakdown: Array.isArray(row.day_breakdown)
      ? (row.day_breakdown as { date: unknown; amount: unknown }[]).map((d) => ({ date: str(d.date), amount: num(d.amount) }))
      : undefined,
    dealId: opt(row.deal_id as string | null),
  }),
};

const dealsSpec: TableSpec<Deal> = {
  table: 'deals',
  keyColumn: 'id',
  keyOf: (d) => d.id,
  select: (d) => d.deals,
  toRow: (d) => ({
    id: d.id,
    role_id: d.roleId,
    client_name: d.clientName,
    sale_date: dateOrNull(d.saleDate),
    total_contract_value: d.totalContractValue,
    cash_collected_on_call: d.cashCollectedOnCall,
    payment_structure: d.paymentStructure,
    installments: d.installments,
    notes: orNull(d.notes),
    created_at: dateOrNull(d.createdAt),
    linked_entry_id: orNull(d.linkedEntryId),
    commission_rate: orNull(d.commissionRate),
  }),
  fromRow: (row) => ({
    id: str(row.id),
    roleId: str(row.role_id),
    clientName: str(row.client_name),
    saleDate: str(row.sale_date),
    totalContractValue: num(row.total_contract_value),
    cashCollectedOnCall: num(row.cash_collected_on_call),
    paymentStructure: str(row.payment_structure) as Deal['paymentStructure'],
    installments: Array.isArray(row.installments)
      ? (row.installments as Row[]).map((i) => ({
          id: str(i.id),
          dueDate: str(i.dueDate),
          amount: num(i.amount),
          paid: i.paid === true,
          paidDate: opt(i.paidDate as string | null | undefined),
        }))
      : [],
    notes: opt(row.notes as string | null),
    createdAt: str(row.created_at),
    linkedEntryId: opt(row.linked_entry_id as string | null),
    commissionRate: optNum(row.commission_rate),
  }),
};

const goalsSpec: TableSpec<MonthlyGoal> = {
  table: 'monthly_goals',
  keyColumn: 'month_key',
  keyOf: (g) => g.monthKey,
  select: (d) => d.monthlyGoals,
  toRow: (g) => ({ month_key: g.monthKey, amount: g.amount }),
  fromRow: (row) => ({ monthKey: str(row.month_key), amount: num(row.amount) }),
};

const deductionsSpec: TableSpec<Deduction> = {
  table: 'deductions',
  keyColumn: 'id',
  keyOf: (d) => d.id,
  select: (d) => d.deductions,
  toRow: (d) => ({
    id: d.id,
    financial_year: d.financialYear,
    description: d.description,
    category: d.category,
    amount: d.amount,
    purchase_date: dateOrNull(d.purchaseDate),
    vendor: d.vendor,
    payment_method: d.paymentMethod,
    notes: orNull(d.notes),
    created_at: dateOrNull(d.createdAt),
  }),
  fromRow: (row) => ({
    id: str(row.id),
    financialYear: str(row.financial_year),
    description: str(row.description),
    category: str(row.category),
    amount: num(row.amount),
    purchaseDate: str(row.purchase_date),
    vendor: str(row.vendor),
    paymentMethod: str(row.payment_method),
    notes: opt(row.notes as string | null),
    createdAt: str(row.created_at),
  }),
};

const superSpec: TableSpec<SuperContribution> = {
  table: 'super_contributions',
  keyColumn: 'id',
  keyOf: (s) => s.id,
  select: (d) => d.superContributions,
  toRow: (s) => ({ id: s.id, contribution_date: dateOrNull(s.date), amount: s.amount, notes: orNull(s.notes) }),
  fromRow: (row) => ({
    id: str(row.id),
    date: str(row.contribution_date),
    amount: num(row.amount),
    notes: opt(row.notes as string | null),
  }),
};

const recentlyDeletedSpec: TableSpec<DeletedItem> = {
  table: 'recently_deleted',
  keyColumn: 'id',
  keyOf: (d) => d.item.id,
  select: (d) => d.recentlyDeleted ?? [],
  toRow: (d) => ({
    id: d.item.id,
    item_type: d.type,
    deleted_at: d.deletedAt,
    item: d.item,
    deal_ref: d.type === 'commission' ? orNull(d.dealRef) : null,
  }),
  fromRow: (row) => {
    const deletedAt = str(row.deleted_at);
    switch (row.item_type) {
      case 'commission':
        return {
          type: 'commission',
          deletedAt,
          item: row.item as WeekEntry,
          dealRef: opt(row.deal_ref as ClearedDealEntry | null),
        };
      case 'deduction':
        return { type: 'deduction', deletedAt, item: row.item as Deduction };
      default:
        return { type: 'super', deletedAt, item: row.item as SuperContribution };
    }
  },
};

const recentlyDeletedSalesSpec: TableSpec<DeletedSalesItem> = {
  table: 'recently_deleted_sales',
  keyColumn: 'id',
  keyOf: (s) => s.id,
  select: (d) => d.recentlyDeletedSales ?? [],
  toRow: (s) => ({
    id: s.id,
    entry_id: s.entryId,
    role_id: s.roleId,
    week_start: dateOrNull(s.weekStart),
    booked: s.booked,
    showed: s.showed,
    closed: s.closed,
    deleted_at: s.deletedAt,
    deal_id: orNull(s.dealId),
  }),
  fromRow: (row) => ({
    id: str(row.id),
    entryId: str(row.entry_id),
    roleId: str(row.role_id),
    weekStart: str(row.week_start),
    booked: num(row.booked),
    showed: num(row.showed),
    closed: num(row.closed),
    deletedAt: str(row.deleted_at),
    dealId: opt(row.deal_id as string | null),
  }),
};

// The type parameter differs per table; the sync loop only needs the shared shape.
const TABLES = [
  rolesSpec,
  entriesSpec,
  dealsSpec,
  goalsSpec,
  deductionsSpec,
  superSpec,
  recentlyDeletedSpec,
  recentlyDeletedSalesSpec,
] as unknown as TableSpec<unknown>[];

// ---------- settings row ----------

interface SettingsFields {
  commissionFixes?: CommissionFix[];
  clearedDealEntries?: ClearedDealEntry[];
  clearedDealSales?: ClearedDealEntry[];
}

function settingsOf(data: AppData): SettingsFields {
  return {
    commissionFixes: data.commissionFixes,
    clearedDealEntries: data.clearedDealEntries,
    clearedDealSales: data.clearedDealSales,
  };
}

function settingsToRow(s: SettingsFields): Row {
  return {
    commission_fixes: orNull(s.commissionFixes),
    cleared_deal_entries: s.clearedDealEntries ?? [],
    cleared_deal_sales: s.clearedDealSales ?? [],
  };
}

// ---------- loading ----------

const PAGE_SIZE = 1000; // PostgREST's default max rows per request

async function fetchAllRows(table: string, keyColumn: string): Promise<Row[]> {
  const db = requireSupabase();
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from(table)
      .select('*')
      .order(keyColumn, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data as Row[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export const EMPTY_DATA: AppData = {
  roles: [],
  entries: [],
  monthlyGoals: [],
  deductions: [],
  superContributions: [],
  deals: [],
};

/** Loads everything the signed-in user has stored. RLS limits every query to their own rows. */
export async function fetchCloudData(): Promise<CloudSnapshot> {
  const db = requireSupabase();
  const [tableRows, settingsRes] = await Promise.all([
    Promise.all(TABLES.map((t) => fetchAllRows(t.table, t.keyColumn))),
    db.from('user_settings').select('*').maybeSingle(),
  ]);
  if (settingsRes.error) throw settingsRes.error;

  const [roles, entries, deals, monthlyGoals, deductions, superContributions, recentlyDeleted, recentlyDeletedSales] =
    tableRows.map((rows, i) => rows.map((r) => TABLES[i].fromRow(r)));

  const s = (settingsRes.data ?? {}) as Row;
  const data: AppData = {
    roles: roles as Role[],
    entries: entries as WeekEntry[],
    deals: deals as Deal[],
    monthlyGoals: monthlyGoals as MonthlyGoal[],
    deductions: deductions as Deduction[],
    superContributions: superContributions as SuperContribution[],
    recentlyDeleted: recentlyDeleted as DeletedItem[],
    recentlyDeletedSales: recentlyDeletedSales as DeletedSalesItem[],
    commissionFixes: Array.isArray(s.commission_fixes) ? (s.commission_fixes as CommissionFix[]) : undefined,
    clearedDealEntries: Array.isArray(s.cleared_deal_entries) ? (s.cleared_deal_entries as ClearedDealEntry[]) : [],
    clearedDealSales: Array.isArray(s.cleared_deal_sales) ? (s.cleared_deal_sales as ClearedDealEntry[]) : [],
  };
  const pin =
    typeof s.pin_hash === 'string' && typeof s.pin_salt === 'string'
      ? { hash: s.pin_hash, salt: s.pin_salt, iterations: num(s.pin_iterations) }
      : null;
  return { data, pin };
}

/** Recently Deleted items older than 30 days, dropped. Returns `data` itself when nothing expired. */
export function pruneExpired(data: AppData, nowMs = Date.now()): AppData {
  const bin = data.recentlyDeleted ?? [];
  const sales = data.recentlyDeletedSales ?? [];
  const keptBin = withoutExpired(bin, nowMs);
  const keptSales = withoutExpired(sales, nowMs);
  if (keptBin.length === bin.length && keptSales.length === sales.length) return data;
  return { ...data, recentlyDeleted: keptBin, recentlyDeletedSales: keptSales };
}

// ---------- saving ----------

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** True when `next` has anything that `prev` doesn't, i.e. there is something to save. */
export function hasChanges(prev: AppData, next: AppData): boolean {
  if (prev === next) return false;
  return TABLES.some((t) => !same(t.select(prev), t.select(next))) || !same(settingsOf(prev), settingsOf(next));
}

/**
 * Writes the difference between `prev` (what the database already has) and `next`. Upserts and deletes
 * are idempotent, so after a failure the same call can simply be retried.
 */
export async function pushChanges(userId: string, prev: AppData, next: AppData): Promise<void> {
  if (prev === next) return;
  const db = requireSupabase();

  for (const spec of TABLES) {
    const before = spec.select(prev);
    const after = spec.select(next);
    if (before === after) continue;

    const prevByKey = new Map(before.map((item) => [spec.keyOf(item), item]));
    // Keyed by id so a duplicate id can't appear twice in one upsert (Postgres rejects that).
    const changed = new Map<string, unknown>();
    const nextKeys = new Set<string>();
    for (const item of after) {
      const key = spec.keyOf(item);
      nextKeys.add(key);
      const old = prevByKey.get(key);
      if (old === undefined || !same(old, item)) changed.set(key, item);
    }
    const removed = [...prevByKey.keys()].filter((k) => !nextKeys.has(k));

    for (const batch of chunk([...changed.values()], 500)) {
      const rows = batch.map((item) => ({ ...spec.toRow(item), user_id: userId }));
      const { error } = await db.from(spec.table).upsert(rows, { onConflict: `user_id,${spec.keyColumn}` });
      if (error) throw error;
    }
    for (const batch of chunk(removed, 200)) {
      const { error } = await db.from(spec.table).delete().eq('user_id', userId).in(spec.keyColumn, batch);
      if (error) throw error;
    }
  }

  const settingsBefore = settingsOf(prev);
  const settingsAfter = settingsOf(next);
  if (!same(settingsBefore, settingsAfter)) {
    // Only these columns are sent, so the PIN columns in the same row are left untouched.
    const { error } = await db
      .from('user_settings')
      .upsert({ user_id: userId, ...settingsToRow(settingsAfter) }, { onConflict: 'user_id' });
    if (error) throw error;
  }
}

export async function savePinRecord(userId: string, pin: PinRecord): Promise<void> {
  const { error } = await requireSupabase()
    .from('user_settings')
    .upsert(
      { user_id: userId, pin_hash: pin.hash, pin_salt: pin.salt, pin_iterations: pin.iterations },
      { onConflict: 'user_id' },
    );
  if (error) throw error;
}

// ---------- importing this browser's old local data ----------

export interface ImportCounts {
  roles: number;
  entries: number;
  deals: number;
  monthlyGoals: number;
  deductions: number;
  superContributions: number;
}

function addMissing<T>(cloud: T[], local: T[], keyOf: (t: T) => string): { merged: T[]; added: number } {
  const have = new Set(cloud.map(keyOf));
  const extra: T[] = [];
  for (const item of local) {
    const key = keyOf(item);
    if (have.has(key)) continue;
    have.add(key);
    extra.push(item);
  }
  return { merged: extra.length > 0 ? [...cloud, ...extra] : cloud, added: extra.length };
}

const clearedKey = (c: ClearedDealEntry) => `${c.dealId}|${c.key}`;

/**
 * Adds local records that the cloud doesn't already have (matched by id; goals by month). Anything already
 * in the cloud wins, so importing twice never creates duplicates or overwrites newer cloud edits.
 */
export function mergeLocalIntoCloud(cloud: AppData, local: AppData): { merged: AppData; counts: ImportCounts } {
  const roles = addMissing(cloud.roles, local.roles, (r) => r.id);
  const entries = addMissing(cloud.entries, local.entries, (e) => e.id);
  const deals = addMissing(cloud.deals, local.deals, (d) => d.id);
  const goals = addMissing(cloud.monthlyGoals, local.monthlyGoals, (g) => g.monthKey);
  const deductions = addMissing(cloud.deductions, local.deductions, (d) => d.id);
  const supers = addMissing(cloud.superContributions, local.superContributions, (s) => s.id);
  const bin = addMissing(cloud.recentlyDeleted ?? [], local.recentlyDeleted ?? [], (d) => d.item.id);
  const sales = addMissing(cloud.recentlyDeletedSales ?? [], local.recentlyDeletedSales ?? [], (s) => s.id);
  const cleared = addMissing(cloud.clearedDealEntries ?? [], local.clearedDealEntries ?? [], clearedKey);
  const clearedSales = addMissing(cloud.clearedDealSales ?? [], local.clearedDealSales ?? [], clearedKey);

  return {
    merged: {
      ...cloud,
      roles: roles.merged,
      entries: entries.merged,
      deals: deals.merged,
      monthlyGoals: goals.merged,
      deductions: deductions.merged,
      superContributions: supers.merged,
      recentlyDeleted: bin.merged,
      recentlyDeletedSales: sales.merged,
      clearedDealEntries: cleared.merged,
      clearedDealSales: clearedSales.merged,
      commissionFixes: cloud.commissionFixes ?? local.commissionFixes,
    },
    counts: {
      roles: roles.added,
      entries: entries.added,
      deals: deals.added,
      monthlyGoals: goals.added,
      deductions: deductions.added,
      superContributions: supers.added,
    },
  };
}
