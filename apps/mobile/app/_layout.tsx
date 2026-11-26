import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppErrorBoundary } from '@/src/components/layout/AppErrorBoundary';
import { ToastProvider } from '@/src/components/ui/Toast';
import { useReducedMotion } from '@/src/hooks/useReducedMotion';
import { setUnauthorizedHandler } from '@/src/services/api/client';
import { bindNotificationEvents, configureLocalNotifications } from '@/src/services/notifications/local';
import { disconnectSocket } from '@/src/services/socket';
import { useAppStore } from '@/src/stores/app.store';
import { useAuthStore } from '@/src/stores/auth.store';
import { ThemeProvider, useTheme } from '@/src/theme/ThemeProvider';

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
          mutations: { retry: 0 },
        },
      }),
  );
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const authStatus = useAuthStore((state) => state.status);

  useEffect(() => {
    setUnauthorizedHandler(() => useAuthStore.getState().reset());
    void configureLocalNotifications().catch(() => undefined);
    void (async () => {
      await useAppStore.getState().hydrate();
      await bootstrap();
    })();
  }, [bootstrap]);

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      disconnectSocket();
      return;
    }
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void bindNotificationEvents()
      .then((cleanup) => {
        if (cancelled) cleanup();
        else dispose = cleanup;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [authStatus]);

  return (
    <ThemeProvider>
      <AppErrorBoundary>
        <ToastProvider>
          <QueryClientProvider client={queryClient}>
            <ThemedStack />
          </QueryClientProvider>
        </ToastProvider>
      </AppErrorBoundary>
    </ThemeProvider>
  );
}

function ThemedStack() {
  const { colors, mode } = useTheme();
  const reducedMotion = useReducedMotion();
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: reducedMotion ? 'none' : 'fade',
        }}
      />
    </>
  );
}
