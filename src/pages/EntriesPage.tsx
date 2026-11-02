import { useMemo, useState } from 'react';
import { parseISO } from 'date-fns';
import { useData } from '../context/DataContext';
import type { DayAmount, WeekEntry } from '../types';
import { weekStartISO, formatWeekLabel, weekMonthSegments, weekStraddlesMonths } from '../lib/dateUtils';
import {
  closeRate,
  formatCurrency,
  formatPercent,
  hasDayBreakdown,
  isValidDayBreakdown,
  showRate,
} from '../lib/calculations';
import { RoleTag } from '../components/RoleBadge';
import { PeriodSelect, RoleFilterSelect } from '../components/SalesFilters';
import { SalesComparisonTable } from '../components/SalesComparisonTable';
import { ALL_ROLES, UNASSIGNED, matchesRole, roleKey } from '../lib/roles';
import { ALL_TIME, inSalesPeriod, salesBreakdown, salesPeriodLabel } from '../lib/salesStats';
import { DayBreakdownDialog } from '../components/DayBreakdownDialog';
import { RecentlyDeleted } from '../components/RecentlyDeleted';
import { RecentlyDeletedSales } from '../components/RecentlyDeletedSales';
import { ResetByDateRangeDialog } from '../components/ResetByDateRangeDialog';
import { ResetSalesDataDialog } from '../components/ResetSalesDataDialog';

interface FormState {
  roleId: string;
  weekStart: string;
  booked: string;
  showed: string;
  closed: string;
  commission: string;
  notes: string;
}

/**
 * An open day-breakdown step. `entryId` is null when the entry isn't saved yet: a week that
 * straddles two months is only saved once its breakdown is confirmed.
 */
interface BreakdownPrompt {
  entryId: string | null;
  payload: Omit<WeekEntry, 'id'>;
  required: boolean;
  dismissLabel: string;
  allowRemove: boolean;
}

/** "28–30 Sep: $X | 1–4 Oct: $Y" for an entry whose day breakdown spans two months. */
function monthSplitLabel(entry: WeekEntry): string {
  return weekMonthSegments(entry.weekStart)
    .map((seg) => {
      const amount = (entry.dayBreakdown ?? [])
        .filter((d) => d.date >= seg.startISO && d.date <= seg.endISO)
        .reduce((sum, d) => sum + d.amount, 0);
      return `${seg.label}: ${formatCurrency(amount)}`;
    })
    .join(' | ');
}

function emptyForm(defaultRoleId: string): FormState {
  return {
    roleId: defaultRoleId,
    weekStart: weekStartISO(),
    booked: '',
    showed: '',
    closed: '',
    commission: '',
    notes: '',
  };
}

