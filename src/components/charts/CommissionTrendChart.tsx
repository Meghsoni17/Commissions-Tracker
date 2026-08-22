import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Role } from '../../types';
import { roleColorHex } from '../../lib/colors';
import { formatCurrency } from '../../lib/calculations';
import { useIsDark } from '../../hooks/useIsDark';
import { ChartLegend } from './ChartLegend';

export interface TrendPoint {
  period: string; // short x-axis label
  fullLabel: string; // tooltip label
  total: number;
  [roleId: string]: string | number;
}

export function CommissionTrendChart({ data, roles }: { data: TrendPoint[]; roles: Role[] }) {
  const isDark = useIsDark();
  const gridline = 'var(--gridline)';
  const muted = 'var(--text-muted)';

  const legendItems = roles.map((r) => ({ label: r.name, color: roleColorHex(r.colorSlot, isDark) }));

  return (
    <div className="flex flex-col gap-2">
      <ChartLegend items={legendItems} />
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke={gridline} strokeDasharray="0" />
          <XAxis
            dataKey="period"
            tickLine={false}
            axisLine={{ stroke: 'var(--baseline)' }}
            tick={{ fill: muted, fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: muted, fontSize: 12 }}
            tickFormatter={(v: number) => formatCurrency(v)}
            width={52}
          />
          <Tooltip content={<CommissionTooltip roles={roles} isDark={isDark} />} cursor={{ fill: 'var(--gridline)', opacity: 0.4 }} />
          {roles.map((role, i) => (
            <Bar
              key={role.id}
              dataKey={role.id}
              stackId="commission"
              fill={roleColorHex(role.colorSlot, isDark)}
              maxBarSize={24}
              radius={i === roles.length - 1 ? [4, 4, 0, 0] : 0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CommissionTooltip({
  active,
  payload,
  roles,
  isDark,
}: {
  active?: boolean;
  payload?: { dataKey: string | number; value: number; payload: TrendPoint }[];
  roles: Role[];
  isDark: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-sm"
      style={{ background: 'var(--surface-3)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
    >
      <div className="font-medium mb-1">{point.fullLabel}</div>
      {roles.map((role) => {
        const val = point[role.id];
        if (typeof val !== 'number' || val === 0) return null;
        return (
          <div key={role.id} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: roleColorHex(role.colorSlot, isDark) }} />
              {role.name}
            </span>
            <span className="tabular-nums">{formatCurrency(val)}</span>
          </div>
        );
      })}
      <div className="flex items-center justify-between gap-4 mt-1 pt-1 font-semibold" style={{ borderTop: '1px solid var(--border)' }}>
        <span>Total</span>
        <span className="tabular-nums">{formatCurrency(point.total)}</span>
      </div>
    </div>
  );
}
