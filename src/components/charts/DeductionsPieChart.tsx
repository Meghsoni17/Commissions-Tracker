import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { roleColorHex } from '../../lib/colors';
import { formatCurrencyExact, formatPercent } from '../../lib/calculations';
import { useIsDark } from '../../hooks/useIsDark';
import { ChartLegend } from './ChartLegend';

export interface DeductionSlice {
  category: string;
  amount: number;
}

interface Slice extends DeductionSlice {
  color: string;
  pct: number;
}

export function DeductionsPieChart({ data }: { data: DeductionSlice[] }) {
  const isDark = useIsDark();
  const total = data.reduce((sum, d) => sum + d.amount, 0);

  if (total <= 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Add deductions to see a category breakdown.
      </p>
    );
  }

  const slices: Slice[] = data.map((d, i) => ({
    ...d,
    color: roleColorHex(i + 1, isDark),
    pct: d.amount / total,
  }));

  return (
    <div className="flex flex-col gap-2">
      <ChartLegend items={slices.map((s) => ({ label: `${s.category} (${formatPercent(s.pct)})`, color: s.color }))} />
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={slices} dataKey="amount" nameKey="category" innerRadius={55} outerRadius={90} paddingAngle={2}>
            {slices.map((s) => (
              <Cell key={s.category} fill={s.color} stroke="var(--surface-1)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<DeductionTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function DeductionTooltip({ active, payload }: { active?: boolean; payload?: { payload: Slice }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const slice = payload[0].payload;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-sm"
      style={{ background: 'var(--surface-3)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
    >
      <div className="font-medium mb-1">{slice.category}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="tabular-nums">{formatCurrencyExact(slice.amount)}</span>
        <span className="tabular-nums">{formatPercent(slice.pct)}</span>
      </div>
    </div>
  );
}
