/* سعرلي سوريا — إدارة إشعارات الجوال
   ON/OFF للمدير فقط.
   المستخدمون العاديون لا يظهر لهم أي مفتاح؛ إذا كانت صلاحية الإشعارات
   ممنوحة في جهازهم، يتم تسجيل اشتراك الجهاز تلقائيًا.
*/
(() => {
  "use strict";

  const SETTING_KEY = "push_notifications_enabled";
  const ADMIN_UID = "fb610b6d-8b2b-4d6d-a957-dda26f1be4a2";
  let clientPromise = null;
  let autoRegisterStarted = false;

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

  async function getClient() {
    if (clientPromise) return clientPromise;
    clientPromise = (async () => {
      if (window.supabaseClient?.auth) return window.supabaseClient;
      if (!window.supabase || typeof window.supabase.createClient !== "function") {
        throw new Error("مكتبة Supabase غير موجودة");
      }
      const cfg = findSupabaseConfig();
      if (!cfg) throw new Error("تعذر العثور على إعدادات Supabase");
      return window.supabase.createClient(cfg.url, cfg.key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    })();
    return clientPromise;
  }

  async function getCurrentUser() {
    const sb = await getClient();
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    return data?.user || null;
  }

  async function isAdmin() {
    const user = await getCurrentUser();
    return !!user && user.id === ADMIN_UID;
  }

  async function readSetting() {
    const sb = await getClient();
    const { data, error } = await sb
      .from("site_push_settings")
      .select("enabled,vapid_public_key")
      .eq("key", SETTING_KEY)
      .maybeSingle();
    if (error) throw error;
    window.sareeVapidPublicKey = data?.vapid_public_key || "";
    return data?.enabled === true;
  }

  async function saveSetting(value) {
    if (!(await isAdmin())) throw new Error("هذا الخيار متاح للمدير فقط");
    const sb = await getClient();
    const { error } = await sb
      .from("site_push_settings")
      .upsert({
        key: SETTING_KEY,
        enabled: !!value,
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });
    if (error) throw error;
  }

  function addAdminToggle() {
    const panel = document.querySelector("#adminPanel");
    if (!panel || document.querySelector("#sareePushAdminToggle")) return;

    isAdmin().then(admin => {
      if (!admin) return;
      if (!document.querySelector("#adminPanel") || document.querySelector("#sareePushAdminToggle")) return;

      const box = document.createElement("div");
      box.id = "sareePushAdminToggle";
      box.dir = "rtl";
      box.style.cssText =
        "margin:12px 0;padding:14px;border:1px solid #263640;border-radius:14px;background:#0c141a;color:#fff";

      box.innerHTML = `
        <div style="font-size:16px;font-weight:700;margin-bottom:9px">🔔 إشعارات الجوال</div>
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
          <input id="sareePushOnOff" type="checkbox" style="width:21px;height:21px">
          <b id="sareePushStatus">جارٍ التحميل...</b>
        </label>
        <div style="font-size:12px;opacity:.72;margin-top:7px">هذا المفتاح للمدير فقط: ON يسمح بإرسال إشعارات الإعلانات للمشتركين.</div>
      `;

      panel.appendChild(box);
      const toggle = box.querySelector("#sareePushOnOff");
      const status = box.querySelector("#sareePushStatus");

      readSetting().then(value => {
        toggle.checked = value;
        status.textContent = value ? "ON" : "OFF";
      }).catch(error => {
        toggle.checked = false;
        status.textContent = "OFF";
        console.error("Saree push read error:", error);
      });

      toggle.addEventListener("change", async () => {
        const wanted = toggle.checked;
        toggle.disabled = true;
        try {
          await saveSetting(wanted);
          status.textContent = wanted ? "ON" : "OFF";
        } catch (error) {
          toggle.checked = !wanted;
          status.textContent = toggle.checked ? "ON" : "OFF";
          console.error("Saree push setting error:", error);
          alert("تعذر حفظ إعداد الإشعارات. تأكد من صلاحيات جدول site_push_settings في Supabase.");
        } finally {
          toggle.disabled = false;
        }
      });
    }).catch(() => {});
  }

  async function autoRegisterDevice() {
    if (autoRegisterStarted) return;
    autoRegisterStarted = true;

    try {
      // المدير يتحكم بالمفتاح، لكن جهازه يمكن أن يكون مشتركًا أيضًا.
      // المستخدم العادي لا يرى أي ON/OFF.
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      if (!window.sareePushConnector?.subscribeToPush) return;
      await window.sareePushConnector.subscribeToPush();
      console.log("Saree Push: device subscription registered");
    } catch (error) {
      console.warn("Saree Push auto registration:", error);
    }
  }

  function start() {
    addAdminToggle();
    autoRegisterDevice();
    setInterval(() => {
      addAdminToggle();
      autoRegisterDevice();
    }, 2000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  window.sareePhoneNotifications = { readSetting, saveSetting, autoRegisterDevice };
})();
