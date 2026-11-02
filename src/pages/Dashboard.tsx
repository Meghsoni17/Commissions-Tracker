import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { StatTile } from '../components/StatTile';
import { PeriodSelect, RoleFilterSelect } from '../components/SalesFilters';
import { SalesComparisonTable } from '../components/SalesComparisonTable';
import {
  formatCurrency,
  formatPercent,
  groupByMonth,
  groupByPeriodAndRole,
  groupByWeek,
} from '../lib/calculations';
import {
  currentMonthKey,
  formatMonthLabel,
  formatMonthLabelShort,
  formatWeekLabelShort,
  monthKey,
  previousMonthKey,
  recentMonths,
  recentWeeks,
  weekStartISO,
  weekStartOf,
} from '../lib/dateUtils';
import { currentFYKey, fyLabel, isISODateInFY } from '../lib/financialYear';
import { ALL_ROLES, UNASSIGNED, UNASSIGNED_ROLE, roleKey, withRoleKeys } from '../lib/roles';
import { ALL_TIME, salesBreakdown, salesPeriodLabel } from '../lib/salesStats';
import { subWeeks } from 'date-fns';
import { CommissionTrendChart, type TrendPoint } from '../components/charts/CommissionTrendChart';
import { RateComparisonChart, type RatePoint } from '../components/charts/RateComparisonChart';
import { MonthlyGoalSection } from '../components/MonthlyGoalSection';
import { UpcomingPayments } from '../components/UpcomingPayments';
import { upcomingReminders } from '../lib/deals';

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
  const { roles, entries, superContributions, deals } = useData();
  const [trendMode, setTrendMode] = useState<'week' | 'month'>('week');
  const [roleFilter, setRoleFilter] = useState(ALL_ROLES);
  const [period, setPeriod] = useState(ALL_TIME);

  const thisWeek = weekStartISO();
  const lastWeek = weekStartISO(subWeeks(new Date(), 1));
  const thisMonth = currentMonthKey();
  const lastMonth = previousMonthKey();
  const thisFY = currentFYKey();

  const superThisFY = useMemo(
    () => superContributions.filter((s) => isISODateInFY(s.date, thisFY)).reduce((sum, s) => sum + s.amount, 0),
    [superContributions, thisFY],
  );

  const byWeek = useMemo(() => groupByWeek(entries), [entries]);
  const byMonth = useMemo(() => groupByMonth(entries), [entries]);
  const breakdown = useMemo(() => salesBreakdown(entries, roles, roleFilter, period), [entries, roles, roleFilter, period]);
  const sales = breakdown.combined;
  const periodLabel = salesPeriodLabel(period);

  const thisWeekTotals = byWeek.get(thisWeek) ?? { booked: 0, showed: 0, closed: 0, commission: 0 };
  const lastWeekTotals = byWeek.get(lastWeek) ?? { booked: 0, showed: 0, closed: 0, commission: 0 };
  const thisMonthTotals = byMonth.get(thisMonth) ?? { booked: 0, showed: 0, closed: 0, commission: 0 };
  const lastMonthTotals = byMonth.get(lastMonth) ?? { booked: 0, showed: 0, closed: 0, commission: 0 };

  // Unassigned commission is charted too, so All Roles includes everything.
  const chartRoles = useMemo(() => {
    if (roleFilter === UNASSIGNED) return [UNASSIGNED_ROLE];
    if (roleFilter !== ALL_ROLES) return roles.filter((r) => r.id === roleFilter);
    const hasUnassigned = entries.some((e) => roleKey(e.roleId, roles) === UNASSIGNED);
    const active = roles.filter((r) => !r.archived);
    return hasUnassigned ? [...active, UNASSIGNED_ROLE] : active;
  }, [roleFilter, roles, entries]);

  const trendData = useMemo<TrendPoint[]>(() => {
    if (trendMode === 'week') {
      const weeks = recentWeeks(8);
      const grouped = groupByPeriodAndRole(withRoleKeys(entries, roles), weekStartOf);
      return weeks.map((w) => {
        const inner = grouped.get(w);
        const point: TrendPoint = { period: formatWeekLabelShort(w), fullLabel: `Week of ${formatWeekLabelShort(w)}`, total: 0 };
        for (const role of chartRoles) {
          const val = inner?.get(role.id)?.commission ?? 0;
          point[role.id] = val;
          point.total += val;
        }
        return point;
      });
    }
    const months = recentMonths(6);
    const grouped = groupByPeriodAndRole(withRoleKeys(entries, roles), monthKey);
    return months.map((m) => {
      const inner = grouped.get(m);
      const point: TrendPoint = { period: formatMonthLabelShort(m), fullLabel: formatMonthLabel(m), total: 0 };
      for (const role of chartRoles) {
        const val = inner?.get(role.id)?.commission ?? 0;
        point[role.id] = val;
        point.total += val;
      }
      return point;
    });
  }, [entries, roles, chartRoles, trendMode]);

  const rateData = useMemo<RatePoint[]>(
    () =>
      breakdown.rows.map(({ role, totals }) => ({
        role: role.name,
        colorSlot: role.colorSlot,
        showRate: totals.showRate,
        closeRate: totals.closeRate,
      })),
    [breakdown],
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Filters The Show And Close Rates, Commission Chart And Sales Table. Other Figures Aren't Filtered.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <RoleFilterSelect value={roleFilter} onChange={setRoleFilter} />
          <PeriodSelect value={period} onChange={setPeriod} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
        <StatTile label={`${periodLabel} Show Rate`} value={formatPercent(sales.showRate)} sublabel={`${sales.showed} of ${sales.booked} booked calls`} />
        <StatTile label={`${periodLabel} Close Rate`} value={formatPercent(sales.closeRate)} sublabel={`${sales.closed} of ${sales.showed} shown calls`} />
        <StatTile label="Super Contributed" value={formatCurrency(superThisFY)} sublabel={fyLabel(thisFY)} />
      </div>

      <MonthlyGoalSection />

      {upcomingReminders(deals, 30).length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          <h3 className="text-sm font-medium mb-3">Upcoming Payments (Next 30 Days)</h3>
          <UpcomingPayments deals={deals} roles={roles} withinDays={30} limit={5} />
        </div>
      )}

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
        <CommissionTrendChart data={trendData} roles={chartRoles} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          <h3 className="text-sm font-medium mb-3">Show Rate Vs. Close Rate By Role — {periodLabel}</h3>
          <RateComparisonChart data={rateData} />
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          <h3 className="text-sm font-medium mb-3">Totals By Role — {periodLabel}</h3>
          <SalesComparisonTable breakdown={breakdown} roleFilter={roleFilter} showCommission />
        </div>
      </div>
    </div>
  );
}
