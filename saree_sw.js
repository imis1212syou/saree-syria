const CACHE = "saree-pwa-v2";
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "./index.html"])).catch(()=>{}));
});
self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(c => c.put(event.request, copy)).catch(()=>{});
      return response;
    }).catch(() => caches.match(event.request).then(r => r || caches.match("./index.html")))
  );
});

/* سعرلي سوريا — Web Push */
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.title || "سعرلي سوريا";
  const options = {
    body: data.body || "يوجد إعلان جديد",
    icon: data.icon || "./saree-icon-192.png",
    badge: data.badge || "./saree-icon-192.png",
    image: data.image || undefined,
    dir: "rtl",
    lang: "ar",
    vibrate: [180, 90, 180],
    tag: data.tag || "saree-announcement",
    renotify: true,
    data: { url: data.url || "./" },
    actions: data.url ? [{ action: "open", title: "فتح الإعلان" }] : []
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
          if ("navigate" in c) c.navigate(target);
          return c.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});

