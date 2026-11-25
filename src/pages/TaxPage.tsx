import { Fragment, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useData } from '../context/DataContext';
import type { Deduction, RecurringDeduction, RecurringFrequency } from '../types';
import { DEDUCTION_CATEGORIES, PAYMENT_METHODS, RECURRING_FREQUENCIES } from '../types';
import { StatTile } from '../components/StatTile';
import { DeductionsPieChart, type DeductionSlice } from '../components/charts/DeductionsPieChart';
import { commissionAllocations, commissionInRange, formatCurrencyExact } from '../lib/calculations';
import { formatShortDate, todayISO } from '../lib/dateUtils';
import { currentFYKey, fyDateRange, fyKeyForISODate, fyKeyOptions, fyLabel } from '../lib/financialYear';
import { claimableAmount, hasEnded, isValidWorkUsePercent, monthlyEquivalent, recurringFYTotals } from '../lib/recurring';
import { bracketsForFY, calculateIncomeTax, calculateMedicareLevy, hasBracketsForFY } from '../lib/taxBrackets';

const CUSTOM_CATEGORY = '__custom__';

type DeductionKind = 'one-off' | 'recurring';

interface DeductionFormState {
  kind: DeductionKind;
  /** Description for a one-off, name for a recurring expense. */
  description: string;
  amount: string;
  categoryChoice: string;
  customCategory: string;
  purchaseDate: string;
  vendor: string;
  paymentMethod: string;
  notes: string;
  workUsePercent: string;
  frequency: RecurringFrequency;
  startDate: string;
  endDate: string;
}

function emptyForm(kind: DeductionKind = 'one-off'): DeductionFormState {
  return {
    kind,
    description: '',
    amount: '',
    categoryChoice: DEDUCTION_CATEGORIES[0],
    customCategory: '',
    purchaseDate: todayISO(),
    vendor: '',
    paymentMethod: PAYMENT_METHODS[0],
    notes: '',
    workUsePercent: '100',
    frequency: 'Monthly',
    startDate: todayISO(),
    endDate: '',
  };
}

function categoryFields(category: string): Pick<DeductionFormState, 'categoryChoice' | 'customCategory'> {
  const isStandard = (DEDUCTION_CATEGORIES as readonly string[]).includes(category);
  return { categoryChoice: isStandard ? category : CUSTOM_CATEGORY, customCategory: isStandard ? '' : category };
}

/** e.g. "60%" */
function formatWorkUse(pct: number): string {
  return `${Number(pct.toFixed(2))}%`;
}

