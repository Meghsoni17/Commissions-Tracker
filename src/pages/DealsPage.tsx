import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { v4 as uuid } from 'uuid';
import { useData } from '../context/DataContext';
import type { Deal, InstallmentFrequency, PaymentInstallment, PaymentStructure } from '../types';
import { INSTALLMENT_FREQUENCIES, PAYMENT_STRUCTURES } from '../types';
import { RoleBadge } from '../components/RoleBadge';
import { ProgressBar } from '../components/ProgressBar';
import { UpcomingPayments } from '../components/UpcomingPayments';
import { formatCurrencyExact } from '../lib/calculations';
import { formatShortDate, todayISO, weekStartISO } from '../lib/dateUtils';
import { collectedTotal, generateInstallments, outstandingBalance, scheduledTotal } from '../lib/deals';
import { addDays, format, parseISO } from 'date-fns';

interface DealFormState {
  roleId: string;
  clientName: string;
  saleDate: string;
  totalContractValue: string;
  cashCollectedOnCall: string;
  paymentStructure: PaymentStructure;
  installmentCount: string;
  installmentFrequency: InstallmentFrequency;
  firstPaymentDate: string;
  installments: PaymentInstallment[];
  notes: string;
}

function emptyForm(defaultRoleId: string): DealFormState {
  return {
    roleId: defaultRoleId,
    clientName: '',
    saleDate: todayISO(),
    totalContractValue: '',
    cashCollectedOnCall: '',
    paymentStructure: 'Paid in Full',
    installmentCount: '3',
    installmentFrequency: 'Monthly',
    firstPaymentDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    installments: [],
    notes: '',
  };
}

