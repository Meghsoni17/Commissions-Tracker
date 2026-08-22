import type { ReactNode } from 'react';
import { ThemeToggle } from './ThemeToggle';

export type Tab = 'dashboard' | 'entries' | 'roles' | 'tax';

const TABS: { key: Tab; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'entries', label: 'Entries' },
  { key: 'roles', label: 'Roles' },
  { key: 'tax', label: 'Tax estimate' },
];

export function Layout({
  active,
  onChange,
  children,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
      <header
        className="sticky top-0 z-10 border-b backdrop-blur"
        style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--surface-2) 88%, transparent)' }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6 min-w-0">
            <h1 className="text-lg font-semibold shrink-0">CommTrack</h1>
            <nav className="flex items-center gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => onChange(tab.key)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  style={{
                    background: active === tab.key ? 'var(--surface-1)' : 'transparent',
                    color: active === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: active === tab.key ? '1px solid var(--border)' : '1px solid transparent',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
