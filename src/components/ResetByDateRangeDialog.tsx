import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useData } from '../context/DataContext';
import { formatCurrencyExact, toCents } from '../lib/calculations';
import { dayBeforeISO, formatDayLabel, formatShortDate, formatWeekLabel } from '../lib/dateUtils';
import { EARLIEST_ISO, buildResetPreview, type PreviewEntry, type ResetRange, type ResetTypes } from '../lib/reset';
import { RoleBadge } from './RoleBadge';

type Mode = 'range' | 'before';

const CONFIRM_WORD = 'DELETE';

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** Previews and bulk-deletes entries in a date range. Deleted items go to Recently Deleted. */
export function ResetByDateRangeDialog({ onClose, onDeleted }: { onClose: () => void; onDeleted: (count: number) => void }) {
  const { roles, entries, deductions, superContributions, deals, deleteToRecentlyDeleted } = useData();
  const [mode, setMode] = useState<Mode>('range');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [before, setBefore] = useState('');
  const [types, setTypes] = useState<ResetTypes>({ commissions: true, deductions: false, superContributions: false });
  /** Ticks the user changed by hand; everything else follows the default for its row. */
  const [ticks, setTicks] = useState<Map<string, boolean>>(new Map());
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const rangeBackwards = mode === 'range' && from !== '' && to !== '' && from > to;

  const range = useMemo<ResetRange | null>(() => {
    if (mode === 'before') return before ? { fromISO: EARLIEST_ISO, toISO: dayBeforeISO(before) } : null;
    return from && to && from <= to ? { fromISO: from, toISO: to } : null;
  }, [mode, from, to, before]);

  const preview = useMemo(
    () => (range ? buildResetPreview({ entries, deductions, superContributions, deals }, range, types) : null),
    [range, types, entries, deductions, superContributions, deals],
  );

  const partialEntries = preview?.entries.filter((p) => p.partial) ?? [];
  const fullEntries = preview?.entries.filter((p) => !p.partial) ?? [];

  /** Any change to what's being deleted needs a fresh confirmation; a new search also clears ticks. */
  function changeSearch(apply: () => void) {
    apply();
    setTicks(new Map());
    setConfirmText('');
  }

  // A partly-overlapping entry may belong to the correct period, so it's only deleted if ticked.
  const isTicked = (id: string, partial = false) => ticks.get(id) ?? !partial;

  function setTicked(id: string, checked: boolean) {
    setTicks((cur) => new Map(cur).set(id, checked));
    setConfirmText('');
  }

  const tickedRows = [
    ...(preview?.entries ?? []).map((p) => ({ id: p.entry.id, amount: p.entry.commission, ticked: isTicked(p.entry.id, p.partial) })),
    ...(preview?.deductions ?? []).map((d) => ({ id: d.id, amount: d.amount, ticked: isTicked(d.id) })),
    ...(preview?.superContributions ?? []).map((s) => ({ id: s.id, amount: s.amount, ticked: isTicked(s.id) })),
  ].filter((r) => r.ticked);
  const selected = { ids: new Set(tickedRows.map((r) => r.id)), cents: tickedRows.reduce((sum, r) => sum + toCents(r.amount), 0) };

  const canDelete = selected.ids.size > 0 && confirmText === CONFIRM_WORD;

  function runDelete() {
    if (!canDelete) return;
    deleteToRecentlyDeleted(selected.ids);
    onDeleted(selected.ids.size);
  }

  const emptyPreview = preview && preview.entries.length + preview.deductions.length + preview.superContributions.length === 0;

  function entryRow(p: PreviewEntry) {
    const role = roleById.get(p.entry.roleId);
    return (
      <PreviewRow
        key={p.entry.id}
        checked={isTicked(p.entry.id, p.partial)}
        onChange={(checked) => setTicked(p.entry.id, checked)}
        label={`Week Of ${formatWeekLabel(p.entry.weekStart)}`}
        amount={p.entry.commission}
        badge={role ? <RoleBadge name={role.name} colorSlot={role.colorSlot} /> : undefined}
      >
        <span>
          Booked {p.entry.booked} · Showed {p.entry.showed} · Closed {p.entry.closed}
          {p.entry.notes ? ` · ${p.entry.notes}` : ''}
        </span>
        {p.days.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-0.5">
            {p.days.map((d) => (
              <li key={d.date} className="flex items-center justify-between gap-3 tabular-nums">
                <span>
                  {formatDayLabel(d.date)}{' '}
                  <span style={{ color: d.inRange ? 'var(--text-muted)' : 'var(--success)' }}>
                    {d.inRange ? '(In Range)' : '(Outside Range)'}
                  </span>
                </span>
                <span>{formatCurrencyExact(d.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          p.partial && <span className="block">No Day Breakdown, so the app can't tell which days this covers.</span>
        )}
        {p.deal && (
          <span className="block mt-0.5">
            From Deal: {p.deal.clientName}. The deal itself stays on the Deals page and won't recreate this entry.
          </span>
        )}
      </PreviewRow>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.45)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-range-title"
    >
      <div
        className="w-full max-w-2xl max-h-full overflow-y-auto rounded-xl border p-5 flex flex-col gap-4 shadow-lg"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
      >
        <div>
          <h3 id="reset-range-title" className="text-base font-semibold">
            Reset By Date Range
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Nothing is deleted until you confirm below. Deleted items stay in Recently Deleted for 30 days.
          </p>
        </div>

        <div className="flex gap-1 flex-wrap">
          {(
            [
              ['range', 'Date Range'],
              ['before', 'Everything Before A Date'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={mode === key}
              onClick={() => changeSearch(() => setMode(key))}
              className="rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer"
              style={{
                border: '1px solid var(--border)',
                color: mode === key ? '#fff' : 'var(--text-primary)',
                background: mode === key ? 'var(--series-1)' : 'transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'range' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DateField label="From" value={from} onChange={(v) => changeSearch(() => setFrom(v))} />
            <DateField label="To" value={to} onChange={(v) => changeSearch(() => setTo(v))} />
            {rangeBackwards && (
              <span className="text-xs sm:col-span-2" style={{ color: 'var(--critical)' }}>
                From Must Be On Or Before To.
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <DateField label="Before" value={before} onChange={(v) => changeSearch(() => setBefore(v))} />
            {before && (
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Selects up to and including {formatShortDate(dayBeforeISO(before))}. {formatShortDate(before)} onwards isn't included.
              </span>
            )}
          </div>
        )}

        <fieldset className="flex items-center gap-x-4 gap-y-1 flex-wrap text-sm">
          <legend className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            Include
          </legend>
          {(
            [
              ['commissions', 'Commissions'],
              ['deductions', 'Deductions'],
              ['superContributions', 'Super Contributions'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={types[key]}
                onChange={(e) => {
                  const checked = e.target.checked;
                  changeSearch(() => setTypes((t) => ({ ...t, [key]: checked })));
                }}
              />
              {label}
            </label>
          ))}
        </fieldset>

        {emptyPreview && (
          <p className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>
            Nothing To Delete In This Range.
          </p>
        )}

        {partialEntries.length > 0 && (
          <div
            className="rounded-lg p-3 flex flex-col gap-2"
            style={{
              background: 'color-mix(in srgb, var(--warning) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--warning) 60%, transparent)',
            }}
          >
            <div>
              <h4 className="text-sm font-semibold">Partly Overlapping Weeks ({partialEntries.length})</h4>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                These weeks fall only partly inside your range, so they start unticked. Ticking one deletes the whole
                entry, including any days outside the range.
              </p>
            </div>
            {partialEntries.map(entryRow)}
          </div>
        )}

        {fullEntries.length > 0 && <Section title={`Commissions (${fullEntries.length})`}>{fullEntries.map(entryRow)}</Section>}

        {preview && preview.deductions.length > 0 && (
          <Section title={`Deductions (${preview.deductions.length})`}>
            {preview.deductions.map((d) => (
              <PreviewRow
                key={d.id}
                checked={isTicked(d.id)}
                onChange={(checked) => setTicked(d.id, checked)}
                label={formatShortDate(d.purchaseDate)}
                amount={d.amount}
              >
                {d.description} · {d.category}
              </PreviewRow>
            ))}
          </Section>
        )}

        {preview && preview.superContributions.length > 0 && (
          <Section title={`Super Contributions (${preview.superContributions.length})`}>
            {preview.superContributions.map((s) => (
              <PreviewRow
                key={s.id}
                checked={isTicked(s.id)}
                onChange={(checked) => setTicked(s.id, checked)}
                label={formatShortDate(s.date)}
                amount={s.amount}
              >
                {s.notes}
              </PreviewRow>
            ))}
          </Section>
        )}

        {preview && !emptyPreview && (
          <div className="flex flex-col gap-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between text-sm font-semibold tabular-nums">
              <span>Will Delete: {plural(selected.ids.size, 'Item')}</span>
              <span>{formatCurrencyExact(selected.cents / 100)}</span>
            </div>
            <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Type {CONFIRM_WORD} To Confirm
              <input
                type="text"
                value={confirmText}
                autoComplete="off"
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full sm:w-48 rounded-md border px-2 py-1.5 text-sm outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-3)', color: 'var(--text-primary)' }}
              />
            </label>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={runDelete}
            disabled={!canDelete}
            className="rounded-lg px-4 py-2 text-sm font-medium cursor-pointer text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--critical)' }}
          >
            Delete {plural(selected.ids.size, 'Item')}
          </button>
          <button type="button" onClick={onClose} className="text-sm cursor-pointer px-2" style={{ color: 'var(--text-muted)' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-3)', color: 'var(--text-primary)' }}
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      {children}
    </div>
  );
}

function PreviewRow({
  checked,
  onChange,
  label,
  amount,
  badge,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  amount: number;
  badge?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border p-2.5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={`Select ${label}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
          <span className="flex items-center gap-2 flex-wrap">
            {label}
            {badge}
          </span>
          <span className="tabular-nums font-medium">{formatCurrencyExact(amount)}</span>
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
