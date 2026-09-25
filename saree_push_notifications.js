/* سعرلي سوريا — إشعارات الهاتف
   ملف بديل فقط — يحافظ على وظيفة الإشعارات الأصلية.
   ON / OFF يظهر للمدير فقط.
*/
(() => {
  "use strict";

  const SETTING_KEY = "push_notifications_enabled";

  function findSupabaseConfig() {
    const scripts = Array.from(document.scripts || []);
    for (const s of scripts) {
      const txt = s.textContent || "";
      if (!txt.includes("SUPABASE_URL") || !txt.includes("SUPABASE_KEY")) continue;
      const u = txt.match(/SUPABASE_URL\s*=\s*["']([^"']+)["']/);
      const k = txt.match(/SUPABASE_KEY\s*=\s*["']([^"']+)["']/);
      if (u && k) return { url: u[1], key: k[1] };
    }
    return null;
  }

  let clientPromise = null;
  async function getClient() {
    if (clientPromise) return clientPromise;
    clientPromise = (async () => {
      if (!window.supabase || typeof window.supabase.createClient !== "function") {
        throw new Error("مكتبة Supabase غير موجودة");
      }
      const cfg = findSupabaseConfig();
      if (!cfg) throw new Error("تعذر العثور على إعدادات Supabase في index.html");
      return window.supabase.createClient(cfg.url, cfg.key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    })();
    return clientPromise;
  }

  async function isAdmin() {
    try {
      const sb = await getClient();
      const { data: { user } = {} } = await sb.auth.getUser();
      if (!user) return false;

      // نفس معرّف المدير الموجود أصلًا في index.html، إن وُجد.
      const scripts = Array.from(document.scripts || []);
      for (const s of scripts) {
        const txt = s.textContent || "";
        const m = txt.match(/ADMIN_UID\s*=\s*["']([^"']+)["']/);
        if (m && m[1] === user.id) return true;
      }

      const { data } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
      return data?.role === "admin";
    } catch (e) {
      console.error("Saree admin check error:", e);
      return false;
    }
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

  async function addAdminToggle() {
    const panel = document.querySelector("#adminPanel");
    if (!panel || document.querySelector("#sareePushAdminToggle")) return;

    // لا يظهر المفتاح إلا للمدير.
    if (!(await isAdmin())) return;

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
      <div style="font-size:12px;opacity:.72;margin-top:7px">ON = السماح بإرسال الإشعارات للهاتف.</div>
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
  }

  function start() {
    addAdminToggle();
    setInterval(addAdminToggle, 1500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  window.sareePhoneNotifications = { readSetting, saveSetting };
})();
