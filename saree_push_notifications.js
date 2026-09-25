/* سعرلي سوريا — إشعارات الهاتف
   التسجيل متاح لكل الزوار والمستخدمين والمديرين والتجار والشركات.
   عند السماح بالإشعارات يحاول تسجيل الجهاز تلقائيًا.
   لا يوجد ON/OFF للمدير في هذا الملف.
*/
(() => {
  "use strict";

  const SUPABASE_FUNCTION = "smart-action";
  let started = false;

  function findSupabaseConfig() {
    const scripts = Array.from(document.scripts || []);
    for (const s of scripts) {
      const txt = s.textContent || "";
      if (!txt.includes("SUPABASE_URL") || !txt.includes("SUPABASE_KEY")) continue;
      const u = txt.match(/SUPABASE_URL\s*=\s*["']([^"']+)["']/);
      const k = txt.match(/SUPABASE_KEY\s*=\s*["']([^"']+)["']/);
      if (u && k) return { url: u[1], key: k[1] };
    }
    if (window.SUPABASE_URL && window.SUPABASE_KEY) {
      return { url: window.SUPABASE_URL, key: window.SUPABASE_KEY };
    }
    return null;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  async function getVapidPublicKey(cfg) {
    const res = await fetch(
      `${cfg.url}/functions/v1/${SUPABASE_FUNCTION}?action=vapid-public-key`,
      {
        headers: {
          apikey: cfg.key
        }
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.vapid_public_key) {
      throw new Error(data.error || "تعذر الحصول على مفتاح الإشعارات");
    }
    return data.vapid_public_key;
  }

  async function registerCurrentDevice() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return { ok: false, skipped: true, reason: "unsupported" };
    }

    if (Notification.permission === "denied") {
      return { ok: false, skipped: true, reason: "denied" };
    }

    const cfg = findSupabaseConfig();
    if (!cfg) throw new Error("تعذر العثور على إعدادات Supabase");

    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

    if (permission !== "granted") {
      return { ok: false, skipped: true, reason: "not-granted" };
    }

    const registration = await navigator.serviceWorker.ready;
    const vapidPublicKey = await getVapidPublicKey(cfg);

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
    }

    const res = await fetch(
      `${cfg.url}/functions/v1/${SUPABASE_FUNCTION}?action=subscribe`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: cfg.key
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          user_agent: navigator.userAgent
        })
      }
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "تعذر تسجيل الجهاز");
    }

    return { ok: true, subscription };
  }

  async function startAutoRegistration() {
    if (started) return;
    started = true;

    try {
      const result = await registerCurrentDevice();
      if (result.ok) {
        console.log("Saree Push: تم تسجيل هذا الجهاز بنجاح.");
      }
    } catch (error) {
      console.warn("Saree Push:", error?.message || error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(startAutoRegistration, 800);
    });
  } else {
    setTimeout(startAutoRegistration, 800);
  }

  window.sareePhoneNotifications = {
    registerCurrentDevice,
    startAutoRegistration
  };
})();
