/*
 * سعرلي سوريا — تواصل مع صاحب الموقع
 * Public display: WhatsApp + Telegram
 *
 * المتطلبات:
 * 1) وجود Supabase client باسم `supabase` في الصفحة.
 * 2) إضافة عنصر:
 *    <div id="siteOwnerContact"></div>
 * 3) تشغيل هذا الملف بعد تحميل Supabase.
 */

(function () {
  "use strict";

  const CONTAINER_ID = "siteOwnerContact";

  function getContainer() {
    return document.getElementById(CONTAINER_ID);
  }

  function normalizeUrl(value, type) {
    if (!value) return "";

    let url = String(value).trim();

    // إذا أدخل المدير رقم واتساب فقط
    if (type === "whatsapp" && /^[+]?\d[\d\s()-]{6,}$/.test(url)) {
      url = url.replace(/[^\d+]/g, "");
      return "https://wa.me/" + url.replace("+", "");
    }

    // إذا أدخل رابط بدون البروتوكول
    if (!/^https?:\/\//i.test(url)) {
      if (type === "telegram") {
        if (url.startsWith("@")) {
          return "https://t.me/" + url.substring(1);
        }
        return "https://" + url;
      }
      if (type === "whatsapp") {
        return "https://wa.me/" + url.replace(/[^\d]/g, "");
      }
    }

    return url;
  }

  function safeUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" ? parsed.href : "";
    } catch (_) {
      return "";
    }
  }

  function render(settings) {
    const container = getContainer();
    if (!container) return;

    const whatsapp = safeUrl(
      normalizeUrl(settings?.whatsapp_url, "whatsapp")
    );
    const telegram = safeUrl(
      normalizeUrl(settings?.telegram_url, "telegram")
    );

    if (!whatsapp && !telegram) {
      container.innerHTML = "";
      container.style.display = "none";
      return;
    }

    container.style.display = "";
    container.innerHTML = `
      <div class="site-owner-contact" dir="rtl">
        <div class="site-owner-contact-title">تواصل مع صاحب الموقع</div>
        <div class="site-owner-contact-buttons">
          ${
            whatsapp
              ? `<a class="site-owner-contact-btn whatsapp"
                    href="${whatsapp}"
                    target="_blank"
                    rel="noopener noreferrer">واتساب</a>`
              : ""
          }
          ${
            telegram
              ? `<a class="site-owner-contact-btn telegram"
                    href="${telegram}"
                    target="_blank"
                    rel="noopener noreferrer">تلغرام</a>`
              : ""
          }
        </div>
      </div>
    `;

    if (!document.getElementById("site-owner-contact-style")) {
      const style = document.createElement("style");
      style.id = "site-owner-contact-style";
      style.textContent = `
        .site-owner-contact {
          margin: 20px auto;
          padding: 16px;
          max-width: 520px;
          text-align: center;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 2px 12px rgba(0,0,0,.08);
        }
        .site-owner-contact-title {
          font-weight: 700;
          margin-bottom: 12px;
          font-size: 17px;
        }
        .site-owner-contact-buttons {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .site-owner-contact-btn {
          display: inline-block;
          padding: 10px 20px;
          border-radius: 10px;
          text-decoration: none;
          color: #fff !important;
          font-weight: 700;
        }
        .site-owner-contact-btn.whatsapp {
          background: #25D366;
        }
        .site-owner-contact-btn.telegram {
          background: #229ED9;
        }
      `;
      document.head.appendChild(style);
    }
  }

  async function loadSiteOwnerContact() {
    const container = getContainer();
    if (!container) return;

    try {
      if (typeof supabase === "undefined") {
        console.error("site_contact.js: Supabase client غير موجود.");
        return;
      }

      const { data, error } = await supabase
        .from("site_settings")
        .select("whatsapp_url, telegram_url")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        console.error("site_contact.js:", error);
        return;
      }

      render(data || {});
    } catch (error) {
      console.error("site_contact.js:", error);
    }
  }

  window.loadSiteOwnerContact = loadSiteOwnerContact;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadSiteOwnerContact);
  } else {
    loadSiteOwnerContact();
  }
})();
