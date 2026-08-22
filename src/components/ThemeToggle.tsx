import { useTheme } from '../context/ThemeContext';

const OPTIONS = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'system', label: 'System' },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div
      className="inline-flex rounded-lg border p-0.5 text-xs"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => setTheme(opt.key)}
          className="px-2.5 py-1 rounded-md transition-colors cursor-pointer"
          style={{
            background: theme === opt.key ? 'var(--surface-3)' : 'transparent',
            color: theme === opt.key ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: theme === opt.key ? 600 : 400,
            boxShadow: theme === opt.key ? '0 1px 2px var(--border)' : 'none',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