export function EntriesPage() {
  const { roles, entries, addEntry, updateEntry, deleteEntry, assignRole } = useData();
  const activeRoles = roles.filter((r) => !r.archived);
  const [form, setForm] = useState<FormState>(() => emptyForm(activeRoles[0]?.id ?? ''));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>(ALL_ROLES);
  const [period, setPeriod] = useState(ALL_TIME);
  const [assignIds, setAssignIds] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState('');
  const [prompt, setPrompt] = useState<BreakdownPrompt | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [salesResetOpen, setSalesResetOpen] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const sortedEntries = useMemo(
    () =>
      [...entries]
        .filter((e) => matchesRole(e, roles, roleFilter) && inSalesPeriod(e, period))
        .sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    [entries, roles, roleFilter, period],
  );

  const breakdown = useMemo(() => salesBreakdown(entries, roles, roleFilter, period), [entries, roles, roleFilter, period]);
  const unassigned = useMemo(() => entries.filter((e) => roleKey(e.roleId, roles) === UNASSIGNED), [entries, roles]);
  const assignable = unassigned.filter((e) => assignIds.has(e.id));

  function toggleAssign(id: string, checked: boolean) {
    setAssignIds((cur) => {
      const next = new Set(cur);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function runAssign() {
    if (!assignTo || assignable.length === 0) return;
    assignRole(new Set(assignable.map((e) => e.id)), assignTo);
    setResetNotice(`Assigned ${assignable.length} ${assignable.length === 1 ? 'Entry' : 'Entries'} To ${roleById.get(assignTo)?.name}.`);
    setAssignIds(new Set());
  }

  function resetForm() {
    setForm(emptyForm(activeRoles[0]?.id ?? ''));
    setEditingId(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.roleId) return;
    const existing = editingId ? entries.find((en) => en.id === editingId) : undefined;
    const weekStart = weekStartISO(parseISO(form.weekStart));
    const commission = Number(form.commission) || 0;
    // An existing breakdown is kept only while it still matches this week and total exactly.
    const keptBreakdown = isValidDayBreakdown(weekStart, commission, existing?.dayBreakdown)
      ? existing?.dayBreakdown
      : undefined;
    const payload: Omit<WeekEntry, 'id'> = {
      roleId: form.roleId,
      weekStart,
      booked: Number(form.booked) || 0,
      showed: Number(form.showed) || 0,
      closed: Number(form.closed) || 0,
      commission,
      notes: form.notes.trim() || undefined,
      dayBreakdown: keptBreakdown,
    };

    // A week crossing two months needs its breakdown before it's saved; Back returns to the form.
    if (commission > 0 && weekStraddlesMonths(weekStart) && !keptBreakdown) {
      setPrompt({ entryId: editingId, payload, required: true, dismissLabel: 'Back', allowRemove: false });
      return;
    }

    const id = editingId ?? addEntry(payload);
    if (editingId) updateEntry(editingId, payload);
    resetForm();

    // Single-month week: saved already; offer the optional breakdown for new entries or a changed total.
    const totalChanged = !existing || existing.commission !== commission || existing.weekStart !== weekStart;
    if (commission > 0 && !weekStraddlesMonths(weekStart) && totalChanged) {
      setPrompt({ entryId: id, payload, required: false, dismissLabel: 'Skip', allowRemove: false });
    }
  }

  function openBreakdown(entry: WeekEntry) {
    const { id, ...payload } = entry;
    const required = weekStraddlesMonths(entry.weekStart);
    setPrompt({ entryId: id, payload, required, dismissLabel: 'Cancel', allowRemove: !required && hasDayBreakdown(entry) });
  }

  function confirmBreakdown(dayBreakdown: DayAmount[]) {
    if (!prompt) return;
    const payload = { ...prompt.payload, dayBreakdown };
    if (prompt.entryId) {
      updateEntry(prompt.entryId, payload);
    } else {
      addEntry(payload);
    }
    if (editingId === prompt.entryId || prompt.entryId === null) resetForm();
    setPrompt(null);
  }

  function removeBreakdown() {
    if (!prompt?.entryId) return;
    updateEntry(prompt.entryId, { ...prompt.payload, dayBreakdown: undefined });
    setPrompt(null);
  }

  function startEdit(entry: WeekEntry) {
    setEditingId(entry.id);
    setForm({
      // An unassigned entry must get a real role before it can be saved, so it isn't prefilled.
      roleId: roleById.has(entry.roleId) ? entry.roleId : '',
      weekStart: entry.weekStart,
      booked: String(entry.booked),
      showed: String(entry.showed),
      closed: String(entry.closed),
      commission: String(entry.commission),
      notes: entry.notes ?? '',
    });
  }

  const bookedNum = Number(form.booked) || 0;
  const showedNum = Number(form.showed) || 0;
  const closedNum = Number(form.closed) || 0;
  const invalidShow = showedNum > bookedNum && bookedNum > 0;
  const invalidClose = closedNum > showedNum && showedNum > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold">Weekly Entries</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setResetOpen(true)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium cursor-pointer"
            style={{ border: '1px solid var(--border)', color: 'var(--critical)' }}
          >
            Reset By Date Range
          </button>
          <button
            onClick={() => setSalesResetOpen(true)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium cursor-pointer"
            style={{ border: '1px solid var(--border)', color: 'var(--critical)' }}
          >
            Reset Sales Data
          </button>
          {roles.length > 0 && (
            <>
              <RoleFilterSelect value={roleFilter} onChange={setRoleFilter} />
              <PeriodSelect value={period} onChange={setPeriod} />
            </>
          )}
        </div>
      </div>

      {resetNotice && (
        <div
          role="status"
          className="rounded-lg border px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-secondary)' }}
        >
          <span>{resetNotice}</span>
          <button onClick={() => setResetNotice(null)} className="text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            Dismiss
          </button>
        </div>
      )}

      {unassigned.length > 0 && (
        <div
          className="rounded-lg p-3 flex flex-col gap-2 text-sm"
          style={{
            background: 'color-mix(in srgb, var(--warning) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--warning) 60%, transparent)',
          }}
        >
          <div>
            <h3 className="font-semibold">
              {unassigned.length} Unassigned {unassigned.length === 1 ? 'Entry' : 'Entries'}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              These still count in All Roles. Tick entries in the table, then assign them. An entry's commission moves
              to the role you choose, and total commission doesn't change.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setRoleFilter(UNASSIGNED)}
              className="rounded-md px-3 py-1 text-xs font-medium cursor-pointer"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              Show Unassigned
            </button>
            <button
              onClick={() => setAssignIds(new Set(unassigned.map((e) => e.id)))}
              className="rounded-md px-3 py-1 text-xs font-medium cursor-pointer"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              Select All Unassigned
            </button>
            <select
              aria-label="Role To Assign"
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
              className="rounded-md border px-2 py-1 text-xs outline-none"
              style={inputStyle}
            >
              <option value="">Choose A Role</option>
              {activeRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button
              onClick={runAssign}
              disabled={!assignTo || assignable.length === 0}
              className="rounded-md px-3 py-1 text-xs font-medium cursor-pointer text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--series-1)' }}
            >
              Assign {assignable.length} {assignable.length === 1 ? 'Entry' : 'Entries'}
            </button>
          </div>
        </div>
      )}

      {roles.length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          <h3 className="text-sm font-medium mb-3">Sales By Role — {salesPeriodLabel(period)}</h3>
          <SalesComparisonTable breakdown={breakdown} roleFilter={roleFilter} />
        </div>
      )}

      {activeRoles.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Add a role first (see the Roles tab), then log weekly numbers here.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border p-4 flex flex-col gap-3"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <Field label="Role" error={form.roleId ? undefined : 'Choose A Role'}>
              <select
                value={form.roleId}
                onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                style={inputStyle}
              >
                {!form.roleId && (
                  <option value="" disabled>
                    Unassigned
                  </option>
                )}
                {activeRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
                {roleById.get(form.roleId)?.archived && (
                  <option value={form.roleId}>{roleById.get(form.roleId)?.name} (Archived)</option>
                )}
              </select>
            </Field>
            <Field label="Week Of">
              <input
                type="date"
                value={form.weekStart}
                onChange={(e) => setForm((f) => ({ ...f, weekStart: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                style={inputStyle}
              />
            </Field>
            <Field label="Booked">
              <input
                type="number"
                min={0}
                value={form.booked}
                onChange={(e) => setForm((f) => ({ ...f, booked: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none tabular-nums"
                style={inputStyle}
              />
            </Field>
            <Field label="Showed" error={invalidShow ? 'Can’t exceed booked' : undefined}>
              <input
                type="number"
                min={0}
                value={form.showed}
                onChange={(e) => setForm((f) => ({ ...f, showed: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none tabular-nums"
                style={invalidShow ? { ...inputStyle, borderColor: 'var(--critical)' } : inputStyle}
              />
            </Field>
            <Field label="Closed" error={invalidClose ? 'Can’t exceed showed' : undefined}>
              <input
                type="number"
                min={0}
                value={form.closed}
                onChange={(e) => setForm((f) => ({ ...f, closed: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none tabular-nums"
                style={invalidClose ? { ...inputStyle, borderColor: 'var(--critical)' } : inputStyle}
              />
            </Field>
            <Field label="Commission ($)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.commission}
                onChange={(e) => setForm((f) => ({ ...f, commission: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none tabular-nums"
                style={inputStyle}
              />
            </Field>
          </div>
          <input
            type="text"
            placeholder="Notes (Optional)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
            style={inputStyle}
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={invalidShow || invalidClose || !form.roleId}
              className="rounded-lg px-4 py-2 text-sm font-medium cursor-pointer text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--series-1)' }}
            >
              {editingId ? 'Save Changes' : 'Add Entry'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm border-collapse min-w-[720px]">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['', 'Week', 'Role', 'Booked', 'Showed', 'Closed', 'Show Rate', 'Close Rate', 'Commission', ''].map((h, i) => (
                <th
                  key={i}
                  className="text-left px-3 py-2 font-medium"
                  style={{ color: 'var(--text-muted)', background: 'var(--surface-1)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedEntries.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                  No entries yet.
                </td>
              </tr>
            )}
            {sortedEntries.map((entry) => {
              const role = roleById.get(entry.roleId);
              const sr = showRate(entry.showed, entry.booked);
              const cr = closeRate(entry.closed, entry.showed);
              return (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="pl-3 py-2 w-6">
                    {!role && (
                      <input
                        type="checkbox"
                        checked={assignIds.has(entry.id)}
                        onChange={(e) => toggleAssign(entry.id, e.target.checked)}
                        aria-label={`Select Week Of ${formatWeekLabel(entry.weekStart)} To Assign A Role`}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatWeekLabel(entry.weekStart)}
                    {entry.commission > 0 && weekStraddlesMonths(entry.weekStart) && (
                      <div className="text-xs mt-0.5">
                        {hasDayBreakdown(entry) ? (
                          <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                            {monthSplitLabel(entry)}
                          </span>
                        ) : (
                          <button
                            onClick={() => openBreakdown(entry)}
                            title="This week crosses two months. Until you add a day breakdown, all of it counts in the first month."
                            className="rounded-md px-2 py-0.5 font-medium cursor-pointer"
                            style={{
                              color: 'var(--text-primary)',
                              background: 'color-mix(in srgb, var(--warning) 18%, transparent)',
                              border: '1px solid color-mix(in srgb, var(--warning) 60%, transparent)',
                            }}
                          >
                            Add Day Breakdown
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <RoleTag role={role} />
                  </td>
                  <td className="px-3 py-2 tabular-nums">{entry.booked}</td>
                  <td className="px-3 py-2 tabular-nums">{entry.showed}</td>
                  <td className="px-3 py-2 tabular-nums">{entry.closed}</td>
                  <td className="px-3 py-2 tabular-nums">{formatPercent(sr)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatPercent(cr)}</td>
                  <td className="px-3 py-2 tabular-nums font-medium">{formatCurrency(entry.commission)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => startEdit(entry)} className="text-xs mr-2 underline cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                      Edit
                    </button>
                    {entry.commission > 0 && (
                      <button
                        onClick={() => openBreakdown(entry)}
                        className="text-xs mr-2 underline cursor-pointer"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {hasDayBreakdown(entry) ? 'Edit Days' : 'Days'}
                      </button>
                    )}
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="text-xs underline cursor-pointer"
                      style={{ color: 'var(--critical)' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <RecentlyDeleted />
      <RecentlyDeletedSales />

      {resetOpen && (
        <ResetByDateRangeDialog
          onClose={() => setResetOpen(false)}
          onDeleted={(count) => {
            setResetOpen(false);
            setResetNotice(`Moved ${count} ${count === 1 ? 'Item' : 'Items'} To Recently Deleted.`);
          }}
        />
      )}

      {salesResetOpen && (
        <ResetSalesDataDialog
          onClose={() => setSalesResetOpen(false)}
          onCleared={(count) => {
            setSalesResetOpen(false);
            setResetNotice(`Cleared Sales Data From ${count} ${count === 1 ? 'Entry' : 'Entries'}. Commissions Are Unchanged.`);
          }}
        />
      )}

      {prompt && (
        <DayBreakdownDialog
          key={`${prompt.entryId ?? 'new'}-${prompt.payload.weekStart}-${prompt.payload.commission}`}
          weekStart={prompt.payload.weekStart}
          total={prompt.payload.commission}
          initial={prompt.payload.dayBreakdown}
          required={prompt.required}
          dismissLabel={prompt.dismissLabel}
          onConfirm={confirmBreakdown}
          onDismiss={() => setPrompt(null)}
          onRemove={prompt.allowRemove ? removeBreakdown : undefined}
        />
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  borderColor: 'var(--border)',
  background: 'var(--surface-3)',
  color: 'var(--text-primary)',
};

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
      {label}
      {children}
      {error && <span style={{ color: 'var(--critical)' }}>{error}</span>}
    </label>
  );
}
