import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DEFAULT_ACTION_IDENTIFIER } from 'expo-notifications/build/NotificationsEmitter';
import { useLastNotificationResponse } from 'expo-notifications/build/useLastNotificationResponse';
import { AppErrorBoundary } from '@/src/components/layout/AppErrorBoundary';
import { ToastProvider } from '@/src/components/ui/Toast';
import { useReducedMotion } from '@/src/hooks/useReducedMotion';
import { clearQueryCache, setActiveQueryClient, setUnauthorizedHandler } from '@/src/services/api/client';
import { routeForNotification } from '@/src/navigation/notification-routes';
import { bindNotificationEvents, configureLocalNotifications } from '@/src/services/notifications/local';
import { cacheStore } from '@/src/services/storage/token-store';
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
  const role = useAuthStore((state) => state.user?.role);
  const router = useRouter();
  const lastNotificationResponse = useLastNotificationResponse();
  const handledNotificationId = useRef<string | null>(null);

  useEffect(() => {
    setActiveQueryClient(queryClient);
    setUnauthorizedHandler(async () => {
      clearQueryCache();
      await cacheStore.clearSessionData();
      useAuthStore.getState().reset();
    });
    void configureLocalNotifications().catch(() => undefined);
    void (async () => {
      await useAppStore.getState().hydrate();
      await bootstrap();
    })();
  }, [bootstrap, queryClient]);

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

  useEffect(() => {
    const response = lastNotificationResponse;
    if (
      authStatus !== 'authenticated' ||
      !response ||
      response.actionIdentifier !== DEFAULT_ACTION_IDENTIFIER ||
      handledNotificationId.current === response.notification.request.identifier
    ) {
      return;
    }
    const route = routeForNotification(
      { data: response.notification.request.content.data as Record<string, unknown> },
      role,
    );
    if (!route) return;
    handledNotificationId.current = response.notification.request.identifier;
    router.push(route);
  }, [authStatus, lastNotificationResponse, role, router]);

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
