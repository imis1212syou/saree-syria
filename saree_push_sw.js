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
    data: { url: d.url || null },
    actions: d.url ? [{ action: "open", title: "فتح الإعلان" }] : []
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil((async () => {
    const scope = self.registration.scope;
    const rawUrl = event.notification?.data?.url;
    let target = scope;

    try {
      if (rawUrl) {
        const u = new URL(rawUrl, scope);
        const scopeUrl = new URL(scope);

        if (u.origin === scopeUrl.origin &&
            (u.pathname === "/" || u.pathname === "")) {
          target = scope;
        } else {
          target = u.href;
        }
      }
    } catch (_) {
      target = scope;
    }

    const list = await clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    for (const c of list) {
      if ("focus" in c) {
        try { await c.navigate(target); } catch (_) {}
        return c.focus();
      }
    }

    return clients.openWindow(target);
  })());
});