export function DealsPage() {
  const { roles, deals, addDeal, updateDeal, deleteDeal, setInstallmentPaid } = useData();
  const activeRoles = roles.filter((r) => !r.archived);
  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const [form, setForm] = useState<DealFormState>(() => emptyForm(activeRoles[0]?.id ?? ''));
  const [editingId, setEditingId] = useState<string | null>(null);

  const totalContractValue = Number(form.totalContractValue) || 0;
  const cashCollectedOnCall = Number(form.cashCollectedOnCall) || 0;
  const remaining = Math.max(0, totalContractValue - cashCollectedOnCall);
  const overCollected = cashCollectedOnCall > totalContractValue && totalContractValue > 0;
  const scheduleTotal = scheduledTotal(form.installments);
  const scheduleMismatch =
    form.paymentStructure !== 'Paid in Full' && form.installments.length > 0 && Math.abs(scheduleTotal - remaining) > 0.01;

  function resetForm() {
    setForm(emptyForm(activeRoles[0]?.id ?? ''));
    setEditingId(null);
  }

  function startEdit(deal: Deal) {
    setEditingId(deal.id);
    setForm({
      roleId: deal.roleId,
      clientName: deal.clientName,
      saleDate: deal.saleDate,
      totalContractValue: String(deal.totalContractValue),
      cashCollectedOnCall: String(deal.cashCollectedOnCall),
      paymentStructure: deal.paymentStructure,
      installmentCount: String(Math.max(1, deal.installments.length || 3)),
      installmentFrequency: 'Monthly',
      firstPaymentDate: deal.installments[0]?.dueDate ?? format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      installments: deal.installments,
      notes: deal.notes ?? '',
    });
  }

  function handlePaymentStructureChange(next: PaymentStructure) {
    setForm((f) => {
      if (next === 'Paid in Full') return { ...f, paymentStructure: next, installments: [] };
      if (next === 'Custom Schedule' && f.installments.length === 0) {
        return { ...f, paymentStructure: next, installments: [{ id: uuid(), dueDate: todayISO(), amount: remaining, paid: false }] };
      }
      return { ...f, paymentStructure: next };
    });
  }

  function regenerateSchedule() {
    const count = Math.max(1, Number(form.installmentCount) || 1);
    setForm((f) => ({ ...f, installments: generateInstallments(f.firstPaymentDate, count, f.installmentFrequency, remaining) }));
  }

  function addCustomRow() {
    setForm((f) => ({ ...f, installments: [...f.installments, { id: uuid(), dueDate: todayISO(), amount: 0, paid: false }] }));
  }

  function updateCustomRow(id: string, patch: Partial<PaymentInstallment>) {
    setForm((f) => ({ ...f, installments: f.installments.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  }

  function removeCustomRow(id: string) {
    setForm((f) => ({ ...f, installments: f.installments.filter((i) => i.id !== id) }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.roleId || !form.clientName.trim() || totalContractValue <= 0) return;
    const payload: Omit<Deal, 'id'> = {
      roleId: form.roleId,
      clientName: form.clientName.trim(),
      saleDate: form.saleDate,
      totalContractValue,
      cashCollectedOnCall,
      paymentStructure: form.paymentStructure,
      installments: form.paymentStructure === 'Paid in Full' ? [] : form.installments,
      notes: form.notes.trim() || undefined,
      createdAt: editingId ? (deals.find((d) => d.id === editingId)?.createdAt ?? todayISO()) : todayISO(),
    };
    if (editingId) {
      updateDeal(editingId, payload);
    } else {
      addDeal(payload);
    }
    resetForm();
  }

  const sortedDeals = useMemo(() => [...deals].sort((a, b) => b.saleDate.localeCompare(a.saleDate)), [deals]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Deals</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Log contract value, cash collected on the call, and a payment structure for the remaining balance. Each
          deal automatically adds a closed-call entry for the cash collected on the call, so it counts toward your
          weekly and dashboard commission totals. Follow-up payments are tracked here but don't add further
          commission entries.
        </p>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <h3 className="text-sm font-medium mb-3">Upcoming & Overdue Payments</h3>
        <UpcomingPayments deals={deals} roles={roles} />
      </div>

      {activeRoles.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Add a role first (see the Roles tab), then log deals here.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border p-4 flex flex-col gap-4"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
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
            <Field label="Client / Deal Name">
              <input
                value={form.clientName}
                onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                placeholder="e.g. Acme Corp"
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                style={inputStyle}
              />
            </Field>
            <Field label="Sale Date">
              <input
                type="date"
                value={form.saleDate}
                onChange={(e) => setForm((f) => ({ ...f, saleDate: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                style={inputStyle}
              />
            </Field>
            <Field label="Total Contract Value ($)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.totalContractValue}
                onChange={(e) => setForm((f) => ({ ...f, totalContractValue: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none tabular-nums"
                style={inputStyle}
              />
            </Field>
            <Field label="Cash Collected On Call ($)" error={overCollected ? "Can't exceed total value" : undefined}>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.cashCollectedOnCall}
                onChange={(e) => setForm((f) => ({ ...f, cashCollectedOnCall: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none tabular-nums"
                style={overCollected ? { ...inputStyle, borderColor: 'var(--critical)' } : inputStyle}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>
              Remaining balance to schedule: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrencyExact(remaining)}</strong>
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <Field label="Payment Structure">
              <div className="inline-flex rounded-lg border p-0.5 text-xs w-fit" style={{ borderColor: 'var(--border)' }}>
                {PAYMENT_STRUCTURES.map((ps) => (
                  <button
                    key={ps}
                    type="button"
                    onClick={() => handlePaymentStructureChange(ps)}
                    className="px-2.5 py-1.5 rounded-md cursor-pointer"
                    style={{
                      background: form.paymentStructure === ps ? 'var(--surface-3)' : 'transparent',
                      color: form.paymentStructure === ps ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: form.paymentStructure === ps ? 600 : 400,
                    }}
                  >
                    {ps}
                  </button>
                ))}
              </div>
            </Field>

            {form.paymentStructure === 'Installments' && (
              <div className="rounded-lg border p-3 flex flex-col gap-3" style={{ borderColor: 'var(--border)' }}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <Field label="Number Of Installments">
                    <input
                      type="number"
                      min={1}
                      value={form.installmentCount}
                      onChange={(e) => setForm((f) => ({ ...f, installmentCount: e.target.value }))}
                      className="w-full rounded-md border px-2 py-1.5 text-sm outline-none tabular-nums"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Frequency">
                    <select
                      value={form.installmentFrequency}
                      onChange={(e) => setForm((f) => ({ ...f, installmentFrequency: e.target.value as InstallmentFrequency }))}
                      className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                      style={inputStyle}
                    >
                      {INSTALLMENT_FREQUENCIES.map((freq) => (
                        <option key={freq} value={freq}>
                          {freq}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="First Payment Date">
                    <input
                      type="date"
                      value={form.firstPaymentDate}
                      onChange={(e) => setForm((f) => ({ ...f, firstPaymentDate: e.target.value }))}
                      className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                      style={inputStyle}
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={regenerateSchedule}
                    className="rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer h-fit"
                    style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  >
                    {form.installments.length > 0 ? 'Regenerate Schedule' : 'Generate Schedule'}
                  </button>
                </div>
                <InstallmentPreview installments={form.installments} />
              </div>
            )}

            {form.paymentStructure === 'Custom Schedule' && (
              <div className="rounded-lg border p-3 flex flex-col gap-2" style={{ borderColor: 'var(--border)' }}>
                {form.installments.map((row) => (
                  <div key={row.id} className="flex items-center gap-2 flex-wrap">
                    <input
                      type="date"
                      value={row.dueDate}
                      onChange={(e) => updateCustomRow(row.id, { dueDate: e.target.value })}
                      className="rounded-md border px-2 py-1.5 text-sm outline-none"
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.amount}
                      onChange={(e) => updateCustomRow(row.id, { amount: Number(e.target.value) || 0 })}
                      className="w-28 rounded-md border px-2 py-1.5 text-sm outline-none tabular-nums"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomRow(row.id)}
                      className="text-xs underline cursor-pointer"
                      style={{ color: 'var(--critical)' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addCustomRow}
                  className="text-xs underline cursor-pointer w-fit"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  + Add Payment
                </button>
              </div>
            )}

            {scheduleMismatch && (
              <p className="text-xs" style={{ color: 'var(--critical)' }}>
                Scheduled payments ({formatCurrencyExact(scheduleTotal)}) don't add up to the remaining balance (
                {formatCurrencyExact(remaining)}).
              </p>
            )}
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
              disabled={overCollected}
              className="rounded-lg px-4 py-2 text-sm font-medium cursor-pointer text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--series-1)' }}
            >
              {editingId ? 'Save Changes' : 'Add Deal'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <div className="flex flex-col gap-4">
        {sortedDeals.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No deals logged yet.
          </p>
        )}
        {sortedDeals.map((deal) => {
          const role = roleById.get(deal.roleId);
          const collected = collectedTotal(deal);
          const pct = deal.totalContractValue > 0 ? collected / deal.totalContractValue : 0;
          return (
            <div key={deal.id} className="rounded-xl border p-4 flex flex-col gap-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{deal.clientName}</span>
                  {role && <RoleBadge name={role.name} colorSlot={role.colorSlot} />}
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatShortDate(deal.saleDate)}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => startEdit(deal)} className="text-xs underline cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                    Edit
                  </button>
                  <button onClick={() => deleteDeal(deal.id)} className="text-xs underline cursor-pointer" style={{ color: 'var(--critical)' }}>
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <MiniStat label="Total Contract Value" value={formatCurrencyExact(deal.totalContractValue)} />
                <MiniStat label="Collected On Call" value={formatCurrencyExact(deal.cashCollectedOnCall)} />
                <MiniStat label="Collected To Date" value={formatCurrencyExact(collected)} />
                <MiniStat label="Remaining Balance" value={formatCurrencyExact(outstandingBalance(deal))} />
              </div>

              <ProgressBar value={pct} color={pct >= 1 ? 'var(--success)' : 'var(--series-1)'} />

              {deal.paymentStructure !== 'Paid in Full' && (
                <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                  <table className="w-full text-sm border-collapse min-w-[420px]">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Due Date', 'Amount', 'Status', ''].map((h) => (
                          <th key={h} className="text-left px-3 py-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {deal.installments
                        .slice()
                        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                        .map((installment) => {
                          const overdue = !installment.paid && installment.dueDate < todayISO();
                          return (
                            <tr key={installment.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: overdue ? 'var(--critical)' : 'var(--text-secondary)' }}>
                                {formatShortDate(installment.dueDate)}
                              </td>
                              <td className="px-3 py-1.5 tabular-nums font-medium">{formatCurrencyExact(installment.amount)}</td>
                              <td className="px-3 py-1.5">
                                {installment.paid ? (
                                  <span style={{ color: 'var(--success)' }}>Paid{installment.paidDate ? ` (${formatShortDate(installment.paidDate)})` : ''}</span>
                                ) : overdue ? (
                                  <span style={{ color: 'var(--critical)' }}>Overdue</span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>Upcoming</span>
                                )}
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => setInstallmentPaid(deal.id, installment.id, !installment.paid)}
                                  className="text-xs underline cursor-pointer"
                                  style={{ color: 'var(--text-secondary)' }}
                                >
                                  {installment.paid ? 'Mark Unpaid' : 'Mark Paid'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Counted in Entries as 1 closed call · {formatCurrencyExact(deal.cashCollectedOnCall)} commission for
                the week of {formatShortDate(weekStartISO(parseISO(deal.saleDate)))}.
              </p>

              {deal.notes && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {deal.notes}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InstallmentPreview({ installments }: { installments: PaymentInstallment[] }) {
  if (installments.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        No schedule generated yet.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {installments.map((i) => (
        <span
          key={i.id}
          className="text-xs rounded-md px-2 py-1 tabular-nums"
          style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          {formatShortDate(i.dueDate)} · {formatCurrencyExact(i.amount)}
        </span>
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span className="font-medium tabular-nums truncate">{value}</span>
    </div>
  );
}

const inputStyle: CSSProperties = {
  borderColor: 'var(--border)',
  background: 'var(--surface-3)',
  color: 'var(--text-primary)',
};

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
      {label}
      {children}
      {error && <span style={{ color: 'var(--critical)' }}>{error}</span>}
    </label>
  );
}
