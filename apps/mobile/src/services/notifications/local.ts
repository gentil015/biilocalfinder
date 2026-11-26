import { requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { connectSocket, getSocket } from '@/src/services/socket';

setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function configureLocalNotifications(): Promise<boolean> {
  const permission = await requestPermissionsAsync();
  return permission.granted;
}

export async function showLocalNotification(
  title: string,
  body?: string | null,
  data?: Record<string, unknown>,
): Promise<void> {
  await scheduleNotificationAsync({
    content: { title, body: body ?? undefined, data: data ?? undefined },
    trigger: null,
  });
}

export async function bindNotificationEvents(): Promise<() => void> {
  const socket = await connectSocket();
  if (!socket) return () => undefined;
  const handler = (notification: { title?: string; body?: string; data?: Record<string, unknown> }) => {
    void showLocalNotification(notification.title ?? 'New activity', notification.body, notification.data);
  };
  socket.on('notification:new', handler);
  return () => {
    getSocket()?.off('notification:new', handler);
  };
}
