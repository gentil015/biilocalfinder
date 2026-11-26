import type { ViewStyle } from 'react-native';

export const elevation = {
  none: {} as ViewStyle,
  subtle: {
    shadowColor: '#103A2B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  } satisfies ViewStyle,
  raised: {
    shadowColor: '#103A2B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  } satisfies ViewStyle,
  overlay: {
    shadowColor: '#103A2B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  } satisfies ViewStyle,
};
