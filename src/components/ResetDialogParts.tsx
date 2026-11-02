import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { formatCurrencyExact } from '../lib/calculations';
import { dayBeforeISO, formatShortDate } from '../lib/dateUtils';
import { EARLIEST_ISO, type ResetRange } from '../lib/reset';

type Mode = 'range' | 'before';

/** The Date Range / Everything Before A Date picker shared by the reset dialogs. */
export function useResetRange(onChange: () => void) {
  const [mode, setMode] = useState<Mode>('range');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [before, setBefore] = useState('');
  const rangeBackwards = mode === 'range' && from !== '' && to !== '' && from > to;

  const range = useMemo<ResetRange | null>(() => {
    if (mode === 'before') return before ? { fromISO: EARLIEST_ISO, toISO: dayBeforeISO(before) } : null;
    return from && to && from <= to ? { fromISO: from, toISO: to } : null;
  }, [mode, from, to, before]);

  function change(apply: () => void) {
    apply();
    onChange();
  }

  const fields = (
    <>
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
            onClick={() => change(() => setMode(key))}
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
          <DateField label="From" value={from} onChange={(v) => change(() => setFrom(v))} />
          <DateField label="To" value={to} onChange={(v) => change(() => setTo(v))} />
          {rangeBackwards && (
            <span className="text-xs sm:col-span-2" style={{ color: 'var(--critical)' }}>
              From Must Be On Or Before To.
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <DateField label="Before" value={before} onChange={(v) => change(() => setBefore(v))} />
          {before && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Selects up to and including {formatShortDate(dayBeforeISO(before))}. {formatShortDate(before)} onwards isn't included.
            </span>
          )}
        </div>
      )}
    </>
  );

  return { range, fields };
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

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      {children}
    </div>
  );
}

export function PreviewRow({
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
  amount?: number;
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
          {amount !== undefined && <span className="tabular-nums font-medium">{formatCurrencyExact(amount)}</span>}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
