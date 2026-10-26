import { useEffect, useMemo, useState } from 'react';
import type { DayAmount } from '../types';
import { formatCurrencyExact, toCents } from '../lib/calculations';
import { formatDayLabel, formatWeekLabel, weekDays, weekMonthSegments } from '../lib/dateUtils';

interface DayBreakdownDialogProps {
  weekStart: string;
  total: number;
  initial?: DayAmount[];
  /** Required when the week straddles two months: there's no Skip, only Back/Cancel. */
  required: boolean;
  /** Label for the button that closes without confirming, e.g. "Skip", "Back" or "Cancel". */
  dismissLabel: string;
  onConfirm: (breakdown: DayAmount[]) => void;
  onDismiss: () => void;
  /** Shown only when an existing breakdown can be removed (single-month weeks). */
  onRemove?: () => void;
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Lets you say which days of the week a weekly commission total was earned on. */
export function DayBreakdownDialog({
  weekStart,
  total,
  initial,
  required,
  dismissLabel,
  onConfirm,
  onDismiss,
  onRemove,
}: DayBreakdownDialogProps) {
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const segments = useMemo(() => weekMonthSegments(weekStart), [weekStart]);
  const totalCents = toCents(total);

  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const d of initial ?? []) init[d.date] = centsToInput(toCents(d.amount));
    return init;
  });
  const [ticked, setTicked] = useState<Set<string>>(() => new Set((initial ?? []).map((d) => d.date)));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const parsed = days.map((date) => {
    const raw = amounts[date]?.trim() ?? '';
    const value = raw === '' ? 0 : Number(raw);
    const valid = raw === '' || (Number.isFinite(value) && value >= 0);
    return { date, cents: valid ? toCents(value) : 0, valid };
  });
  const allocatedCents = parsed.reduce((sum, d) => sum + d.cents, 0);
  const remainingCents = totalCents - allocatedCents;
  const allValid = parsed.every((d) => d.valid);
  const canConfirm = allValid && remainingCents === 0 && allocatedCents > 0;

  function splitEvenly() {
    const selected = days.filter((d) => ticked.has(d));
    if (selected.length === 0) return;
    const base = Math.floor(totalCents / selected.length);
    const extra = totalCents - base * selected.length; // leftover cents go to the first ticked days
    const next: Record<string, string> = {};
    selected.forEach((d, i) => {
      next[d] = centsToInput(base + (i < extra ? 1 : 0));
    });
    setAmounts(next);
  }

  function toggle(date: string) {
    setTicked((cur) => {
      const next = new Set(cur);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function confirm() {
    if (!canConfirm) return;
    onConfirm(parsed.filter((d) => d.cents > 0).map((d) => ({ date: d.date, amount: d.cents / 100 })));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.45)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="day-breakdown-title"
    >
      <div
        className="w-full max-w-md max-h-full overflow-y-auto rounded-xl border p-5 flex flex-col gap-4 shadow-lg"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
      >
        <div>
          <h3 id="day-breakdown-title" className="text-base font-semibold">
            Day Breakdown — Week Of {formatWeekLabel(weekStart)}
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {required
              ? `This week crosses into a new month, so split the ${formatCurrencyExact(total)} across the days you earned it. Each day counts in its own month.`
              : `Which days did you earn this ${formatCurrencyExact(total)}? Optional: this week is all in one month, so your monthly figures are the same either way.`}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={splitEvenly}
            disabled={ticked.size === 0}
            className="rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            Split Evenly Across Selected Days
          </button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Tick days, then split
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {parsed.map((d) => {
            const isNewMonth = segments.length > 1 && segments.slice(1).some((s) => s.startISO === d.date);
            return (
              <div key={d.date}>
                {isNewMonth && <div className="my-1.5" style={{ borderTop: '1px dashed var(--baseline)' }} />}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={ticked.has(d.date)}
                    onChange={() => toggle(d.date)}
                    aria-label={`Select ${formatDayLabel(d.date)}`}
                  />
                  <span className="w-24 text-sm shrink-0">{formatDayLabel(d.date)}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={amounts[d.date] ?? ''}
                    onChange={(e) => setAmounts((cur) => ({ ...cur, [d.date]: e.target.value }))}
                    aria-label={`Amount For ${formatDayLabel(d.date)}`}
                    className="flex-1 min-w-0 rounded-md border px-2 py-1.5 text-sm outline-none tabular-nums text-right"
                    style={{
                      borderColor: d.valid ? 'var(--border)' : 'var(--critical)',
                      background: 'var(--surface-3)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-1 pt-3 text-sm tabular-nums" style={{ borderTop: '1px solid var(--border)' }}>
          {segments.length > 1 && (
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {segments
                .map((s) => {
                  const cents = parsed.filter((d) => d.date >= s.startISO && d.date <= s.endISO).reduce((sum, d) => sum + d.cents, 0);
                  return `${s.label}: ${formatCurrencyExact(cents / 100)}`;
                })
                .join(' | ')}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>Weekly Total</span>
            <span>{formatCurrencyExact(total)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold">
            <span>Remaining</span>
            <span style={{ color: remainingCents === 0 ? 'var(--success)' : 'var(--critical)' }}>
              {formatCurrencyExact(remainingCents / 100)}
            </span>
          </div>
          {remainingCents < 0 && (
            <span className="text-xs" style={{ color: 'var(--critical)' }}>
              The days add up to more than the weekly total.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className="rounded-lg px-4 py-2 text-sm font-medium cursor-pointer text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--series-1)' }}
          >
            Confirm Breakdown
          </button>
          <button type="button" onClick={onDismiss} className="text-sm cursor-pointer px-2" style={{ color: 'var(--text-muted)' }}>
            {dismissLabel}
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs underline cursor-pointer ml-auto"
              style={{ color: 'var(--critical)' }}
            >
              Remove Breakdown
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
