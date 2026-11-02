import { roleColorVar } from '../lib/colors';
import type { Role } from '../types';

export function RoleBadge({ name, colorSlot }: { name: string; colorSlot: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span
        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: roleColorVar(colorSlot) }}
      />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** A role's badge, or a clear flag when an entry has no valid role. */
export function RoleTag({ role }: { role: Role | undefined }) {
  if (role) return <RoleBadge name={role.name} colorSlot={role.colorSlot} />;
  return (
    <span
      className="inline-block rounded-md px-2 py-0.5 text-xs font-medium"
      style={{
        color: 'var(--text-primary)',
        background: 'color-mix(in srgb, var(--warning) 18%, transparent)',
        border: '1px solid color-mix(in srgb, var(--warning) 60%, transparent)',
      }}
    >
      Unassigned
    </span>
  );
}
