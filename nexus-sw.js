/* Nexus Web Push service worker. Keep at the site root so its scope covers /nexuschat/. */
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() || 'Tienes un mensaje nuevo.' }; }
  const title = String(payload.title || 'Nexus').slice(0, 100);
  const body = String(payload.body || 'Tienes un mensaje nuevo.').slice(0, 180);
  const target = new URL(payload.url || './', self.registration.scope);
  if (target.origin !== self.location.origin) target.href = self.registration.scope;
  event.waitUntil((async () => {
    const openClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (openClients.some(client => client.visibilityState === 'visible')) return;
    await self.registration.showNotification(title, {
    body,
    icon: new URL('./nexus-icon.svg', self.registration.scope).href,
    badge: new URL('./nexus-icon.svg', self.registration.scope).href,
    tag: String(payload.tag || 'nexus-message'),
    renotify: false,
    data: { url: target.href },
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || self.registration.scope;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(target);
        return client.focus();
      }
    }
    return clients.openWindow(target);
  })());
});
