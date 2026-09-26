/*
 * سعرلي سوريا
 * واتساب صاحب الموقع + أفضل الداعمين
 *
 * النسخة المصححة:
 * - روابط الموقع تستخدم site_settings.id = 1
 * - لا تستخدم عمود key
 * - أفضل الداعمين لا يظهرون إذا لم يوجد أي داعم
 * - واتساب/تلغرام بحجم صغير
 * - يظهر القسم مباشرة تحت عنوان الموقع
 */

(function () {
  "use strict";

  const CONTACT_ID = "sareeOwnerContactPublic";
  const SUPPORTERS_ID = "sareeSupportersPublicNew";

  const $ = id => document.getElementById(id);

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[c]));
  }

  function isAdmin() {
    return String(window.profileData?.role || "").toLowerCase() === "admin";
  }

  /* =========================================================
     التنسيق
     ========================================================= */

  function addStyles() {
    if ($("sareeOwnerSupportersStyles")) return;

    const style = document.createElement("style");
    style.id = "sareeOwnerSupportersStyles";

    style.textContent = `
      /* صندوق التواصل */
      #${CONTACT_ID} {
        width: 100%;
        margin: 10px 0;
        box-sizing: border-box;
      }

      #${CONTACT_ID} .saree-owner-contact-box {
        background: #12191d;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 14px;
        padding: 10px 12px;
        box-sizing: border-box;
      }

      #${CONTACT_ID} .saree-owner-title {
        color: #ffffff !important;
        font-size: 15px;
        font-weight: 700;
        margin-bottom: 7px;
        text-align: right;
      }

      #${CONTACT_ID} .saree-owner-buttons {
        display: flex;
        justify-content: flex-start;
        align-items: center;
        gap: 7px;
        flex-wrap: wrap;
      }

      #${CONTACT_ID} .saree-owner-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: auto;
        min-width: 90px;
        padding: 7px 12px;
        border-radius: 9px;
        color: #ffffff !important;
        text-decoration: none !important;
        font-size: 13px;
        font-weight: 700;
        box-sizing: border-box;
      }

      #${CONTACT_ID} .saree-whatsapp {
        background: #25D366;
      }

      #${CONTACT_ID} .saree-telegram {
        background: #229ED9;
      }

      /* أفضل الداعمين */
      #${SUPPORTERS_ID} {
        width: 100%;
        margin: 10px 0;
        box-sizing: border-box;
      }

      #${SUPPORTERS_ID} .saree-supporters-box {
        background: #12191d;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 16px;
        padding: 14px;
        box-sizing: border-box;
      }

      #${SUPPORTERS_ID} .saree-supporters-title {
        color: #ffffff !important;
        font-size: 18px;
        font-weight: 800;
        margin-bottom: 10px;
        text-align: right;
      }

      #${SUPPORTERS_ID} .saree-supporters-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
        gap: 10px;
      }

      #${SUPPORTERS_ID} .saree-supporter-card {
        background: rgba(255,255,255,.035);
        border-radius: 12px;
        padding: 10px;
        text-align: center;
        box-sizing: border-box;
      }

      #${SUPPORTERS_ID} .saree-supporter-card img {
        width: 100%;
        max-height: 100px;
        object-fit: cover;
        border-radius: 9px;
        display: block;
        margin-bottom: 7px;
      }

      #${SUPPORTERS_ID} .saree-supporter-name {
        color: #ffffff !important;
        font-size: 14px;
        font-weight: 700;
      }

      #${SUPPORTERS_ID} .saree-supporter-description {
        color: #aeb8bd !important;
        font-size: 12px;
        margin-top: 4px;
        line-height: 1.5;
      }

      /* إخفاء كامل */
      .saree-hidden {
        display: none !important;
      }
    `;

    document.head.appendChild(style);
  }


  /* =========================================================
     روابط الموقع
     IMPORTANT:
     نستخدم id = 1 بدلاً من key
     ========================================================= */

  function normalizeUrl(value, type) {
    let v = String(value || "").trim();

    if (!v) return "";

    if (
      type === "whatsapp" &&
      /^[+]?[0-9][0-9\\s().-]{6,}$/.test(v)
    ) {
      v = v
        .replace(/[^0-9+]/g, "")
        .replace(/^\+/, "");

      return "https://wa.me/" + v;
    }

    if (!/^https?:\/\//i.test(v)) {
      if (type === "telegram" && v.startsWith("@")) {
        return "https://t.me/" + v.slice(1);
      }

      return "https://" + v;
    }

    return v;
  }


  function safeUrl(value, type) {
    try {
      const url = new URL(normalizeUrl(value, type));

      if (url.protocol !== "https:") {
        return "";
      }

      return url.href;
    } catch (_) {
      return "";
    }
  }


  async function getSiteLinks() {
    if (!window.supabaseClient) {
      return null;
    }

    const { data, error } = await window.supabaseClient
      .from("site_settings")
      .select("id,whatsapp_url,telegram_url")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.warn(
        "روابط الموقع:",
        error.message
      );

      return null;
    }

    return data || null;
  }


  async function renderOwnerContact() {
    const data = await getSiteLinks();

    if (!data) {
      removeOwnerContact();
      return;
    }

    const whatsapp = safeUrl(
      data.whatsapp_url,
      "whatsapp"
    );

    const telegram = safeUrl(
      data.telegram_url,
      "telegram"
    );

    /* إذا لا يوجد واتساب ولا تلغرام لا يظهر أي شيء */
    if (!whatsapp && !telegram) {
      removeOwnerContact();
      return;
    }

    let box = $(CONTACT_ID);

    if (!box) {
      box = document.createElement("section");
      box.id = CONTACT_ID;

      insertUnderHero(box);
    }

    box.classList.remove("saree-hidden");

    box.innerHTML = `
      <div class="saree-owner-contact-box" dir="rtl">

        <div class="saree-owner-title">
          📞 تواصل مع صاحب الموقع
        </div>

        <div class="saree-owner-buttons">

          ${
            whatsapp
              ? `
                <a
                  class="saree-owner-btn saree-whatsapp"
                  href="${esc(whatsapp)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  💬 واتساب
                </a>
              `
              : ""
          }

          ${
            telegram
              ? `
                <a
                  class="saree-owner-btn saree-telegram"
                  href="${esc(telegram)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ✈️ تلغرام
                </a>
              `
              : ""
          }

        </div>

      </div>
    `;
  }


  function removeOwnerContact() {
    const box = $(CONTACT_ID);

    if (box) {
      box.remove();
    }
  }


  /* =========================================================
     حفظ روابط الموقع من لوحة المدير
     يصلح الخطأ الموجود في index.html
     ========================================================= */

  async function saveSiteLinksFixed() {
  if (!isAdmin()) {
    alert("هذا الخيار للمدير فقط.");
    return;
  }

  const whatsapp = $("siteWhatsapp")?.value.trim() || null;
  const telegram = $("siteTelegram")?.value.trim() || null;

  const payload = {
    key: "site_contact_links",
    whatsapp_url: whatsapp,
    telegram_url: telegram,
    updated_by: profileData?.id || null,
    updated_at: new Date().toISOString()
  };

  try {
    const { data, error } = await window.supabaseClient
      .from("site_settings")
      .update(payload)
      .eq("id", 1)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      const { error: insertError } = await window.supabaseClient
        .from("site_settings")
        .insert({ ...payload, id: 1 });

      if (insertError) throw insertError;
    }

    const msg = $("siteLinksMsg");
    if (msg) msg.textContent = "تم حفظ روابط الموقع بنجاح ✅";
  } catch (error) {
    console.error("خطأ حفظ روابط الموقع:", error);
    const msg = $("siteLinksMsg");
    if (msg) msg.textContent = "تعذر حفظ الروابط: " + error.message;
  }
}

saveSiteLinks = saveSiteLinksFixed;

    window.loadSiteLinks =
      loadSiteLinksFixed;

    /*
     * المدير
     */
    if (isAdmin()) {

      await loadSiteLinksFixed();

      setTimeout(
        injectSupportersAdmin,
        500
      );
    }
  }


  if (
    document.readyState === "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      start
    );

  } else {

    start();
  }

})();
