const CACHE = "saree-pwa-v3";
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "./index.html", "./ad-view.html"])).catch(()=>{}));
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
    body: data.body || data.message || "يوجد إعلان جديد",
    icon: data.icon || "./saree-icon-192.png",
    badge: data.badge || "./saree-icon-192.png",
    image: data.image || undefined,
    dir: "rtl",
    lang: "ar",
    vibrate: [180, 90, 180],
    tag: data.tag || "saree-announcement",
    renotify: true,
    // نحفظ البيانات كاملة بما فيها ad_id إن أرسلها smart-action.
    data: {
      url: data.url || null,
      ad_id: data.ad_id || data.adId || null,
      type: data.type || data.notification_type || null
    },
    actions: [{ action: "open", title: "فتح الإعلان" }]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil((async () => {
    const scope = new URL(self.registration.scope);
    const info = event.notification?.data || {};
    const rawUrl = info.url;
    const adId = info.ad_id;
    let target;

    try {
      const requested = rawUrl ? new URL(rawUrl, scope.href) : null;
      const rootLike = !requested ||
        (requested.origin === scope.origin &&
         (requested.pathname === scope.pathname ||
          requested.pathname === scope.pathname.replace(/\/$/, '') ||
          requested.pathname === new URL('./', scope.href).pathname));

      // إعلان smart-action القديم قد يرسل جذر الموقع فقط. في هذه الحالة
      // نفتح واجهة الإعلان المنفصلة بدل الصفحة الرئيسية.
      if (adId || info.type === "ad" || rootLike) {
        target = new URL("./ad-view.html", scope.href);
        if (adId) target.searchParams.set("ad_id", String(adId));
      } else if (requested && requested.origin === scope.origin &&
                 requested.pathname.startsWith(scope.pathname)) {
        target = requested;
      } else {
        target = new URL("./", scope.href);
      }
    } catch (_) {
      target = new URL("./ad-view.html", scope.href);
      if (adId) target.searchParams.set("ad_id", String(adId));
    }

    const targetUrl = target.href;
    const windows = await clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    // إذا كان الموقع/التطبيق مفتوحاً، ننقل نفس النافذة إلى واجهة الإعلان.
    // لذلك زر «رجوع» يعيد المستخدم إلى الموقع الذي كان عليه.
    for (const client of windows) {
      try {
        const current = new URL(client.url);
        if (current.origin === scope.origin &&
            current.pathname.startsWith(scope.pathname) &&
            "focus" in client) {
          if ("navigate" in client && client.url !== targetUrl) {
            await client.navigate(targetUrl);
          }
          return client.focus();
        }
      } catch (_) {}
    }

    // عند عدم وجود نافذة مفتوحة، يفتح نفس المسار داخل نطاق الـPWA.
    // إن كانت النسخة المثبتة مدعومة من النظام، يبقى المسار ضمن نطاق التطبيق.
    return clients.openWindow(targetUrl);
  })());
});
