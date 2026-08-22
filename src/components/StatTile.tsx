import type { ReactNode } from 'react';

interface StatTileProps {
  label: string;
  value: string;
  sublabel?: ReactNode;
  accent?: string;
}

export function StatTile({ label, value, sublabel, accent }: StatTileProps) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-1 min-w-0"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
    >
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <span
        className="text-3xl font-semibold truncate"
        style={{ color: accent ?? 'var(--text-primary)' }}
      >
        {value}
      </span>
      {sublabel && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {sublabel}
        </span>
      )}
    </div>
  );
}
