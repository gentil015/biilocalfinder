const forest = '#174D38';
const forestDark = '#103A2B';
const forestSoft = '#E8F0EA';
const ivory = '#F6F1E7';
const surface = '#FFFFFF';
const gold = '#D8A64E';
const ink = '#1B2620';
const inkSecondary = '#5B6A61';
const inkMuted = '#6F7D74';
const line = '#E6E2D8';

export const lightColors = {
  primary: forest,
  primaryDark: forestDark,
  primarySoft: forestSoft,
  background: ivory,
  surface,
  surfaceAlt: '#FBF9F4',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#EFE9DC',
  text: ink,
  textSecondary: inkSecondary,
  textMuted: '#56645B',
  textOnPrimary: '#FFFFFF',
  border: line,
  borderStrong: '#D3CCBE',
  gold,
  goldSoft: '#F7EDD7',
  success: '#2E7D52',
  successSoft: '#E8F0EA',
  warning: '#8A5A10',
  warningSoft: '#FBF0DA',
  danger: '#B3352B',
  dangerSoft: '#FBE6E4',
  info: '#2B6D9C',
  infoSoft: '#E7F0F7',
  overlay: 'rgba(16, 58, 43, 0.45)',
  skeleton: '#EDE8DD',
  white: '#FFFFFF',
};

export const darkColors: typeof lightColors = {
  primary: '#86EFAC',
  primaryDark: '#BBF7D0',
  primarySoft: '#173B2B',
  background: '#0B1712',
  surface: '#122019',
  surfaceAlt: '#182A21',
  surfaceElevated: '#1C2E24',
  surfaceMuted: '#223229',
  text: '#F6F1E7',
  textSecondary: '#C9D6CD',
  textMuted: '#AFBFB4',
  textOnPrimary: '#0B1712',
  border: '#2A3D31',
  borderStrong: '#3D5345',
  gold,
  goldSoft: '#3B2F18',
  success: '#7DD3A0',
  successSoft: '#173B2B',
  warning: '#F0B862',
  warningSoft: '#3B2E17',
  danger: '#F08A80',
  dangerSoft: '#3C211E',
  info: '#8CC6EF',
  infoSoft: '#1B3040',
  overlay: 'rgba(0, 0, 0, 0.6)',
  skeleton: '#223229',
  white: '#FFFFFF',
};

export type AppColors = typeof lightColors;
export type ThemeMode = 'light' | 'dark';

export const themes: Record<ThemeMode, AppColors> = {
  light: lightColors,
  dark: darkColors,
};
