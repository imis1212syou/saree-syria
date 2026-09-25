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
      url: data.url || self.registration.scope
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
    const rawUrl = event.notification?.data?.url;

    // الهدف الافتراضي هو نطاق التطبيق نفسه.
    let target = new URL("./", scope).href;

    try {
      if (rawUrl) {
        const requested = new URL(rawUrl, scope.href);

        // نسمح فقط بروابط داخل نفس نطاق التطبيق.
        // إذا أرسل الخادم رابط github.io الجذر أو رابطاً خارج نطاق التطبيق،
        // نعيده تلقائياً إلى صفحة التطبيق بدلاً من فتح 404.
        if (
          requested.origin === scope.origin &&
          requested.pathname.startsWith(scope.pathname)
        ) {
          target = requested.href;
        }
      }
    } catch (_) {
      target = scope.href;
    }

    const windows = await clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    // إذا كانت نسخة سعرلي سوريا مفتوحة بالفعل (ويب أو PWA)،
    // نستخدم نفس النافذة وننقلها للهدف ثم نركز عليها.
    for (const client of windows) {
      try {
        const current = new URL(client.url);

        if (
          current.origin === scope.origin &&
          current.pathname.startsWith(scope.pathname) &&
          "focus" in client
        ) {
          if ("navigate" in client && client.url !== target) {
            await client.navigate(target);
          }
          return client.focus();
        }
      } catch (_) {}
    }

    // نفس رابط التطبيق يخدم الحالتين:
    // PWA مثبتة => يفتح نسخة التطبيق عند دعم النظام لذلك.
    // غير مثبتة => يفتح نفس الصفحة في المتصفح.
    return clients.openWindow(target);
  })());
});
