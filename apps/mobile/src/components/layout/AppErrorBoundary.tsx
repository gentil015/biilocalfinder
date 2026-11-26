import { Component, type ErrorInfo, type ReactNode } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import type { AppColors } from '@/src/theme/colors';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';

interface ErrorBoundaryContentProps {
  children: ReactNode;
  colors: AppColors;
}

interface State {
  error: Error | null;
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <ErrorBoundaryContent colors={colors}>{children}</ErrorBoundaryContent>;
}

class ErrorBoundaryContent extends Component<ErrorBoundaryContentProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('App error boundary:', error.message, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const { colors } = this.props;
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[typography.h2, { color: colors.primary, textAlign: 'center' }]}>The app hit a problem</Text>
        <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
          Something went wrong. Please try again.
        </Text>
        <Button
          label="Reload app"
          onPress={() => {
            this.setState({ error: null });
            router.replace('/');
          }}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
});
