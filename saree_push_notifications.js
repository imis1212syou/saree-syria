/* سعرلي سوريا — إشعارات الهاتف
   نسخة متوافقة مع اتصال Supabase الموجود أصلًا في المشروع.
   ملف جديد مستقل.
*/
(() => {
  "use strict";

  const SETTING_KEY = "push_notifications_enabled";
  const SW_FILE = "saree_push_sw.js";

  function getSupabaseClient() {
    // يستخدم عميل المشروع الموجود مسبقًا بدل إنشاء اتصال جديد.
    if (window.supabaseClient) return window.supabaseClient;
    return null;
  }

  async function readSetting() {
    const sb = getSupabaseClient();
    if (!sb) throw new Error("supabaseClient غير موجود");

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
    const sb = getSupabaseClient();
    if (!sb) throw new Error("supabaseClient غير موجود");

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

    const box = document.createElement("div");
    box.id = "sareePushAdminToggle";
    box.dir = "rtl";
    box.style.cssText =
      "margin:12px 0;padding:14px;border:1px solid #263640;border-radius:14px;background:#0c141a;color:#fff";

    box.innerHTML = `
      <div style="font-size:16px;font-weight:700;margin-bottom:9px">
        🔔 إشعارات الجوال
      </div>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
        <input id="sareePushOnOff" type="checkbox" style="width:21px;height:21px">
        <b id="sareePushStatus">جارٍ التحميل...</b>
      </label>
      <div style="font-size:12px;opacity:.72;margin-top:7px">
        ON = السماح بإرسال إعلانات كإشعارات للهاتف.
      </div>
    `;

    panel.appendChild(box);

    const toggle = box.querySelector("#sareePushOnOff");
    const status = box.querySelector("#sareePushStatus");

    readSetting().then(value => {
      toggle.checked = value;
      status.textContent = value ? "ON" : "OFF";
    }).catch(() => {
      toggle.checked = false;
      status.textContent = "OFF";
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
        alert("تعذر حفظ إعداد الإشعارات. تأكد من تنفيذ SQL ومن صلاحيات Supabase.");
      } finally {
        toggle.disabled = false;
      }
    });
  }

  function start() {
    addAdminToggle();
    setInterval(addAdminToggle, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  window.sareePhoneNotifications = {
    readSetting,
    saveSetting
  };
})();
