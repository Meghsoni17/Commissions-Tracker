import { useTheme } from '../context/ThemeContext';

export function useIsDark(): boolean {
  return useTheme().isDark;
}
