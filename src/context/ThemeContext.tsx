import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type ThemePref = 'light' | 'dark' | 'system';

const KEY = 'commissions-tracker-theme';

interface ThemeContextValue {
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(() => (localStorage.getItem(KEY) as ThemePref) || 'system');
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  function setTheme(t: ThemePref) {
    localStorage.setItem(KEY, t);
    setThemeState(t);
  }

  const isDark = theme === 'dark' || (theme === 'system' && systemDark);

  return <ThemeContext.Provider value={{ theme, setTheme, isDark }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
