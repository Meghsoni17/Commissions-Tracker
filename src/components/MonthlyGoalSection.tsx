import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { formatCurrency, formatPercent, groupByMonth } from '../lib/calculations';
import { currentMonthKey, formatMonthLabel, recentMonths } from '../lib/dateUtils';
import { ProgressBar } from './ProgressBar';

export function MonthlyGoalSection() {
  const { entries, monthlyGoals, setMonthlyGoal } = useData();
  const [editing, setEditing] = useState(false);
  const [draftAmount, setDraftAmount] = useState('');

  const thisMonth = currentMonthKey();
  const byMonth = useMemo(() => groupByMonth(entries), [entries]);
  const goalByMonth = useMemo(() => new Map(monthlyGoals.map((g) => [g.monthKey, g.amount])), [monthlyGoals]);

  const currentGoal = goalByMonth.get(thisMonth) ?? 0;
  const currentActual = byMonth.get(thisMonth)?.commission ?? 0;
  const currentPct = currentGoal > 0 ? currentActual / currentGoal : 0;

  const history = useMemo(() => {
    const months = recentMonths(13).slice(0, -1).reverse(); // last 12 months, most recent first, excludes current
    return months
      .map((m) => ({ monthKey: m, goal: goalByMonth.get(m) ?? 0, actual: byMonth.get(m)?.commission ?? 0 }))
      .filter((row) => row.goal > 0 || row.actual > 0);
  }, [goalByMonth, byMonth]);

  function startEdit() {
    setDraftAmount(currentGoal ? String(currentGoal) : '');
    setEditing(true);
  }

  function save() {
    setMonthlyGoal(thisMonth, Number(draftAmount) || 0);
    setEditing(false);
  }

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-medium">Monthly Goal — {formatMonthLabel(thisMonth)}</h3>
        {!editing && (
          <button
            onClick={startEdit}
            className="text-xs px-2 py-1 rounded-md cursor-pointer"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            {currentGoal > 0 ? 'Edit Goal' : 'Set Goal'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            autoFocus
            type="number"
            min={0}
            step="0.01"
            value={draftAmount}
            onChange={(e) => setDraftAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Goal Amount ($)"
            className="w-40 rounded-md border px-2 py-1.5 text-sm outline-none tabular-nums"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-3)', color: 'var(--text-primary)' }}
          />
          <button onClick={save} className="rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer text-white" style={{ background: 'var(--series-1)' }}>
            Save
          </button>
          <button onClick={() => setEditing(false)} className="text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            Cancel
          </button>
        </div>
      ) : currentGoal > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="tabular-nums font-medium">
              {formatCurrency(currentActual)} <span style={{ color: 'var(--text-muted)' }}>of {formatCurrency(currentGoal)}</span>
            </span>
            <span className="tabular-nums" style={{ color: currentPct >= 1 ? 'var(--success)' : 'var(--text-secondary)' }}>
              {formatPercent(currentPct)}
            </span>
          </div>
          <ProgressBar value={currentPct} color={currentPct >= 1 ? 'var(--success)' : 'var(--series-1)'} />
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No goal set for this month yet.
        </p>
      )}

      {history.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
            History
          </h4>
          <div className="flex flex-col gap-2">
            {history.map((row) => {
              const pct = row.goal > 0 ? row.actual / row.goal : null;
              return (
                <div key={row.monthKey} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0" style={{ color: 'var(--text-secondary)' }}>
                    {formatMonthLabel(row.monthKey)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <ProgressBar value={pct ?? 0} color={pct !== null && pct >= 1 ? 'var(--success)' : 'var(--series-1)'} />
                  </div>
                  <span className="tabular-nums w-32 shrink-0 text-right" style={{ color: 'var(--text-muted)' }}>
                    {formatCurrency(row.actual)} {row.goal > 0 ? `/ ${formatCurrency(row.goal)}` : '(no goal)'}
                  </span>
                  <span className="tabular-nums w-10 shrink-0 text-right">{pct !== null ? formatPercent(pct) : '—'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
