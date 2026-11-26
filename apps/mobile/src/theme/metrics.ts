import { Easing, type TextStyle } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.6 },
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.4 },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  eyebrow: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.1 },
  button: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  metric: { fontSize: 26, lineHeight: 30, fontWeight: '700', letterSpacing: -0.5 },
} satisfies Record<string, TextStyle>;

export const borderWidth = {
  hairline: 1,
  thin: 1,
  thick: 2,
} as const;

export const hit = {
  min: 44,
  compact: 36,
} as const;

export const motion = {
  fast: 140,
  normal: 220,
  slow: 320,
  easing: Easing.out(Easing.cubic),
} as const;

export const layout = {
  maxContentWidth: 720,
  tabBarHeight: 68,
} as const;
