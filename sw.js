// Service worker: makes the app installable and shows push notifications while the app is closed.
// It never caches pages, so the app is always fresh.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
  event.waitUntil((async () => {
    // if the app is open and on screen it already shows its own toast — don't double up
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (wins.some((w) => w.visibilityState === "visible" && w.focused)) return;
    await self.registration.showNotification(d.title || "Digital Team Tasks Tracker", {
      body: d.body || "",
      icon: "assets/icon-192.png",
      badge: "assets/favicon-64.png",
      tag: d.tag || undefined,
      renotify: !!d.tag,
      dir: "auto",
      data: { url: d.url || "/" },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) {
        await w.focus();
        try { await w.navigate(target); } catch { w.postMessage({ type: "open", url: target }); }
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
