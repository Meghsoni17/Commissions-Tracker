export interface LegendItem {
  label: string;
  color: string;
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  if (items.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
