import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/metrics';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
  refreshControl?: ScrollViewProps['refreshControl'];
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  contentStyle,
  edges = ['top'],
  refreshControl,
}: ScreenProps) {
  const { colors } = useTheme();
  const content = (
    <View style={[padded && styles.padded, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }, style]} edges={edges}>
      {scroll ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={styles.fill}>{content}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  padded: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
});
