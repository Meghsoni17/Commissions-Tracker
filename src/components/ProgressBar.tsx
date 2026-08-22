export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--gridline)' }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct * 100}%`, background: color ?? 'var(--series-1)' }}
      />
    </div>
  );
}