export function TaxPage() {
  const {
    entries,
    deductions,
    recurringDeductions,
    recurringUnavailable,
    addDeduction,
    updateDeduction,
    deleteDeduction,
    addRecurringDeduction,
    updateRecurringDeduction,
    deleteRecurringDeduction,
  } = useData();
  const [selectedFY, setSelectedFY] = useState(currentFYKey());
  const [form, setForm] = useState<DeductionFormState>(() => emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const today = todayISO();

  const fyOptions = useMemo(() => {
    const known = [
      ...entries.flatMap((e) => commissionAllocations(e).map((a) => fyKeyForISODate(a.date))),
      ...deductions.map((d) => d.financialYear),
      ...recurringDeductions.flatMap((r) => [r.startDate, r.endDate].filter((d): d is string => !!d).map(fyKeyForISODate)),
    ];
    return fyKeyOptions(known);
  }, [entries, deductions, recurringDeductions]);

  // Uses each entry's day breakdown, so a week crossing 30 June / 1 July is split between the two FYs.
  const grossIncome = useMemo(() => {
    const { startISO, endISO } = fyDateRange(selectedFY);
    return commissionInRange(entries, startISO, endISO);
  }, [entries, selectedFY]);

  const fyDeductions = useMemo(
    () => deductions.filter((d) => d.financialYear === selectedFY).sort((a, b) => claimableAmount(b) - claimableAmount(a)),
    [deductions, selectedFY],
  );
  const oneOffTotal = useMemo(() => fyDeductions.reduce((sum, d) => sum + claimableAmount(d), 0), [fyDeductions]);

  // A past FY counts every payment in it; the current FY only payments made up to today (a future FY: none yet).
  const fyIsPast = fyDateRange(selectedFY).endISO < today;

  const recurringRows = useMemo(
    () =>
      recurringDeductions
        .map((r) => ({ item: r, fy: recurringFYTotals(r, selectedFY, today) }))
        .sort((a, b) => b.fy.projected - a.fy.projected || a.item.name.localeCompare(b.item.name)),
    [recurringDeductions, selectedFY, today],
  );
  const recurringClaimedSoFar = recurringRows.reduce((sum, r) => sum + r.fy.claimedSoFar, 0);
  const recurringProjected = recurringRows.reduce((sum, r) => sum + r.fy.projected, 0);
  const recurringCounted = fyIsPast ? recurringProjected : recurringClaimedSoFar;

  const totalDeductions = oneOffTotal + recurringCounted;

  const pieData = useMemo<DeductionSlice[]>(() => {
    const map = new Map<string, number>();
    const add = (category: string, amount: number) => {
      if (amount > 0) map.set(category, (map.get(category) ?? 0) + amount);
    };
    for (const d of fyDeductions) add(d.category, claimableAmount(d));
    for (const r of recurringRows) add(r.item.category, fyIsPast ? r.fy.projected : r.fy.claimedSoFar);
    return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [fyDeductions, recurringRows, fyIsPast]);

  const brackets = useMemo(() => bracketsForFY(selectedFY), [selectedFY]);

  const taxBefore = calculateIncomeTax(grossIncome, brackets);
  const medicareBefore = calculateMedicareLevy(grossIncome);
  const totalBefore = taxBefore + medicareBefore;

  const taxableAfter = Math.max(0, grossIncome - totalDeductions);
  const taxAfter = calculateIncomeTax(taxableAfter, brackets);
  const medicareAfter = calculateMedicareLevy(taxableAfter);
  const totalAfter = taxAfter + medicareAfter;

  const savings = totalBefore - totalAfter;

  function resetForm(kind: DeductionKind = form.kind) {
    setForm(emptyForm(kind));
    setEditingId(null);
    setFormError(null);
  }

  function startEdit(d: Deduction) {
    setEditingId(d.id);
    setFormError(null);
    setForm({
      ...emptyForm('one-off'),
      description: d.description,
      amount: String(d.amount),
      ...categoryFields(d.category),
      purchaseDate: d.purchaseDate,
      vendor: d.vendor,
      paymentMethod: d.paymentMethod,
      notes: d.notes ?? '',
      workUsePercent: String(d.workUsePercent ?? 100),
    });
  }

  function startEditRecurring(r: RecurringDeduction) {
    setEditingId(r.id);
    setFormError(null);
    setForm({
      ...emptyForm('recurring'),
      description: r.name,
      amount: String(r.amount),
      ...categoryFields(r.category),
      notes: r.notes ?? '',
      workUsePercent: String(r.workUsePercent),
      frequency: r.frequency,
      startDate: r.startDate,
      endDate: r.endDate ?? '',
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount) || 0;
    const category = form.categoryChoice === CUSTOM_CATEGORY ? form.customCategory.trim() : form.categoryChoice;
    const description = form.description.trim();
    const isRecurring = form.kind === 'recurring';
    if (!description) return setFormError(isRecurring ? 'Enter a name.' : 'Enter a description.');
    if (!category) return setFormError('Enter a category.');
    if (amount <= 0) return setFormError('Enter an amount above $0.');

    // Before the migration has been run, the work-use column doesn't exist, so the field is hidden and not saved.
    const workUsePercent = recurringUnavailable ? undefined : form.workUsePercent.trim() === '' ? 100 : Number(form.workUsePercent);
    if (workUsePercent !== undefined && !isValidWorkUsePercent(workUsePercent)) {
      return setFormError('Work use must be between 0% and 100%.');
    }

    if (isRecurring) {
      if (!form.startDate) return setFormError('Choose a start date.');
      if (form.endDate && form.endDate < form.startDate) return setFormError('The end date can’t be before the start date.');
      const existing = editingId ? recurringDeductions.find((r) => r.id === editingId) : undefined;
      const payload: Omit<RecurringDeduction, 'id'> = {
        name: description,
        amount,
        frequency: form.frequency,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        category,
        workUsePercent: workUsePercent ?? 100,
        notes: form.notes.trim() || undefined,
        createdAt: existing?.createdAt ?? today,
      };
      if (editingId) updateRecurringDeduction(editingId, payload);
      else addRecurringDeduction(payload);
      resetForm();
      return;
    }

    const existing = editingId ? deductions.find((d) => d.id === editingId) : undefined;
    const payload: Omit<Deduction, 'id'> = {
      financialYear: existing?.financialYear ?? selectedFY,
      description,
      category,
      amount,
      purchaseDate: form.purchaseDate || today,
      vendor: form.vendor.trim(),
      paymentMethod: form.paymentMethod,
      notes: form.notes.trim() || undefined,
      createdAt: existing?.createdAt ?? today,
      workUsePercent: workUsePercent ?? existing?.workUsePercent,
    };
    if (editingId) {
      updateDeduction(editingId, payload);
    } else {
      addDeduction(payload);
    }
    resetForm();
  }

  /** Stops counting payments after today. */
  function endRecurring(r: RecurringDeduction) {
    const { id, ...rest } = r;
    updateRecurringDeduction(id, { ...rest, endDate: today });
  }

  function handleDeleteRecurring(id: string) {
    if (editingId === id) resetForm();
    deleteRecurringDeduction(id);
  }

  function toggleExpanded(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Tax Estimate</h2>
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
        <TaxSummaryCard title="Before Deductions" taxableIncome={grossIncome} incomeTax={taxBefore} medicare={medicareBefore} total={totalBefore} />
        <TaxSummaryCard title="After Deductions" taxableIncome={taxableAfter} incomeTax={taxAfter} medicare={medicareAfter} total={totalAfter} highlight />
        <div
          className="rounded-xl border p-4 flex flex-col items-center justify-center gap-1 text-center"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
        >
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Estimated Tax Saving
          </span>
          <span className="text-3xl font-semibold" style={{ color: 'var(--success)' }}>
            {formatCurrencyExact(savings)}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            from {formatCurrencyExact(totalDeductions)} in deductions
          </span>
          {!fyIsPast && recurringProjected > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Recurring expenses count payments up to today ({formatCurrencyExact(recurringClaimedSoFar)} of a projected{' '}
              {formatCurrencyExact(recurringProjected)} for the year).
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <h3 className="text-sm font-medium mb-3">Deductions — {fyLabel(selectedFY)}</h3>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatTile label="One-Off Deductions" value={formatCurrencyExact(oneOffTotal)} sublabel={`${fyDeductions.length} logged`} />
          <StatTile
            label="Recurring Claimed So Far"
            value={formatCurrencyExact(recurringClaimedSoFar)}
            sublabel={fyIsPast ? 'FY complete' : 'Payments up to today'}
          />
          <StatTile label="Recurring Projected" value={formatCurrencyExact(recurringProjected)} sublabel="Full financial year" />
          <StatTile
            label="Total Deducted"
            value={formatCurrencyExact(totalDeductions)}
            sublabel={fyIsPast ? 'Used in the estimate' : 'Used in the estimate (recurring claimed so far)'}
          />
        </div>

        {recurringUnavailable && (
          <div
            className="rounded-lg border px-3 py-2 mb-4 text-xs"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
          >
            <strong style={{ color: 'var(--text-primary)' }}>Recurring expenses and work-use % need a database update.</strong> Run{' '}
            <code>supabase/migrations/recurring_deductions.sql</code> in the Supabase SQL Editor, then reload this page.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-4">
          {!recurringUnavailable && (
            <div
              role="radiogroup"
              aria-label="Deduction type"
              className="inline-flex self-start rounded-lg border p-0.5 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            >
              {(
                [
                  ['one-off', 'One-Off Expense'],
                  ['recurring', 'Recurring Expense'],
                ] as const
              ).map(([kind, label]) => {
                const active = form.kind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={editingId !== null && !active}
                    onClick={() => !active && resetForm(kind)}
                    className="rounded-md px-3 py-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      background: active ? 'var(--surface-1)' : 'transparent',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      boxShadow: active ? '0 0 0 1px var(--border)' : 'none',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Field label={form.kind === 'recurring' ? 'Name' : 'Description'}>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={form.kind === 'recurring' ? 'e.g. Phone plan' : 'e.g. Fuel for client visits'}
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
              <Field label="Custom Category">
                <input
                  value={form.customCategory}
                  onChange={(e) => setForm((f) => ({ ...f, customCategory: e.target.value }))}
                  placeholder="Category name"
                  className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                  style={inputStyle}
                />
              </Field>
            )}
            <Field label={form.kind === 'recurring' ? 'Amount Per Payment ($)' : 'Amount ($)'}>
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
            {form.kind === 'recurring' ? (
              <>
                <Field label="Frequency">
                  <select
                    value={form.frequency}
                    onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as RecurringFrequency }))}
                    className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                    style={inputStyle}
                  >
                    {RECURRING_FREQUENCIES.map((fq) => (
                      <option key={fq} value={fq}>
                        {fq}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Start Date (First Payment)">
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                    style={inputStyle}
                  />
                </Field>
                <Field label="End Date (Optional)">
                  <input
                    type="date"
                    value={form.endDate}
                    min={form.startDate || undefined}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                    style={inputStyle}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Date of Purchase">
                  <input
                    type="date"
                    value={form.purchaseDate}
                    onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))}
                    className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Vendor">
                  <input
                    value={form.vendor}
                    onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                    placeholder="e.g. Officeworks"
                    className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Payment Method">
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                    className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                    style={inputStyle}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            {!recurringUnavailable && (
              <Field label="Work Use (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="1"
                  value={form.workUsePercent}
                  onChange={(e) => setForm((f) => ({ ...f, workUsePercent: e.target.value }))}
                  className="w-full rounded-md border px-2 py-1.5 text-sm outline-none tabular-nums"
                  style={inputStyle}
                />
              </Field>
            )}
            <Field label="Notes">
              <input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Additional details (optional)"
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                style={inputStyle}
              />
            </Field>
          </div>
          {formError && (
            <p className="text-xs" style={{ color: 'var(--critical)' }}>
              {formError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg px-4 py-2 text-sm font-medium cursor-pointer text-white"
              style={{ background: 'var(--series-1)' }}
            >
              {editingId ? 'Save Changes' : form.kind === 'recurring' ? 'Add Recurring Expense' : 'Add Deduction'}
            </button>
            {editingId && (
              <button type="button" onClick={() => resetForm()} className="text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
          One-Off Expenses
        </h4>
        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm border-collapse min-w-[720px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Date', 'Vendor', 'Description', 'Category', 'Claimable', ''].map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fyDeductions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                    No deductions logged for {fyLabel(selectedFY)} yet.
                  </td>
                </tr>
              )}
              {fyDeductions.map((d) => (
                <Fragment key={d.id}>
                  <tr style={{ borderBottom: expandedId === d.id ? 'none' : '1px solid var(--border)' }}>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {formatShortDate(d.purchaseDate)}
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                      {d.vendor || '—'}
                    </td>
                    <td className="px-3 py-2">{d.description}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                      {d.category}
                    </td>
                    <td className="px-3 py-2 tabular-nums font-medium whitespace-nowrap">
                      {formatCurrencyExact(claimableAmount(d))}
                      {d.workUsePercent !== undefined && d.workUsePercent < 100 && (
                        <span className="block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                          {formatWorkUse(d.workUsePercent)} of {formatCurrencyExact(d.amount)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        onClick={() => toggleExpanded(d.id)}
                        className="text-xs mr-2 underline cursor-pointer"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {expandedId === d.id ? 'Hide' : 'Details'}
                      </button>
                      <button onClick={() => startEdit(d)} className="text-xs mr-2 underline cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                        Edit
                      </button>
                      <button onClick={() => deleteDeduction(d.id)} className="text-xs underline cursor-pointer" style={{ color: 'var(--critical)' }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                  {expandedId === d.id && (
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={6} className="px-3 pb-3 pt-0" style={{ background: 'var(--surface-2)' }}>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 pt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span>
                            <strong style={{ color: 'var(--text-primary)' }}>Payment Method:</strong> {d.paymentMethod}
                          </span>
                          <span>
                            <strong style={{ color: 'var(--text-primary)' }}>Work Use:</strong> {formatWorkUse(d.workUsePercent ?? 100)} of{' '}
                            {formatCurrencyExact(d.amount)}
                          </span>
                          <span>
                            <strong style={{ color: 'var(--text-primary)' }}>Notes:</strong> {d.notes || '—'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {!recurringUnavailable && (
          <>
            <h4 className="text-xs font-medium mt-5 mb-2" style={{ color: 'var(--text-muted)' }}>
              Recurring Expenses
            </h4>
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-sm border-collapse min-w-[860px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Name', 'Schedule', 'Monthly Equivalent', 'Work Use', 'Claimed So Far', 'Projected FY', ''].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recurringRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                        No recurring expenses yet. Choose Recurring Expense above to add a phone plan, internet, software or a car lease.
                      </td>
                    </tr>
                  )}
                  {recurringRows.map(({ item: r, fy }) => {
                    const ended = hasEnded(r, today);
                    const notStarted = r.startDate > today;
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', opacity: fy.paymentsInFY === 0 ? 0.6 : 1 }}>
                        <td className="px-3 py-2">
                          {r.name}
                          <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                            {r.category}
                            {r.notes ? ` · ${r.notes}` : ''}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                          {formatCurrencyExact(r.amount)} {r.frequency.toLowerCase()}
                          <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                            {notStarted ? 'Starts' : 'From'} {formatShortDate(r.startDate)}
                            {r.endDate ? ` · ${ended ? 'Ended' : 'Ends'} ${formatShortDate(r.endDate)}` : ' · Ongoing'}
                          </span>
                        </td>
                        <td className="px-3 py-2 tabular-nums">{formatCurrencyExact(monthlyEquivalent(r.amount, r.frequency))}</td>
                        <td className="px-3 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {formatWorkUse(r.workUsePercent)}
                        </td>
                        <td className="px-3 py-2 tabular-nums font-medium">
                          {formatCurrencyExact(fy.claimedSoFar)}
                          <span className="block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                            {fy.paymentsSoFar} {fy.paymentsSoFar === 1 ? 'payment' : 'payments'}
                          </span>
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {formatCurrencyExact(fy.projected)}
                          <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                            {fy.paymentsInFY} in {fyLabel(selectedFY)}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <button
                            onClick={() => startEditRecurring(r)}
                            className="text-xs mr-2 underline cursor-pointer"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            Edit
                          </button>
                          {!ended && !notStarted && (
                            <button
                              onClick={() => endRecurring(r)}
                              title="Sets the end date to today, so later payments aren't counted"
                              className="text-xs mr-2 underline cursor-pointer"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              Pause / End
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteRecurring(r.id)}
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
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              Each payment is counted on its due date, from the start date and every week, fortnight, month, quarter or year after it,
              up to the end date. Only payments inside {fyLabel(selectedFY)} (1 July – 30 June) are included, and only the work-use share is
              claimed.
            </p>
          </>
        )}
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <h3 className="text-sm font-medium mb-3">Deductions By Category</h3>
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
      <TaxRow label="Taxable Income" value={formatCurrencyExact(taxableIncome)} />
      <TaxRow label="Income Tax" value={formatCurrencyExact(incomeTax)} />
      <TaxRow label="Medicare Levy (2%)" value={formatCurrencyExact(medicare)} />
      <div className="pt-2 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
        <TaxRow label="Total Estimated Tax" value={formatCurrencyExact(total)} bold />
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
