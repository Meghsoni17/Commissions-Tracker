import { roleColorVar } from '../lib/colors';

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
