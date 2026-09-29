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

    // لا نسمح لرابط الإرسال الخاطئ (مثل جذر github.io) أن يصبح
    // هدف الإشعار ويسبب 404.
    data: {
      url: data.url || self.registration.scope,
      ad_id: data.ad_id || data.adId || null
    },

    actions: data.url
      ? [{ action: "open", title: "فتح الإعلان" }]
      : []
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const scope = new URL(self.registration.scope);
    const adId = event.notification?.data?.ad_id;
    const target = new URL("./ad-view.html", scope.href);
    if (adId) target.searchParams.set("ad_id", adId);

    const windows = await clients.matchAll({type:"window", includeUncontrolled:true});
    for (const client of windows) {
      try {
        const current = new URL(client.url);
        if (current.origin === scope.origin && current.pathname.startsWith(scope.pathname) && "focus" in client) {
          if ("navigate" in client) await client.navigate(target.href);
          return client.focus();
        }
      } catch (_) {}
    }
    return clients.openWindow(target.href);
  })());
});
