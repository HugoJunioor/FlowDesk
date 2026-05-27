// Service Worker do FlowDesk — recebe Web Push e exibe notificação.
//
// Escopo: /
// Eventos:
//   - 'push' — payload JSON com { title, body, url, tag }
//   - 'notificationclick' — foca/abre aba e navega pra url

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'FlowDesk', body: '', url: '/', tag: undefined };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: data.tag,
      data: { url: data.url },
      requireInteraction: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Se ja tem uma aba FlowDesk aberta, foca e navega
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client && typeof client.navigate === 'function') {
            try { await client.navigate(url); } catch { /* cross-origin */ }
          }
          return;
        }
      }
      // Senao, abre nova aba
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
