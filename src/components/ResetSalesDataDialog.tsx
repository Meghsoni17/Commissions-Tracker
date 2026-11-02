import { useEffect, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { formatCurrencyExact } from '../lib/calculations';
import { formatShortDate, formatWeekLabel } from '../lib/dateUtils';
import { binnedEntriesWithSales, buildSalesPreview, type SalesPreviewEntry } from '../lib/salesReset';
import { PreviewRow, Section, useResetRange } from './ResetDialogParts';
import { RoleBadge } from './RoleBadge';

const CONFIRM_WORD = 'DELETE';

function plural(count: number): string {
  return `${count} ${count === 1 ? 'Entry' : 'Entries'}`;
}

/** Clears booked, showed and closed in a date range. Commissions and everything else stay as they are. */
export function ResetSalesDataDialog({ onClose, onCleared }: { onClose: () => void; onCleared: (count: number) => void }) {
  const { roles, entries, deals, recentlyDeleted, clearSales } = useData();
  /** Ticks the user changed by hand; everything else follows the default for its row. */
  const [ticks, setTicks] = useState<Map<string, boolean>>(new Map());
  const [confirmText, setConfirmText] = useState('');
  const { range, fields: rangeFields } = useResetRange(() => {
    setTicks(new Map());
    setConfirmText('');
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const preview = useMemo(() => (range ? buildSalesPreview({ entries, deals }, range) : null), [range, entries, deals]);
  const binned = range ? binnedEntriesWithSales({ recentlyDeleted }, range) : 0;

  const partialRows = preview?.filter((p) => p.partial) ?? [];
  const fullRows = preview?.filter((p) => !p.partial) ?? [];

  // A partly-overlapping week may hold correct numbers, so it's only cleared if ticked.
  const isTicked = (p: SalesPreviewEntry) => ticks.get(p.entry.id) ?? !p.partial;
  const selected = (preview ?? []).filter(isTicked);
  const canDelete = selected.length > 0 && confirmText === CONFIRM_WORD;

  const totals = selected.reduce(
    (sum, p) => ({
      booked: sum.booked + p.entry.booked,
      showed: sum.showed + p.entry.showed,
      closed: sum.closed + p.entry.closed,
    }),
    { booked: 0, showed: 0, closed: 0 },
  );

  function setTicked(id: string, checked: boolean) {
    setTicks((cur) => new Map(cur).set(id, checked));
    setConfirmText('');
  }

  function runClear() {
    if (!canDelete) return;
    clearSales(new Set(selected.map((p) => p.entry.id)));
    onCleared(selected.length);
  }

  function row(p: SalesPreviewEntry) {
    const role = roleById.get(p.entry.roleId);
    return (
      <PreviewRow
        key={p.entry.id}
        checked={isTicked(p)}
        onChange={(checked) => setTicked(p.entry.id, checked)}
        label={`Week Of ${formatWeekLabel(p.entry.weekStart)}`}
        badge={role ? <RoleBadge name={role.name} colorSlot={role.colorSlot} /> : undefined}
      >
        <span className="block tabular-nums">
          Booked {p.entry.booked} · Showed {p.entry.showed} · Closed {p.entry.closed}
        </span>
        <span className="block tabular-nums" style={{ color: 'var(--text-muted)' }}>
          Commission Stays: {formatCurrencyExact(p.entry.commission)}
        </span>
        {p.deal && (
          <span className="block">
            From Deal: {p.deal.clientName}, Sold {formatShortDate(p.deal.saleDate)}
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
      aria-labelledby="reset-sales-title"
    >
      <div
        className="w-full max-w-2xl max-h-full overflow-y-auto rounded-xl border p-5 flex flex-col gap-4 shadow-lg"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
      >
        <div>
          <h3 id="reset-sales-title" className="text-base font-semibold">
            Reset Sales Data
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Clears booked, showed and closed numbers only, which also clears their show and close rates. Commissions
            stay exactly as they are. Nothing changes until you confirm below, and cleared numbers stay in Recently
            Deleted Sales Data for 30 days.
          </p>
        </div>

        {rangeFields}

        {preview?.length === 0 && (
          <p className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>
            No Sales Data In This Range.
          </p>
        )}

        {binned > 0 && (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {plural(binned)} in this range {binned === 1 ? 'is' : 'are'} in Recently Deleted, so {binned === 1 ? 'it' : 'they'} can't
            be cleared here and {binned === 1 ? "isn't" : "aren't"} counted in your totals. Restoring {binned === 1 ? 'it' : 'them'} there
            brings the sales numbers back too.
          </p>
        )}

        {partialRows.length > 0 && (
          <div
            className="rounded-lg p-3 flex flex-col gap-2"
            style={{
              background: 'color-mix(in srgb, var(--warning) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--warning) 60%, transparent)',
            }}
          >
            <div>
              <h4 className="text-sm font-semibold">Partly Overlapping Weeks ({partialRows.length})</h4>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                These weeks fall only partly inside your range, so they start unticked. Sales numbers are weekly, so
                ticking one clears the whole week's numbers, including days outside the range.
              </p>
            </div>
            {partialRows.map(row)}
          </div>
        )}

        {fullRows.length > 0 && <Section title={`Sales Data (${fullRows.length})`}>{fullRows.map(row)}</Section>}

        {preview && preview.length > 0 && (
          <div className="flex flex-col gap-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between gap-3 flex-wrap text-sm font-semibold tabular-nums">
              <span>Will Clear: {plural(selected.length)}</span>
              <span>
                Booked {totals.booked} · Showed {totals.showed} · Closed {totals.closed}
              </span>
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
            onClick={runClear}
            disabled={!canDelete}
            className="rounded-lg px-4 py-2 text-sm font-medium cursor-pointer text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--critical)' }}
          >
            Clear {plural(selected.length)}
          </button>
          <button type="button" onClick={onClose} className="text-sm cursor-pointer px-2" style={{ color: 'var(--text-muted)' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
