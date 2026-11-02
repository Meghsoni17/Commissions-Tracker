import { formatCurrency, formatPercent, type RateTotals } from '../lib/calculations';
import { ALL_ROLES } from '../lib/roles';
import type { SalesBreakdown } from '../lib/salesStats';
import { RoleBadge } from './RoleBadge';

/** Each role side by side, with All Roles worked out from the combined counts. */
export function SalesComparisonTable({
  breakdown,
  roleFilter,
  showCommission = false,
}: {
  breakdown: SalesBreakdown;
  roleFilter: string;
  showCommission?: boolean;
}) {
  const headers = ['Role', ...(showCommission ? ['Commission'] : []), 'Booked', 'Showed', 'Closed', 'Show Rate', 'Close Rate', 'Booked-To-Close'];

  function cells(t: RateTotals) {
    return (
      <>
        {showCommission && <td className="px-2 py-1.5 tabular-nums font-medium">{formatCurrency(t.commission)}</td>}
        <td className="px-2 py-1.5 tabular-nums">{t.booked}</td>
        <td className="px-2 py-1.5 tabular-nums">{t.showed}</td>
        <td className="px-2 py-1.5 tabular-nums">{t.closed}</td>
        <td className="px-2 py-1.5 tabular-nums">{formatPercent(t.showRate)}</td>
        <td className="px-2 py-1.5 tabular-nums">{formatPercent(t.closeRate)}</td>
        <td className="px-2 py-1.5 tabular-nums">{formatPercent(t.bookedToCloseRate)}</td>
      </>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[560px]">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {headers.map((h) => (
              <th key={h} className="text-left px-2 py-1.5 font-medium whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {breakdown.rows.map(({ role, totals }) => (
            <tr key={role.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td className="px-2 py-1.5">
                <RoleBadge name={role.name} colorSlot={role.colorSlot} />
              </td>
              {cells(totals)}
            </tr>
          ))}
          {roleFilter === ALL_ROLES && (
            <tr className="font-semibold">
              <td className="px-2 py-1.5">All Roles</td>
              {cells(breakdown.combined)}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
