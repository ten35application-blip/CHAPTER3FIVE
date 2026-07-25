/* eslint-disable */
/**
 * chapter3five service worker — Web Push receiver only.
 *
 * Registered by the dashboard opt-in banner (see PushOptIn.tsx). Payload
 * arrives as JSON: { title, body, url, tag }. The click handler wakes
 * or opens a window at `url`.
 */

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch (_) {
    payload = { title: "chapter3five", body: event.data.text() };
  }
  const title = payload.title || "chapter3five";
  const body = payload.body || "";
  const url = payload.url || "/dashboard";
  const tag = payload.tag || "chapter3five";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: { url },
      badge: "/icon.png",
      icon: "/icon.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientsList) {
        // If a tab is already on this URL, focus it.
        if (client.url.endsWith(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })(),
  );
});
