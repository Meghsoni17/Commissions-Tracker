import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useData } from '../context/DataContext';
import type { Deduction } from '../types';
import { DEDUCTION_CATEGORIES } from '../types';
import { StatTile } from '../components/StatTile';
import { DeductionsPieChart, type DeductionSlice } from '../components/charts/DeductionsPieChart';
import { formatCurrency, sumEntries } from '../lib/calculations';
import { todayISO } from '../lib/dateUtils';
import { currentFYKey, fyKeyForISODate, fyKeyOptions, fyLabel, isISODateInFY } from '../lib/financialYear';
import { bracketsForFY, calculateIncomeTax, calculateMedicareLevy, hasBracketsForFY } from '../lib/taxBrackets';

const CUSTOM_CATEGORY = '__custom__';

interface DeductionFormState {
  description: string;
  amount: string;
  categoryChoice: string;
  customCategory: string;
}

function emptyForm(): DeductionFormState {
  return { description: '', amount: '', categoryChoice: DEDUCTION_CATEGORIES[0], customCategory: '' };
}

export function TaxPage() {
  const { entries, deductions, addDeduction, updateDeduction, deleteDeduction } = useData();
  const [selectedFY, setSelectedFY] = useState(currentFYKey());
  const [form, setForm] = useState<DeductionFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fyOptions = useMemo(() => {
    const known = [...entries.map((e) => fyKeyForISODate(e.weekStart)), ...deductions.map((d) => d.financialYear)];
    return fyKeyOptions(known);
  }, [entries, deductions]);

  const fyEntries = useMemo(() => entries.filter((e) => isISODateInFY(e.weekStart, selectedFY)), [entries, selectedFY]);
  const grossIncome = useMemo(() => sumEntries(fyEntries).commission, [fyEntries]);

  const fyDeductions = useMemo(
    () => deductions.filter((d) => d.financialYear === selectedFY).sort((a, b) => b.amount - a.amount),
    [deductions, selectedFY],
  );
  const totalDeductions = useMemo(() => fyDeductions.reduce((sum, d) => sum + d.amount, 0), [fyDeductions]);

  const pieData = useMemo<DeductionSlice[]>(() => {
    const map = new Map<string, number>();
    for (const d of fyDeductions) {
      map.set(d.category, (map.get(d.category) ?? 0) + d.amount);
    }
    return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [fyDeductions]);

  const brackets = useMemo(() => bracketsForFY(selectedFY), [selectedFY]);

  const taxBefore = calculateIncomeTax(grossIncome, brackets);
  const medicareBefore = calculateMedicareLevy(grossIncome);
  const totalBefore = taxBefore + medicareBefore;

  const taxableAfter = Math.max(0, grossIncome - totalDeductions);
  const taxAfter = calculateIncomeTax(taxableAfter, brackets);
  const medicareAfter = calculateMedicareLevy(taxableAfter);
  const totalAfter = taxAfter + medicareAfter;

  const savings = totalBefore - totalAfter;

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
  }

  function startEdit(d: Deduction) {
    const isStandard = (DEDUCTION_CATEGORIES as readonly string[]).includes(d.category);
    setEditingId(d.id);
    setForm({
      description: d.description,
      amount: String(d.amount),
      categoryChoice: isStandard ? d.category : CUSTOM_CATEGORY,
      customCategory: isStandard ? '' : d.category,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount) || 0;
    const category = form.categoryChoice === CUSTOM_CATEGORY ? form.customCategory.trim() : form.categoryChoice;
    const description = form.description.trim();
    if (!description || !category || amount <= 0) return;

    const existing = editingId ? deductions.find((d) => d.id === editingId) : undefined;
    const payload: Omit<Deduction, 'id'> = {
      financialYear: existing?.financialYear ?? selectedFY,
      description,
      category,
      amount,
      createdAt: existing?.createdAt ?? todayISO(),
    };
    if (editingId) {
      updateDeduction(editingId, payload);
    } else {
      addDeduction(payload);
    }
    resetForm();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Tax estimate</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Estimate your Australian income tax on logged commission income, by financial year.
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
        <strong style={{ color: 'var(--text-primary)' }}>Estimate only — not financial or tax advice.</strong> Actual tax
        payable may differ due to other income, tax offsets, HECS/HELP debt repayments, private health insurance, or
        other circumstances not accounted for here.
        {!hasBracketsForFY(selectedFY) && (
          <> No published ATO bracket rates are configured yet for {fyLabel(selectedFY)} — showing estimates using the latest available rates instead.</>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TaxSummaryCard title="Before deductions" taxableIncome={grossIncome} incomeTax={taxBefore} medicare={medicareBefore} total={totalBefore} />
        <TaxSummaryCard title="After deductions" taxableIncome={taxableAfter} incomeTax={taxAfter} medicare={medicareAfter} total={totalAfter} highlight />
        <div
          className="rounded-xl border p-4 flex flex-col items-center justify-center gap-1 text-center"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
        >
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Estimated tax saving
          </span>
          <span className="text-3xl font-semibold" style={{ color: 'var(--success)' }}>
            {formatCurrency(savings)}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            from {formatCurrency(totalDeductions)} in deductions
          </span>
        </div>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <h3 className="text-sm font-medium mb-3">Deductions — {fyLabel(selectedFY)}</h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatTile label="Deductions logged" value={String(fyDeductions.length)} />
          <StatTile label="Total deducted" value={formatCurrency(totalDeductions)} />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Field label="Description">
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Fuel for client visits"
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                style={inputStyle}
              />
            </Field>
            <Field label="Category">
              <select
                value={form.categoryChoice}
                onChange={(e) => setForm((f) => ({ ...f, categoryChoice: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                style={inputStyle}
              >
                {DEDUCTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={CUSTOM_CATEGORY}>Custom…</option>
              </select>
            </Field>
            {form.categoryChoice === CUSTOM_CATEGORY && (
              <Field label="Custom category">
                <input
                  value={form.customCategory}
                  onChange={(e) => setForm((f) => ({ ...f, customCategory: e.target.value }))}
                  placeholder="Category name"
                  className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                  style={inputStyle}
                />
              </Field>
            )}
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
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg px-4 py-2 text-sm font-medium cursor-pointer text-white"
              style={{ background: 'var(--series-1)' }}
            >
              {editingId ? 'Save changes' : 'Add deduction'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm border-collapse min-w-[560px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Description', 'Category', 'Amount', ''].map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fyDeductions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                    No deductions logged for {fyLabel(selectedFY)} yet.
                  </td>
                </tr>
              )}
              {fyDeductions.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-3 py-2">{d.description}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                    {d.category}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-medium">{formatCurrency(d.amount)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => startEdit(d)} className="text-xs mr-2 underline cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                      Edit
                    </button>
                    <button onClick={() => deleteDeduction(d.id)} className="text-xs underline cursor-pointer" style={{ color: 'var(--critical)' }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <h3 className="text-sm font-medium mb-3">Deductions by category</h3>
        <DeductionsPieChart data={pieData} />
      </div>
    </div>
  );
}

function TaxSummaryCard({
  title,
  taxableIncome,
  incomeTax,
  medicare,
  total,
  highlight,
}: {
  title: string;
  taxableIncome: number;
  incomeTax: number;
  medicare: number;
  total: number;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-2"
      style={{ borderColor: highlight ? 'var(--series-1)' : 'var(--border)', background: 'var(--surface-1)' }}
    >
      <h4 className="text-sm font-medium">{title}</h4>
      <TaxRow label="Taxable income" value={formatCurrency(taxableIncome)} />
      <TaxRow label="Income tax" value={formatCurrency(incomeTax)} />
      <TaxRow label="Medicare levy (2%)" value={formatCurrency(medicare)} />
      <div className="pt-2 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
        <TaxRow label="Total estimated tax" value={formatCurrency(total)} bold />
      </div>
    </div>
  );
}

function TaxRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-semibold text-base' : ''}`}>{value}</span>
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
