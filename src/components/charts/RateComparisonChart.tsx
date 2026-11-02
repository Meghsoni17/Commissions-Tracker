import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useIsDark } from '../../hooks/useIsDark';
import { roleColorHex } from '../../lib/colors';
import { formatPercent } from '../../lib/calculations';
import { ChartLegend } from './ChartLegend';

export interface RatePoint {
  role: string;
  colorSlot: number;
  showRate: number | null;
  closeRate: number | null;
}

const CLOSE_OPACITY = 0.45;

/** Bars take each role's badge colour: solid for show rate, lighter for close rate. */
export function RateComparisonChart({ data }: { data: RatePoint[] }) {
  const isDark = useIsDark();
  const neutral = roleColorHex(0, isDark);
  const muted = 'var(--text-muted)';

  return (
    <div className="flex flex-col gap-2">
      <ChartLegend
        items={[
          { label: 'Show Rate (Solid)', color: neutral },
          { label: 'Close Rate (Lighter)', color: `${neutral}73` },
        ]}
      />
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke="var(--gridline)" />
          <XAxis dataKey="role" tickLine={false} axisLine={{ stroke: 'var(--baseline)' }} tick={{ fill: muted, fontSize: 12 }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: muted, fontSize: 12 }}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            width={40}
            domain={[0, 1]}
          />
          <Tooltip
            cursor={{ fill: 'var(--gridline)', opacity: 0.4 }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              return (
                <div
                  className="rounded-lg border px-3 py-2 text-xs shadow-sm"
                  style={{ background: 'var(--surface-3)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  <div className="font-medium mb-1">{label}</div>
                  {payload.map((p) => (
                    <div key={p.dataKey as string} className="flex items-center justify-between gap-4">
                      <span style={{ color: 'var(--text-secondary)' }}>{p.dataKey === 'showRate' ? 'Show Rate' : 'Close Rate'}</span>
                      <span className="tabular-nums">{formatPercent(p.value as number | null)}</span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <Bar dataKey="showRate" maxBarSize={24} radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.role} fill={roleColorHex(d.colorSlot, isDark)} />
            ))}
          </Bar>
          <Bar dataKey="closeRate" maxBarSize={24} radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.role} fill={roleColorHex(d.colorSlot, isDark)} fillOpacity={CLOSE_OPACITY} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
