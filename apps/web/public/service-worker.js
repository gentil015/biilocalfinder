// Minimal Web Push service worker — shows an OS notification for whatever
// NotificationsProcessor sent (see apps/api/src/notifications/channels/push-sender.ts).
// Registered by components/push-subscribe-button.tsx.

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: event.data.text() };
  }
  const title = payload.title || 'BII LocalFinder';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body,
      icon: '/icon.png',
      data: payload.data || {},
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/'));
});
