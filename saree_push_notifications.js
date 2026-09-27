/* سعرلي سوريا — Web Push
   تسجيل الجهاز للإشعارات مع الحفاظ على smart-action الحالي.
   - إذا كانت الإشعارات مسموحة مسبقاً: التسجيل يتم تلقائياً.
   - إذا لم يسبق للمستخدم السماح: يظهر زر صغير لتفعيل الإشعارات لأن بعض المتصفحات
     لا تسمح بطلب الإذن إلا بعد ضغط المستخدم.
   - يعمل للزائر والمستخدم والتاجر والشركة والمدير، ولا يعتمد على تسجيل الدخول.
*/
(() => {
  "use strict";

  const SUPABASE_FUNCTION = "smart-action";
  const BANNER_ID = "sareePushPrompt";
  let started = false;

  function findSupabaseConfig() {
    if (window.SUPABASE_URL && (window.SUPABASE_KEY || window.SUPABASE_ANON_KEY)) {
      return {
        url: window.SUPABASE_URL,
        key: window.SUPABASE_KEY || window.SUPABASE_ANON_KEY
      };
    }

    for (const s of Array.from(document.scripts || [])) {
      const txt = s.textContent || "";
      if (!txt.includes("SUPABASE_URL")) continue;
      const u = txt.match(/SUPABASE_URL\s*=\s*["']([^"']+)["']/);
      const k = txt.match(/SUPABASE_(?:KEY|ANON_KEY)\s*=\s*["']([^"']+)["']/);
      if (u && k) return { url: u[1], key: k[1] };
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
      { headers: { apikey: cfg.key } }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.vapid_public_key) {
      throw new Error(data.error || "تعذر الحصول على مفتاح الإشعارات");
    }
    return data.vapid_public_key;
  }

  async function saveSubscription(cfg, subscription) {
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
    return data;
  }

  function isStandaloneApp() {
    return window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  function removePrompt() {
    document.getElementById(BANNER_ID)?.remove();
  }

  function showPrompt() {
    if (document.getElementById(BANNER_ID)) return;
    if (!document.body) return;
    if (Notification.permission === "denied") return;

    const box = document.createElement("div");
    box.id = BANNER_ID;
    box.dir = "rtl";
    box.style.cssText = [
      "position:fixed",
      "right:14px",
      "left:14px",
      "bottom:14px",
      "z-index:99999",
      "background:#101820",
      "color:#fff",
      "border:1px solid #33434d",
      "border-radius:14px",
      "padding:12px 14px",
      "box-shadow:0 8px 30px rgba(0,0,0,.35)",
      "display:flex",
      "gap:10px",
      "align-items:center",
      "justify-content:space-between",
      "font-family:inherit"
    ].join(";");

    box.innerHTML = `
      <div style="flex:1;line-height:1.5">
        <strong>🔔 إشعارات سعرلي سوريا</strong>
        <div style="font-size:13px;opacity:.82">فعّل الإشعارات ليصلك جديد الإعلانات على هذا الجهاز.</div>
      </div>
      <button id="sareePushEnableBtn" type="button" style="border:0;border-radius:10px;padding:9px 12px;cursor:pointer">تفعيل</button>
      <button id="sareePushCloseBtn" type="button" aria-label="إغلاق" style="border:0;background:transparent;color:#fff;font-size:20px;cursor:pointer">×</button>
    `;

    document.body.appendChild(box);
    document.getElementById("sareePushCloseBtn")?.addEventListener("click", removePrompt);
    document.getElementById("sareePushEnableBtn")?.addEventListener("click", async () => {
      const btn = document.getElementById("sareePushEnableBtn");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "جارٍ التفعيل…";
      }
      try {
        const result = await registerCurrentDevice(true);
        if (result.ok) removePrompt();
        else if (btn) {
          btn.disabled = false;
          btn.textContent = result.reason === "denied" ? "الإشعارات محظورة" : "إعادة المحاولة";
        }
      } catch (error) {
        console.warn("Saree Push:", error?.message || error);
        if (btn) {
          btn.disabled = false;
          btn.textContent = "إعادة المحاولة";
        }
      }
    });
  }

  async function registerCurrentDevice(requestPermission = false) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return { ok: false, skipped: true, reason: "unsupported" };
    }

    if (Notification.permission === "denied") {
      return { ok: false, skipped: true, reason: "denied" };
    }

    const cfg = findSupabaseConfig();
    if (!cfg) throw new Error("تعذر العثور على إعدادات Supabase");

    let permission = Notification.permission;
    if (permission !== "granted" && requestPermission) {
      permission = await Notification.requestPermission();
    }

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

    await saveSubscription(cfg, subscription);
    localStorage.setItem("saree_push_enabled", "1");
    return { ok: true, subscription };
  }

  async function startAutoRegistration() {
    if (started) return;
    started = true;

    try {
      const result = await registerCurrentDevice(false);
      if (result.ok) {
        removePrompt();
        console.log("Saree Push: تم تسجيل هذا الجهاز بنجاح.");
      } else if (result.reason === "not-granted") {
        showPrompt();
      }
    } catch (error) {
      console.warn("Saree Push:", error?.message || error);
      // لا نوقف الموقع إذا تعذر نظام الإشعارات.
    }
  }

  function boot() {
    // التطبيق المثبت أو الموقع العادي كلاهما يستخدمان نفس Service Worker.
    // لا نطلب الإذن تلقائياً؛ التسجيل التلقائي يحدث فقط بعد منح الإذن سابقاً.
    setTimeout(startAutoRegistration, 800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.sareePhoneNotifications = {
    registerCurrentDevice,
    startAutoRegistration,
    isStandaloneApp
  };
})();
