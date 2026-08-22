import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { StatTile } from '../components/StatTile';
import { RoleBadge } from '../components/RoleBadge';
import {
  formatCurrency,
  formatPercent,
  groupByMonth,
  groupByPeriodAndRole,
  groupByRole,
  groupByWeek,
  sumEntries,
  withRates,
} from '../lib/calculations';
import {
  currentMonthKey,
  formatMonthLabel,
  formatMonthLabelShort,
  formatWeekLabelShort,
  monthKey,
  recentMonths,
  recentWeeks,
  weekStartISO,
} from '../lib/dateUtils';
import { subWeeks, subMonths } from 'date-fns';
import { CommissionTrendChart, type TrendPoint } from '../components/charts/CommissionTrendChart';
import { RateComparisonChart, type RatePoint } from '../components/charts/RateComparisonChart';
import { MonthlyGoalSection } from '../components/MonthlyGoalSection';

function delta(current: number, previous: number): { pct: number | null; up: boolean } {
  if (previous === 0) return { pct: current === 0 ? 0 : null, up: current >= previous };
  return { pct: (current - previous) / previous, up: current >= previous };
}

function DeltaLabel({ current, previous, periodLabel }: { current: number; previous: number; periodLabel: string }) {
  const d = delta(current, previous);
  if (d.pct === null) return <>vs {periodLabel}: new</>;
  const arrow = d.pct >= 0 ? '↑' : '↓';
  const color = d.pct >= 0 ? 'var(--success)' : 'var(--critical)';
  return (
    <span>
      <span style={{ color }}>
        {arrow} {formatPercent(Math.abs(d.pct))}
      </span>{' '}
      vs {periodLabel}
    </span>
  );
}

export function Dashboard() {
  const { roles, entries } = useData();
  const activeRoles = roles.filter((r) => !r.archived);
  const [trendMode, setTrendMode] = useState<'week' | 'month'>('week');

  const thisWeek = weekStartISO();
  const lastWeek = weekStartISO(subWeeks(new Date(), 1));
  const thisMonth = currentMonthKey();
  const lastMonth = monthKey(weekStartISO(subMonths(new Date(), 1)));

  const byWeek = useMemo(() => groupByWeek(entries), [entries]);
  const byMonth = useMemo(() => groupByMonth(entries), [entries]);
  const byRole = useMemo(() => groupByRole(entries), [entries]);
  const allTime = useMemo(() => sumEntries(entries), [entries]);

  const thisWeekTotals = byWeek.get(thisWeek) ?? { booked: 0, showed: 0, closed: 0, commission: 0 };
  const lastWeekTotals = byWeek.get(lastWeek) ?? { booked: 0, showed: 0, closed: 0, commission: 0 };
  const thisMonthTotals = byMonth.get(thisMonth) ?? { booked: 0, showed: 0, closed: 0, commission: 0 };
  const lastMonthTotals = byMonth.get(lastMonth) ?? { booked: 0, showed: 0, closed: 0, commission: 0 };
  const allTimeRates = withRates(allTime);

  const roleRows = activeRoles
    .map((role) => ({ role, totals: withRates(byRole.get(role.id) ?? { booked: 0, showed: 0, closed: 0, commission: 0 }) }))
    .sort((a, b) => b.totals.commission - a.totals.commission);

  const trendData = useMemo<TrendPoint[]>(() => {
    if (trendMode === 'week') {
      const weeks = recentWeeks(8);
      const grouped = groupByPeriodAndRole(entries, (e) => e.weekStart);
      return weeks.map((w) => {
        const inner = grouped.get(w);
        const point: TrendPoint = { period: formatWeekLabelShort(w), fullLabel: `Week of ${formatWeekLabelShort(w)}`, total: 0 };
        for (const role of activeRoles) {
          const val = inner?.get(role.id)?.commission ?? 0;
          point[role.id] = val;
          point.total += val;
        }
        return point;
      });
    }
    const months = recentMonths(6);
    const grouped = groupByPeriodAndRole(entries, (e) => monthKey(e.weekStart));
    return months.map((m) => {
      const inner = grouped.get(m);
      const point: TrendPoint = { period: formatMonthLabelShort(m), fullLabel: formatMonthLabel(m), total: 0 };
      for (const role of activeRoles) {
        const val = inner?.get(role.id)?.commission ?? 0;
        point[role.id] = val;
        point.total += val;
      }
      return point;
    });
  }, [entries, activeRoles, trendMode]);

  const rateData = useMemo<RatePoint[]>(
    () =>
      roleRows.map(({ role, totals }) => ({
        role: role.name,
        showRate: totals.showRate ?? 0,
        closeRate: totals.closeRate ?? 0,
      })),
    [roleRows],
  );

  if (roles.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Add a role and log a few weeks of entries to see your dashboard.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="This Week's Commission"
          value={formatCurrency(thisWeekTotals.commission)}
          sublabel={<DeltaLabel current={thisWeekTotals.commission} previous={lastWeekTotals.commission} periodLabel="last week" />}
        />
        <StatTile
          label="This Month's Commission"
          value={formatCurrency(thisMonthTotals.commission)}
          sublabel={<DeltaLabel current={thisMonthTotals.commission} previous={lastMonthTotals.commission} periodLabel="last month" />}
        />
        <StatTile label="All-Time Show Rate" value={formatPercent(allTimeRates.showRate)} sublabel={`${allTime.showed} of ${allTime.booked} booked calls`} />
        <StatTile label="All-Time Close Rate" value={formatPercent(allTimeRates.closeRate)} sublabel={`${allTime.closed} of ${allTime.showed} shown calls`} />
      </div>

      <MonthlyGoalSection />

      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-medium">Commission By Role</h3>
          <div className="inline-flex rounded-lg border p-0.5 text-xs" style={{ borderColor: 'var(--border)' }}>
            {(['week', 'month'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setTrendMode(m)}
                className="px-2.5 py-1 rounded-md cursor-pointer"
                style={{
                  background: trendMode === m ? 'var(--surface-3)' : 'transparent',
                  color: trendMode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: trendMode === m ? 600 : 400,
                }}
              >
                {m === 'week' ? 'Last 8 Weeks' : 'Last 6 Months'}
              </button>
            ))}
          </div>
        </div>
        <CommissionTrendChart data={trendData} roles={activeRoles} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          <h3 className="text-sm font-medium mb-3">Show Rate Vs. Close Rate By Role</h3>
          <RateComparisonChart data={rateData} />
        </div>

        <div className="rounded-xl border p-4 overflow-x-auto" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          <h3 className="text-sm font-medium mb-3">All-Time Totals By Role</h3>
          <table className="w-full text-sm border-collapse min-w-[420px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Role', 'Commission', 'Booked', 'Showed', 'Closed', 'Show %', 'Close %'].map((h) => (
                  <th key={h} className="text-left px-2 py-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roleRows.map(({ role, totals }) => (
                <tr key={role.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-2 py-1.5">
                    <RoleBadge name={role.name} colorSlot={role.colorSlot} />
                  </td>
                  <td className="px-2 py-1.5 tabular-nums font-medium">{formatCurrency(totals.commission)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{totals.booked}</td>
                  <td className="px-2 py-1.5 tabular-nums">{totals.showed}</td>
                  <td className="px-2 py-1.5 tabular-nums">{totals.closed}</td>
                  <td className="px-2 py-1.5 tabular-nums">{formatPercent(totals.showRate)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{formatPercent(totals.closeRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
