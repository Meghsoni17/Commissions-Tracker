import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import type { WeekEntry } from '../types';
import { weekStartISO, formatWeekLabel } from '../lib/dateUtils';
import { closeRate, formatCurrency, formatPercent, showRate } from '../lib/calculations';
import { RoleBadge } from '../components/RoleBadge';

interface FormState {
  roleId: string;
  weekStart: string;
  booked: string;
  showed: string;
  closed: string;
  commission: string;
  notes: string;
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
  const { roles, entries, addEntry, updateEntry, deleteEntry } = useData();
  const activeRoles = roles.filter((r) => !r.archived);
  const [form, setForm] = useState<FormState>(() => emptyForm(activeRoles[0]?.id ?? ''));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const sortedEntries = useMemo(
    () =>
      [...entries]
        .filter((e) => roleFilter === 'all' || e.roleId === roleFilter)
        .sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    [entries, roleFilter],
  );

  function resetForm() {
    setForm(emptyForm(activeRoles[0]?.id ?? ''));
    setEditingId(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.roleId) return;
    const payload: Omit<WeekEntry, 'id'> = {
      roleId: form.roleId,
      weekStart: weekStartISO(new Date(form.weekStart)),
      booked: Number(form.booked) || 0,
      showed: Number(form.showed) || 0,
      closed: Number(form.closed) || 0,
      commission: Number(form.commission) || 0,
      notes: form.notes.trim() || undefined,
    };
    if (editingId) {
      updateEntry(editingId, payload);
    } else {
      addEntry(payload);
    }
    resetForm();
  }

  function startEdit(entry: WeekEntry) {
    setEditingId(entry.id);
    setForm({
      roleId: entry.roleId,
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
        {roles.length > 0 && (
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          >
            <option value="all">All Roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </div>

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
            <Field label="Role">
              <select
                value={form.roleId}
                onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                style={inputStyle}
              >
                {activeRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
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
              disabled={invalidShow || invalidClose}
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
              {['Week', 'Role', 'Booked', 'Showed', 'Closed', 'Show Rate', 'Close Rate', 'Commission', ''].map((h) => (
                <th
                  key={h}
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
                <td colSpan={9} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>
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
                  <td className="px-3 py-2 whitespace-nowrap">{formatWeekLabel(entry.weekStart)}</td>
                  <td className="px-3 py-2">
                    {role ? <RoleBadge name={role.name} colorSlot={role.colorSlot} /> : '—'}
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
