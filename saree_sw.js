/* سعرلي سوريا — Service Worker آمن للاتصال وغير الاتصال.
 * قاعدة عامة: لا يُعاد index.html مطلقاً كبديل لملف JavaScript أو CSS أو صورة أو بيانات.
 */
const CACHE = "saree-pwa-v6-global-safe-offline-20261009";
const CORE_ASSETS = [
  "./", "./index.html", "./ad-view.html", "./saree_manifest.json",
  "./ads.js", "./barcode_scanner.js", "./company_system.js",
  "./saree_all_features.js", "./saree_monthly_stats.js",
  "./saree_owner_contact_sponsors.js", "./saree_push_connector.js",
  "./saree_push_notifications.js", "./saree_pwa.js",
  "./store_admin_controls.js", "./store_features.js", "./saree_visual_theme.css",
  "./barcode.svg", "./basket.svg", "./brand.svg", "./camera.svg",
  "./categories.svg", "./company.svg", "./heart.svg", "./home.svg",
  "./megaphone.svg", "./store.svg", "./saree-icon-180.png",
  "./saree-icon-192.png", "./saree-icon-512.png"
];

function expectedContentType(url, destination) {
  const path = url.pathname.toLowerCase();
  const kind = destination || "";
  if (kind === "document" || /\.html?$/.test(path) || path.endsWith("/")) return /text\/html/i;
  if (["script", "worker", "sharedworker", "serviceworker"].includes(kind) || /\.m?js$/.test(path)) return /(javascript|ecmascript)/i;
  if (kind === "style" || path.endsWith(".css")) return /text\/css/i;
  if (kind === "image" || /\.(svg|png|jpe?g|gif|webp|ico)$/.test(path)) return /image\//i;
  if (kind === "font" || /\.(woff2?|ttf|otf|eot)$/.test(path)) return /(font|woff|octet-stream)/i;
  if (kind === "manifest" || path.endsWith(".json")) return /(json|manifest\+json)/i;
  return null;
}

function responseIsExpected(response, url, destination) {
  if (!response || !response.ok || response.type !== "basic") return false;
  const expected = expectedContentType(url, destination);
  if (!expected) return true;
  const contentType = response.headers.get("content-type") || "";
  return expected.test(contentType);
}

function offlineResponse(request) {
  const url = new URL(request.url);
  const path = url.pathname.toLowerCase();
  let mime = "text/plain; charset=utf-8";
  if (["script", "worker", "sharedworker", "serviceworker"].includes(request.destination) || /\.m?js$/.test(path)) mime = "application/javascript; charset=utf-8";
  else if (request.destination === "style" || path.endsWith(".css")) mime = "text/css; charset=utf-8";
  else if (request.destination === "manifest" || path.endsWith(".json")) mime = "application/json; charset=utf-8";
  else if (request.destination === "image" || path.endsWith(".svg")) mime = "image/svg+xml";
  else if (/\.png$/.test(path)) mime = "image/png";
  else if (/\.jpe?g$/.test(path)) mime = "image/jpeg";
  else if (/\.webp$/.test(path)) mime = "image/webp";
  // لا نرسل HTML أو نصاً تقنياً إلى عناصر السكربت/التنسيق/الصورة.
  if (["script", "worker", "sharedworker", "serviceworker", "style", "image", "font", "manifest"].includes(request.destination) || /\.(m?js|css|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|otf|eot|json)$/.test(path)) {
    return new Response("", {
      status: 503,
      headers: { "Content-Type": mime, "Cache-Control": "no-store" }
    });
  }
  if (request.mode === "navigate") {
    return new Response(
      '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>سعرلي سوريا</title><body style="font-family:Arial,sans-serif;padding:24px;line-height:1.8"><h2>لا يوجد اتصال بالإنترنت</h2><p>تعذر فتح الصفحة الآن. اتصل بالإنترنت ثم أعد المحاولة، أو افتح الصفحة الرئيسية إذا كانت محفوظة على الجهاز.</p></body></html>',
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
    );
  }
  return new Response("", {
    status: 503,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

async function cachedMatch(request) {
  const cache = await caches.open(CACHE);
  return (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }));
}

async function cachedIndex() {
  const cache = await caches.open(CACHE);
  return cache.match(new URL("./index.html", self.registration.scope).href);
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // كل ملف أساسي يُحفظ منفرداً؛ فشل ملف واحد لا يمنع تثبيت العامل كاملاً.
    await Promise.all(CORE_ASSETS.map(async asset => {
      try {
        const url = new URL(asset, self.registration.scope);
        const request = new Request(url.href, { cache: "reload" });
        const response = await fetch(request);
        if (responseIsExpected(response, url, "")) await cache.put(request, response.clone());
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith("saree-pwa-") && name !== CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // لا نعدّل طلبات الجهات الخارجية مثل Supabase أو CDN.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (responseIsExpected(response, url, "document")) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone()).catch(() => {});
          if (url.pathname.endsWith("/") || url.pathname.endsWith("/index.html")) {
            await cache.put(new URL("./index.html", self.registration.scope).href, response.clone()).catch(() => {});
          }
          return response;
        }
        const oldPage = await cachedMatch(request) || await cachedIndex();
        return oldPage || offlineResponse(request);
      } catch (_) {
        const oldPage = await cachedMatch(request) || await cachedIndex();
        return oldPage || offlineResponse(request);
      }
    })());
    return;
  }

  const isStatic = Boolean(expectedContentType(url, request.destination));
  if (isStatic) {
    event.respondWith((async () => {
      const previous = await cachedMatch(request);
      try {
        const response = await fetch(request);
        if (responseIsExpected(response, url, request.destination)) {
          const cache = await caches.open(CACHE);
          cache.put(request, response.clone()).catch(() => {});
          return response;
        }
        // استجابة 404 أو MIME غير صحيح لا تُخزّن؛ استخدم الملف السليم المحفوظ إن وجد.
        return previous || offlineResponse(request);
      } catch (_) {
        return previous || offlineResponse(request);
      }
    })());
    return;
  }

  // طلبات البيانات: لا fallback إلى index.html ولا تُعرض استجابات HTML مكان JSON.
  event.respondWith((async () => {
    try {
      return await fetch(request);
    } catch (_) {
      return offlineResponse(request);
    }
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
    data: { url: data.url || self.registration.scope, ad_id: data.ad_id || data.adId || null },
    actions: data.url ? [{ action: "open", title: "فتح الإعلان" }] : []
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const scope = new URL(self.registration.scope);
    const data = event.notification?.data || {};
    let adId = data.ad_id || data.adId || null;
    if (!adId && data.url) {
      try {
        const oldUrl = new URL(data.url, scope.href);
        adId = oldUrl.searchParams.get("ad_id") || oldUrl.searchParams.get("adId");
      } catch (_) {}
    }
    const target = new URL("ad-view.html", scope.href);
    if (adId) target.searchParams.set("ad_id", adId);
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
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
