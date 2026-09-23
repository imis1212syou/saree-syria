/* سعرلي سوريا — نظام إشعارات الهاتف الجديد
   ملف مستقل: لا يستبدل أي ملف قديم.
   يعرض مفتاح ON/OFF داخل لوحة الإدارة، ويسجل اشتراك جميع الفئات.
*/
(() => {
  "use strict";

  const SETTING = "push_notifications_enabled";
  const SW_URL = "./saree_push_sw.js";

  function getSB() {
    if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return null;
    try {
      window.__sareePushSB ||= window.supabase.createClient(
        window.SUPABASE_URL, window.SUPABASE_ANON_KEY
      );
      return window.__sareePushSB;
    } catch (_) { return null; }
  }

  async function enabled() {
    const sb = getSB();
    if (!sb) return false;
    const { data } = await sb.from("site_push_settings")
      .select("enabled,vapid_public_key")
      .eq("key", SETTING).maybeSingle();
    window.sareeVapidPublicKey = data?.vapid_public_key || "";
    return data?.enabled === true;
  }

  async function addSubscription() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) ||
        !("Notification" in window)) return;

    if (!(await enabled())) return;

    const permission = Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;

    if (permission !== "granted" || !window.sareeVapidPublicKey) return;

    const reg = await navigator.serviceWorker.register(SW_URL);
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      const b64 = window.sareeVapidPublicKey;
      const pad = "=".repeat((4 - b64.length % 4) % 4);
      const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
      const key = Uint8Array.from([...raw], c => c.charCodeAt(0));
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key
      });
    }

    const sb = getSB();
    if (!sb) return;

    await sb.from("push_subscriptions").upsert({
      endpoint: sub.endpoint,
      subscription: sub.toJSON(),
      user_id: window.currentUser?.id || window.currentProfile?.id || null,
      role: window.currentUser?.role || "visitor",
      updated_at: new Date().toISOString()
    }, { onConflict: "endpoint" });
  }

  function adminControl() {
    const panel = document.querySelector("#adminPanel");
    if (!panel || document.querySelector("#sareePushAdminToggle")) return;

    const box = document.createElement("div");
    box.id = "sareePushAdminToggle";
    box.dir = "rtl";
    box.style.cssText =
      "margin:12px 0;padding:14px;border:1px solid #263640;border-radius:14px;background:#0c141a;color:#fff";

    box.innerHTML = `
      <div style="font-size:16px;font-weight:700;margin-bottom:9px">🔔 إشعارات الجوال</div>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
        <input id="sareePushOnOff" type="checkbox" style="width:21px;height:21px">
        <b id="sareePushStatus">OFF</b>
      </label>
      <div style="font-size:12px;opacity:.72;margin-top:7px">
        ON = إرسال الإعلانات كإشعارات للهاتف لجميع الفئات التي وافقت على الإشعارات.
      </div>
    `;
    panel.appendChild(box);

    const input = box.querySelector("#sareePushOnOff");
    const status = box.querySelector("#sareePushStatus");

    enabled().then(v => {
      input.checked = v;
      status.textContent = v ? "ON" : "OFF";
    });

    input.onchange = async () => {
      input.disabled = true;
      const sb = getSB();
      try {
        if (!sb) throw new Error();
        const { error } = await sb.from("site_push_settings").upsert({
          key: SETTING,
          enabled: input.checked,
          updated_at: new Date().toISOString()
        }, { onConflict: "key" });
        if (error) throw error;
        status.textContent = input.checked ? "ON" : "OFF";
      } catch (_) {
        input.checked = !input.checked;
        status.textContent = input.checked ? "ON" : "OFF";
        alert("تعذر حفظ إعداد الإشعارات.");
      } finally {
        input.disabled = false;
      }
    };
  }

  function boot() {
    adminControl();
    // جميع الفئات تستخدم نفس التسجيل؛ لا يوجد فلتر دور.
    addSubscription().catch(() => {});
    setInterval(adminControl, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else boot();

  window.sareePhoneNotifications = { enabled, addSubscription };
})();
