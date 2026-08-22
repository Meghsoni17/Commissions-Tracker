import { useState } from 'react';
import { useData } from '../context/DataContext';
import { COLOR_SLOTS, roleColorVar } from '../lib/colors';
import { formatCurrency, formatPercent, groupByRole, withRates } from '../lib/calculations';

export function RolesPage() {
  const { roles, entries, addRole, renameRole, setRoleColor, archiveRole } = useData();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const totalsByRole = groupByRole(entries);

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    addRole(name);
    setNewName('');
  }

  function startEdit(id: string, name: string) {
    setEditingId(id);
    setEditingName(name);
  }

  function commitEdit() {
    if (editingId && editingName.trim()) {
      renameRole(editingId, editingName.trim());
    }
    setEditingId(null);
  }

  const active = roles.filter((r) => !r.archived);
  const archived = roles.filter((r) => r.archived);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold mb-1">Roles</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Add a role for each way you earn commission. Each role tracks its own calls and revenue.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="New Role Name (e.g. Account Executive)"
          className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <button
          onClick={handleAdd}
          className="rounded-lg px-4 py-2 text-sm font-medium cursor-pointer text-white"
          style={{ background: 'var(--series-1)' }}
        >
          Add Role
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {active.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No roles yet — add your first one above.
          </p>
        )}
        {active.map((role) => {
          const totals = withRates(totalsByRole.get(role.id) ?? { booked: 0, showed: 0, closed: 0, commission: 0 });
          return (
            <div
              key={role.id}
              className="rounded-xl border p-4 flex flex-col gap-3"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  {editingId === role.id ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                      className="rounded-md border px-2 py-1 text-sm outline-none"
                      style={{ borderColor: 'var(--border)', background: 'var(--surface-3)', color: 'var(--text-primary)' }}
                    />
                  ) : (
                    <button
                      onClick={() => startEdit(role.id, role.name)}
                      className="flex items-center gap-2 font-medium cursor-pointer"
                      title="Click to rename"
                    >
                      <span
                        className="inline-block w-3 h-3 rounded-full shrink-0"
                        style={{ background: roleColorVar(role.colorSlot) }}
                      />
                      {role.name}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {COLOR_SLOTS.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setRoleColor(role.id, slot)}
                        className="w-4 h-4 rounded-full cursor-pointer"
                        style={{
                          background: roleColorVar(slot),
                          outline: role.colorSlot === slot ? '2px solid var(--text-primary)' : 'none',
                          outlineOffset: 1,
                        }}
                        aria-label={`Color ${slot}`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => archiveRole(role.id, true)}
                    className="text-xs px-2 py-1 rounded-md cursor-pointer"
                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  >
                    Archive
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-sm">
                <Metric label="Commission" value={formatCurrency(totals.commission)} />
                <Metric label="Booked" value={String(totals.booked)} />
                <Metric label="Showed" value={String(totals.showed)} />
                <Metric label="Closed" value={String(totals.closed)} />
                <Metric label="Show Rate" value={formatPercent(totals.showRate)} />
                <Metric label="Close Rate" value={formatPercent(totals.closeRate)} />
              </div>
            </div>
          );
        })}
      </div>

      {archived.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Archived
          </h3>
          {archived.map((role) => (
            <div
              key={role.id}
              className="rounded-lg border px-3 py-2 flex items-center justify-between text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-muted)' }}
            >
              <span className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: roleColorVar(role.colorSlot) }} />
                {role.name}
              </span>
              <button onClick={() => archiveRole(role.id, false)} className="underline cursor-pointer">
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="tabular-nums font-semibold">{value}</span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
    </div>
  );
}
