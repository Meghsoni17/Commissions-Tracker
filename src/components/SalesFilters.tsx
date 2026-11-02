import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { ALL_ROLES, UNASSIGNED, roleKey } from '../lib/roles';
import { ALL_TIME, salesFYOptions, salesPeriodLabel } from '../lib/salesStats';
import { fyLabel } from '../lib/financialYear';

const selectStyle = { borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' };

export function RoleFilterSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { roles, entries } = useData();
  const hasUnassigned = entries.some((e) => roleKey(e.roleId, roles) === UNASSIGNED);
  return (
    <select
      aria-label="Role Filter"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border px-3 py-1.5 text-sm outline-none"
      style={selectStyle}
    >
      <option value={ALL_ROLES}>All Roles</option>
      {roles.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
          {r.archived ? ' (Archived)' : ''}
        </option>
      ))}
      {(hasUnassigned || value === UNASSIGNED) && <option value={UNASSIGNED}>Unassigned</option>}
    </select>
  );
}

export function PeriodSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { entries } = useData();
  const years = useMemo(() => salesFYOptions(entries), [entries]);
  return (
    <select
      aria-label="Period Filter"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border px-3 py-1.5 text-sm outline-none"
      style={selectStyle}
    >
      <option value={ALL_TIME}>All Time</option>
      <option value="week">{salesPeriodLabel('week')}</option>
      <option value="month">{salesPeriodLabel('month')}</option>
      {years.map((fy) => (
        <option key={fy} value={fy}>
          {fyLabel(fy)}
        </option>
      ))}
    </select>
  );
}
