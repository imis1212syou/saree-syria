/* سعرلي سوريا — Service Worker للإشعارات الهاتفية
 * ملاحظة: التشغيل الفعلي موحّد في saree_sw.js لأن الموقع والتطبيق
 * لا يمكن أن يستخدما عاملَي Service Worker متنافسين على نفس scope.
 * يبقى هذا الملف متوافقاً مع نفس سلوك الإشعار لمنع اختلاف النسخ.
 */
self.addEventListener("push", event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) {}

  const title = d.title || "سعرلي سوريا";
  const adId = d.ad_id || d.adId || null;
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
    data: { url: d.url || null, ad_id: adId },
    actions: (d.url || adId) ? [{ action: "open", title: "فتح الإعلان" }] : []
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil((async () => {
    const scope = new URL(self.registration.scope);
    const data = event.notification?.data || {};
    let adId = data.ad_id || data.adId || null;

    // دعم الإشعارات القديمة التي خزنت الرابط فقط.
    if (!adId && data.url) {
      try {
        const oldUrl = new URL(data.url, scope.href);
        adId = oldUrl.searchParams.get("ad_id") || oldUrl.searchParams.get("adId");
      } catch (_) {}
    }

    // لا نفتح data.url القديم؛ الهدف دائمًا هو صفحة الإعلان الموجودة داخل الموقع.
    const target = new URL("ad-view.html", scope.href);
    if (adId) target.searchParams.set("ad_id", adId);

    const list = await clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    for (const c of list) {
      if ("focus" in c) {
        try { await c.navigate(target.href); } catch (_) {}
        return c.focus();
      }
    }

    return clients.openWindow(target.href);
  })());
});
