/* سعرلي سوريا — Service Worker للإشعارات الهاتفية */
self.addEventListener("push", event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) {}

  const title = d.title || "سعرلي سوريا";
  const options = {
    body: d.body || "",
    icon: d.icon || "./saree-icon-192.png",
    badge: d.badge || "./saree-icon-192.png",
    image: d.image || undefined,
    dir: "rtl",
    lang: "ar",
    vibrate: [180, 90, 180],
    tag: d.tag || "saree-announcement",
    renotify: true,
    data: { url: d.url || "./" },
    actions: d.url ? [{ action: "open", title: "فتح الإعلان" }] : []
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification?.data?.url || "./";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(target);
          return c.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});
