import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { elevation } from './elevation';
import { themes, type AppColors, type ThemeMode } from './colors';
import { borderWidth, hit, layout, motion, radius, spacing, typography } from './metrics';

interface ThemeContextValue {
  mode: ThemeMode;
  colors: AppColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  borderWidth: typeof borderWidth;
  elevation: typeof elevation;
  hit: typeof hit;
  layout: typeof layout;
  motion: typeof motion;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: themes[mode],
      spacing,
      radius,
      typography,
      borderWidth,
      elevation,
      hit,
      layout,
      motion,
      setMode,
    }),
    [mode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
