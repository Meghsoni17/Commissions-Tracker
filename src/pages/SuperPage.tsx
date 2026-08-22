import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useData } from '../context/DataContext';
import type { SuperContribution } from '../types';
import { StatTile } from '../components/StatTile';
import { ProgressBar } from '../components/ProgressBar';
import { formatCurrencyExact, formatPercent, sumEntries } from '../lib/calculations';
import { formatShortDate, todayISO } from '../lib/dateUtils';
import { currentFYKey, fyKeyForISODate, fyKeyOptions, fyLabel, isISODateInFY } from '../lib/financialYear';
import { SUPER_GUARANTEE_RATE, suggestedSuperContribution } from '../lib/super';

interface ContributionFormState {
  date: string;
  amount: string;
  notes: string;
}

function emptyForm(): ContributionFormState {
  return { date: todayISO(), amount: '', notes: '' };
}

export function SuperPage() {
  const { entries, superContributions, addSuperContribution, updateSuperContribution, deleteSuperContribution } =
    useData();
  const [selectedFY, setSelectedFY] = useState(currentFYKey());
  const [form, setForm] = useState<ContributionFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fyOptions = useMemo(() => {
    const known = [
      ...entries.map((e) => fyKeyForISODate(e.weekStart)),
      ...superContributions.map((s) => fyKeyForISODate(s.date)),
    ];
    return fyKeyOptions(known);
  }, [entries, superContributions]);

  const fyEntries = useMemo(() => entries.filter((e) => isISODateInFY(e.weekStart, selectedFY)), [entries, selectedFY]);
  const grossIncome = useMemo(() => sumEntries(fyEntries).commission, [fyEntries]);
  const suggested = useMemo(() => suggestedSuperContribution(grossIncome), [grossIncome]);

  const fyContributions = useMemo(
    () =>
      superContributions
        .filter((s) => isISODateInFY(s.date, selectedFY))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [superContributions, selectedFY],
  );
  const totalContributed = useMemo(() => fyContributions.reduce((sum, s) => sum + s.amount, 0), [fyContributions]);

  const gap = suggested - totalContributed;
  const pct = suggested > 0 ? totalContributed / suggested : totalContributed > 0 ? 1 : 0;

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
  }

  function startEdit(s: SuperContribution) {
    setEditingId(s.id);
    setForm({ date: s.date, amount: String(s.amount), notes: s.notes ?? '' });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount) || 0;
    if (!form.date || amount <= 0) return;
    const payload: Omit<SuperContribution, 'id'> = {
      date: form.date,
      amount,
      notes: form.notes.trim() || undefined,
    };
    if (editingId) {
      updateSuperContribution(editingId, payload);
    } else {
      addSuperContribution(payload);
    }
    resetForm();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Super</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Track personal super contributions against a suggested {formatPercent(SUPER_GUARANTEE_RATE)} of your
            commission income, by financial year.
          </p>
        </div>
        <select
          value={selectedFY}
          onChange={(e) => setSelectedFY(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        >
          {fyOptions.map((fy) => (
            <option key={fy} value={fy}>
              {fyLabel(fy)}
            </option>
          ))}
        </select>
      </div>

      <div
        className="rounded-lg border px-4 py-3 text-xs"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-secondary)' }}
      >
        <strong style={{ color: 'var(--text-primary)' }}>Reference only — not financial advice.</strong> The
        suggested figure is a simple {formatPercent(SUPER_GUARANTEE_RATE)} guide based on your logged commission
        income, as if you were paying yourself super the way an employer would. It isn't a legal requirement or a
        substitute for advice from a licensed financial adviser or accountant.
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <h3 className="text-sm font-medium mb-3">Contributed Vs Suggested Super — {fyLabel(selectedFY)}</h3>
        <div className="flex items-baseline justify-between text-sm mb-1.5">
          <span className="tabular-nums font-medium">
            {formatCurrencyExact(totalContributed)}{' '}
            <span style={{ color: 'var(--text-muted)' }}>
              of {formatCurrencyExact(suggested)} suggested ({formatPercent(SUPER_GUARANTEE_RATE)} of{' '}
              {formatCurrencyExact(grossIncome)} gross income)
            </span>
          </span>
          <span className="tabular-nums" style={{ color: pct >= 1 ? 'var(--success)' : 'var(--text-secondary)' }}>
            {formatPercent(pct)}
          </span>
        </div>
        <ProgressBar value={pct} color={pct >= 1 ? 'var(--success)' : 'var(--series-1)'} />
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          {gap > 0
            ? `${formatCurrencyExact(gap)} short of the suggested amount.`
            : `${formatCurrencyExact(-gap)} ahead of the suggested amount.`}
        </p>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <h3 className="text-sm font-medium mb-3">Contributions — {fyLabel(selectedFY)}</h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatTile label="Contributions Logged" value={String(fyContributions.length)} />
          <StatTile label="Total Contributed" value={formatCurrencyExact(totalContributed)} />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Field label="Date">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                style={inputStyle}
              />
            </Field>
            <Field label="Amount ($)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none tabular-nums"
                style={inputStyle}
              />
            </Field>
            <Field label="Notes">
              <input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. AustralianSuper"
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                style={inputStyle}
              />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg px-4 py-2 text-sm font-medium cursor-pointer text-white"
              style={{ background: 'var(--series-1)' }}
            >
              {editingId ? 'Save Changes' : 'Add Contribution'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm border-collapse min-w-[480px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Date', 'Amount', 'Notes', ''].map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fyContributions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                    No super contributions logged for {fyLabel(selectedFY)} yet.
                  </td>
                </tr>
              )}
              {fyContributions.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                    {formatShortDate(s.date)}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-medium">{formatCurrencyExact(s.amount)}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                    {s.notes || '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => startEdit(s)} className="text-xs mr-2 underline cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                      Edit
                    </button>
                    <button onClick={() => deleteSuperContribution(s.id)} className="text-xs underline cursor-pointer" style={{ color: 'var(--critical)' }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  borderColor: 'var(--border)',
  background: 'var(--surface-3)',
  color: 'var(--text-primary)',
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
      {label}
      {children}
    </label>
  );
}
