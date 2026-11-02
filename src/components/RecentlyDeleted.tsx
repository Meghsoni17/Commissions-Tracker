import { useState } from 'react';
import { useData } from '../context/DataContext';
import type { DeletedItem } from '../types';
import { formatCurrencyExact } from '../lib/calculations';
import { formatShortDate, formatWeekLabel } from '../lib/dateUtils';
import { RECENTLY_DELETED_DAYS, deletedItemDaysLeft } from '../lib/reset';

function describe(d: DeletedItem): { kind: string; date: string; detail: string; amount: number } {
  if (d.type === 'commission') {
    return { kind: 'Commission', date: `Week Of ${formatWeekLabel(d.item.weekStart)}`, detail: d.item.notes ?? '', amount: d.item.commission };
  }
  if (d.type === 'deduction') {
    return { kind: 'Deduction', date: formatShortDate(d.item.purchaseDate), detail: d.item.description, amount: d.item.amount };
  }
  return { kind: 'Super Contribution', date: formatShortDate(d.item.date), detail: d.item.notes ?? '', amount: d.item.amount };
}

/** The Reset By Date Range safety net: restore items, or empty it for good. */
export function RecentlyDeleted() {
  const { recentlyDeleted, restoreRecentlyDeleted, emptyRecentlyDeleted } = useData();
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);
  const [now] = useState(() => Date.now());

  const items = [...recentlyDeleted].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));

  return (
    <div className="rounded-xl border p-4 flex flex-col gap-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-medium">Recently Deleted ({items.length})</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Kept for {RECENTLY_DELETED_DAYS} days, then removed for good.
          </p>
        </div>
        {items.length > 0 && !confirmingEmpty && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => restoreRecentlyDeleted()}
              className="rounded-md px-3 py-1 text-xs font-medium cursor-pointer"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              Restore All
            </button>
            <button onClick={() => setConfirmingEmpty(true)} className="text-xs underline cursor-pointer" style={{ color: 'var(--critical)' }}>
              Empty Permanently
            </button>
          </div>
        )}
        {items.length > 0 && confirmingEmpty && (
          <div className="flex items-center gap-2 text-xs">
            <span style={{ color: 'var(--text-secondary)' }}>This Can't Be Undone.</span>
            <button
              onClick={() => {
                emptyRecentlyDeleted();
                setConfirmingEmpty(false);
              }}
              className="rounded-md px-3 py-1 font-medium cursor-pointer text-white"
              style={{ background: 'var(--critical)' }}
            >
              Yes, Empty It
            </button>
            <button onClick={() => setConfirmingEmpty(false)} className="cursor-pointer" style={{ color: 'var(--text-muted)' }}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Nothing Here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm border-collapse min-w-[640px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Type', 'Date', 'Details', 'Amount', 'Days Left', ''].map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const { kind, date, detail, amount } = describe(d);
                return (
                  <tr key={d.item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-3 py-2 whitespace-nowrap">{kind}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{date}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                      {detail || '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums font-medium">{formatCurrencyExact(amount)}</td>
                    <td className="px-3 py-2 tabular-nums">{deletedItemDaysLeft(d, now)}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => restoreRecentlyDeleted(new Set([d.item.id]))}
                        className="text-xs underline cursor-pointer"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
