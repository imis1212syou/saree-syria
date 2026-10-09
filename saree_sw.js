/* سعرلي سوريا — Service Worker
 * يحافظ على سلوك النسخة الأساسية قدر الإمكان.
 * الإصلاح: لا تُستخدم index.html بديلاً عن ملفات JS/CSS/JSON أو طلبات البيانات،
 * ولا تُخزَّن استجابات الخطأ أو الاستجابات ذات نوع المحتوى غير المناسب للأصول المعروفة.
 */
const CACHE = "saree-pwa-v5-safe-offline-20261009";
const CORE_ASSETS = [
  "./", "./index.html", "./ad-view.html", "./saree_manifest.json",
  "./ads.js", "./barcode_scanner.js", "./company_system.js",
  "./saree_all_features.js", "./saree_monthly_stats.js",
  "./saree_owner_contact_sponsors.js", "./saree_push_connector.js",
  "./saree_push_notifications.js", "./saree_push_sw.js", "./saree_pwa.js",
  "./store_admin_controls.js", "./store_features.js", "./saree_visual_theme.css",
  "./barcode.svg", "./basket.svg", "./brand.svg", "./camera.svg",
  "./categories.svg", "./company.svg", "./heart.svg", "./home.svg",
  "./megaphone.svg", "./store.svg", "./saree-icon-180.png",
  "./saree-icon-192.png", "./saree-icon-512.png"
];

function expectedContentType(request) {
  const url = new URL(request.url);
  const path = url.pathname.toLowerCase();
  const destination = request.destination || "";
  if (request.mode === "navigate" || destination === "document" || /\.html?$/.test(path) || path.endsWith("/")) return /text\/html/i;
  if (["script", "worker", "sharedworker", "serviceworker"].includes(destination) || /\.m?js$/.test(path)) return /(javascript|ecmascript)/i;
  if (destination === "style" || path.endsWith(".css")) return /text\/css/i;
  if (destination === "image" || /\.(svg|png|jpe?g|gif|webp|ico)$/.test(path)) return /image\//i;
  if (destination === "font" || /\.(woff2?|ttf|otf|eot)$/.test(path)) return /(font|woff|octet-stream)/i;
  if (destination === "manifest" || path.endsWith(".json")) return /(json|manifest\+json)/i;
  const accept = request.headers.get("accept") || "";
  if (/application\/json/i.test(accept) && !/text\/html/i.test(accept)) return /(json|\+json)/i;
  return null;
}

function responseHasExpectedType(response, request) {
  if (!response || !response.ok) return false;
  // Cross-origin/opaque resources cannot always expose Content-Type; preserve their normal behavior.
  if (new URL(request.url).origin !== self.location.origin || response.type === "opaque") return true;
  const expected = expectedContentType(request);
  const actual = response.headers.get("content-type") || "";
  // استجابة HTML لطلب بيانات/ملف غير HTML غالباً صفحة fallback من الاستضافة؛ لا تخزنها.
  if (!expected && request.destination === "" && request.mode !== "navigate" && /text\/html/i.test(actual)) return false;
  if (!expected) return true;
  return expected.test(actual);
}

async function currentCacheMatch(request) {
  const cache = await caches.open(CACHE);
  return cache.match(request);
}

async function cachedMainPage() {
  const cache = await caches.open(CACHE);
  return (await cache.match(new URL("./index.html", self.registration.scope).href)) ||
         (await cache.match(new URL("./", self.registration.scope).href));
}

function offlineNavigationResponse() {
  return new Response(
    '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>سعرلي سوريا</title><body style="font-family:Arial,sans-serif;padding:24px;line-height:1.8"><h2>لا يوجد اتصال بالإنترنت</h2><p>تعذر فتح الصفحة؛ اتصل بالإنترنت ثم أعد المحاولة. إذا سبق فتح الموقع على هذا الجهاز، أعد فتح الصفحة الرئيسية المحفوظة.</p></body></html>',
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // خزّن الملفات الأساسية منفردة؛ فشل ملف واحد لا يمنع تثبيت العامل أو بقية الملفات.
    await Promise.all(CORE_ASSETS.map(async asset => {
      try {
        const url = new URL(asset, self.registration.scope);
        const request = new Request(url.href, { cache: "reload" });
        const response = await fetch(request);
        if (responseHasExpectedType(response, request)) await cache.put(request, response.clone());
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    // احذف نسخ الكاش القديمة الخاصة بهذا التطبيق فقط، ولا تمسح كاشات تطبيقات أخرى على نفس النطاق.
    await Promise.all(names.filter(name => name.startsWith("saree-pwa-") && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  event.respondWith((async () => {
    let response;
    try {
      response = await fetch(request);
    } catch (error) {
      const cached = await currentCacheMatch(request).catch(() => null);
      if (cached) return cached;
      // الصفحة المخزنة بديل للملاحة فقط؛ ممنوع إرجاع HTML كاستجابة لملف أو طلب بيانات.
      if (request.mode === "navigate") return (await cachedMainPage().catch(() => null)) || offlineNavigationResponse();
      return Response.error();
    }

    // اترك أخطاء HTTP كما هي للتطبيق، لكن لا تحفظها في الكاش.
    if (!response.ok) return response;

    if (!responseHasExpectedType(response, request)) {
      // إذا أعاد الخادم HTML بدل JS/CSS/JSON مثلاً، لا تعرض/تخزن الاستجابة الخاطئة.
      const cached = await currentCacheMatch(request).catch(() => null);
      if (cached) return cached;
      if (request.mode === "navigate") return (await cachedMainPage().catch(() => null)) || offlineNavigationResponse();
      return Response.error();
    }

    // احتفظ باستراتيجية الشبكة أولاً للميزات الحالية، مع تخزين الاستجابات السليمة فقط.
    caches.open(CACHE).then(cache => cache.put(request, response.clone())).catch(() => {});
    return response;
  })());
});

/* سعرلي سوريا — Web Push */
self.addEventListener("push", event => {
  let data = {};
  try {
    if (event.data) {
      try { data = event.data.json() || {}; }
      catch (_) { data = { body: event.data.text() || "" }; }
    }
  } catch (_) {}

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
    const data = event.notification?.data || {};
    let adId = data.ad_id || data.adId || null;

    // إذا كانت نسخة الإرسال القديمة لم تحفظ ad_id، استخرجه من الرابط القديم
    // ثم استخدم صفحة الإعلان المحلية بدل فتح رابط GitHub قديم يسبب 404.
    if (!adId && data.url) {
      try {
        const oldUrl = new URL(data.url, scope.href);
        adId = oldUrl.searchParams.get("ad_id") || oldUrl.searchParams.get("adId");
      } catch (_) {}
    }

    const target = new URL("ad-view.html", scope.href);
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
