import { useState } from 'react';
import { useData } from '../context/DataContext';
import { formatWeekLabel } from '../lib/dateUtils';
import { RECENTLY_DELETED_DAYS, deletedItemDaysLeft } from '../lib/reset';
import { canRestoreSales } from '../lib/salesReset';
import { RoleTag } from './RoleBadge';

/** The Reset Sales Data safety net: restore cleared numbers, or empty it for good. */
export function RecentlyDeletedSales() {
  const { roles, entries, deals, recentlyDeleted, recentlyDeletedSales, restoreSales, emptyRecentlyDeletedSales } = useData();
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);
  const [now] = useState(() => Date.now());

  const items = [...recentlyDeletedSales].sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  return (
    <div className="rounded-xl border p-4 flex flex-col gap-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-medium">Recently Deleted Sales Data ({items.length})</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Kept for {RECENTLY_DELETED_DAYS} days, then removed for good.
          </p>
        </div>
        {items.length > 0 && !confirmingEmpty && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => restoreSales()}
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
                emptyRecentlyDeletedSales();
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
                {['Week', 'Role', 'Booked', 'Showed', 'Closed', 'Days Left', ''].map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const role = roles.find((r) => r.id === d.roleId);
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-3 py-2 whitespace-nowrap">{formatWeekLabel(d.weekStart)}</td>
                    <td className="px-3 py-2">
                      <RoleTag role={role} />
                    </td>
                    <td className="px-3 py-2 tabular-nums">{d.booked}</td>
                    <td className="px-3 py-2 tabular-nums">{d.showed}</td>
                    <td className="px-3 py-2 tabular-nums">{d.closed}</td>
                    <td className="px-3 py-2 tabular-nums">{deletedItemDaysLeft(d, now)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {canRestoreSales({ entries, deals, recentlyDeleted }, d) ? (
                        <button
                          onClick={() => restoreSales(new Set([d.id]))}
                          className="text-xs underline cursor-pointer"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          Restore
                        </button>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Entry Has New Numbers
                        </span>
                      )}
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
