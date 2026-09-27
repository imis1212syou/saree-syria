/*
 * سعرلي سوريا — روابط صاحب الموقع + أفضل الداعمين
 * نسخة مستقلة:
 * - لا تستخدم ON CONFLICT نهائياً.
 * - تتعامل مع site_settings عبر البحث عن السجل ثم UPDATE/INSERT.
 * - واتساب/تلغرام يظهران تحت واجهة الموقع وقبل المنتجات.
 * - أفضل الداعمين يظهر مباشرة تحت روابط صاحب الموقع فقط عند وجود داعمين ظاهرين.
 * - لا يضيف أي عنصر فارغ إذا لم توجد روابط أو داعمون.
 */

(function () {
  "use strict";

  const OWNER_ID = "sareeOwnerContactPublic";
  const SUPPORTERS_ID = "sareeSupportersPublicNew";
  const SETTINGS_KEY = "site_contact_links";

  const $ = id => document.getElementById(id);

  function client() {
    return window.supabaseClient || window.supabase || null;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#039;"
    }[c]));
  }

  function isAdmin() {
    return String(window.profileData?.role || "").toLowerCase() === "admin";
  }

  function normalizeUrl(value, type) {
    let v = String(value || "").trim();
    if (!v) return "";

    if (type === "whatsapp" && /^[+]?[0-9][0-9\s().-]{6,}$/.test(v)) {
      return "https://wa.me/" + v.replace(/[^0-9]/g, "");
    }

    if (type === "telegram" && /^@[\w\d_]+$/.test(v)) {
      return "https://t.me/" + v.slice(1);
    }

    if (!/^https?:\/\//i.test(v)) v = "https://" + v;
    return v;
  }

  function safeUrl(value, type) {
    try {
      const u = new URL(normalizeUrl(value, type));
      if (u.protocol !== "https:") return "";
      if (type === "whatsapp" &&
          !/(^|\.)wa\.me$|(^|\.)whatsapp\.com$/i.test(u.hostname)) return "";
      if (type === "telegram" &&
          !/(^|\.)t\.me$|(^|\.)telegram\.me$|(^|\.)telegram\.org$/i.test(u.hostname)) return "";
      return u.href;
    } catch (_) {
      return "";
    }
  }

  function addStyles() {
    if ($("sareeOwnerSupportersStyles")) return;

    const style = document.createElement("style");
    style.id = "sareeOwnerSupportersStyles";
    style.textContent = `
      #${OWNER_ID}, #${SUPPORTERS_ID} {
        width: 100%;
        margin: 10px 0;
        box-sizing: border-box;
      }

      #${OWNER_ID} .saree-owner-contact-box,
      #${SUPPORTERS_ID} .saree-supporters-box {
        width: 100%;
        box-sizing: border-box;
        background: #12191d;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 14px;
        padding: 10px 12px;
      }

      #${OWNER_ID} .saree-owner-title {
        color: #fff !important;
        font-size: 15px;
        font-weight: 700;
        margin-bottom: 7px;
        text-align: right;
      }

      #${OWNER_ID} .saree-owner-buttons {
        display: flex;
        justify-content: flex-start;
        align-items: center;
        gap: 7px;
        flex-wrap: wrap;
      }

      #${OWNER_ID} .saree-owner-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 90px;
        padding: 7px 12px;
        border-radius: 9px;
        color: #fff !important;
        text-decoration: none !important;
        font-size: 13px;
        font-weight: 700;
        box-sizing: border-box;
      }

      #${OWNER_ID} .saree-whatsapp { background: #25D366; }
      #${OWNER_ID} .saree-telegram { background: #229ED9; }

      #${SUPPORTERS_ID} .saree-supporters-title {
        color: #fff !important;
        font-size: 16px;
        font-weight: 800;
        margin-bottom: 9px;
        text-align: right;
      }

      #${SUPPORTERS_ID} .saree-supporters-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 8px;
      }

      #${SUPPORTERS_ID} .saree-supporter-card {
        background: rgba(255,255,255,.035);
        border-radius: 10px;
        padding: 8px;
        text-align: center;
        box-sizing: border-box;
      }

      #${SUPPORTERS_ID} .saree-supporter-card img {
        width: 100%;
        max-height: 90px;
        object-fit: cover;
        border-radius: 8px;
        display: block;
        margin-bottom: 6px;
      }

      #${SUPPORTERS_ID} .saree-supporter-name {
        color: #fff !important;
        font-size: 13px;
        font-weight: 700;
      }

      #${SUPPORTERS_ID} .saree-supporter-description {
        color: #aeb8bd !important;
        font-size: 11px;
        margin-top: 3px;
        line-height: 1.4;
      }

      .saree-hidden { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  async function getSiteSettings() {
    const sb = client();
    if (!sb) return null;

    // لا يوجد onConflict هنا: نبحث بالمفتاح ثم نقرأ السجل نفسه.
    const { data, error } = await sb
      .from("site_settings")
      .select("id,key,whatsapp_url,telegram_url")
      .eq("key", SETTINGS_KEY)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("تعذر قراءة روابط الموقع:", error.message);
      return null;
    }
    return data || null;
  }

  async function renderOwnerContact() {
    const data = await getSiteSettings();
    const old = $(OWNER_ID);

    const whatsapp = safeUrl(data?.whatsapp_url, "whatsapp");
    const telegram = safeUrl(data?.telegram_url, "telegram");

    if (!whatsapp && !telegram) {
      old?.remove();
      return;
    }

    let box = old;
    if (!box) {
      box = document.createElement("section");
      box.id = OWNER_ID;
      insertBeforeProducts(box);
    }

    box.innerHTML = `
      <div class="saree-owner-contact-box" dir="rtl">
        <div class="saree-owner-title">📞 تواصل مع صاحب الموقع</div>
        <div class="saree-owner-buttons">
          ${whatsapp ? `<a class="saree-owner-btn saree-whatsapp"
            href="${esc(whatsapp)}" target="_blank" rel="noopener noreferrer">💬 واتساب</a>` : ""}
          ${telegram ? `<a class="saree-owner-btn saree-telegram"
            href="${esc(telegram)}" target="_blank" rel="noopener noreferrer">✈️ تلغرام</a>` : ""}
        </div>
      </div>
    `;
  }

  async function saveSiteLinksFixed() {
    if (!isAdmin()) {
      alert("هذا الخيار للمدير فقط.");
      return;
    }

    const sb = client();
    if (!sb) {
      alert("لم يتم تحميل Supabase.");
      return;
    }

    const whatsapp = $("siteWhatsapp")?.value.trim() || null;
    const telegram = $("siteTelegram")?.value.trim() || null;
    const msg = $("siteLinksMsg");

    try {
      const existing = await getSiteSettings();

      let result;
      if (existing?.id != null) {
        // تحديث السجل الموجود بواسطة id، بدون ON CONFLICT.
        result = await sb.from("site_settings")
          .update({
            whatsapp_url: whatsapp,
            telegram_url: telegram,
            updated_by: window.profileData?.id || null,
            updated_at: new Date().toISOString()
          })
          .eq("id", existing.id);
      } else {
        // إذا لم يوجد السجل، ننشئه بالمفتاح المعتمد في المشروع.
        result = await sb.from("site_settings").insert({
          key: SETTINGS_KEY,
          whatsapp_url: whatsapp,
          telegram_url: telegram,
          updated_by: window.profileData?.id || null,
          updated_at: new Date().toISOString()
        });
      }

      if (result.error) throw result.error;

      if (msg) msg.textContent = "تم حفظ روابط الموقع بنجاح.";
      await renderOwnerContact();
    } catch (error) {
      if (msg) msg.textContent = "تعذر حفظ الروابط: " + (error.message || error);
      console.error("حفظ روابط الموقع:", error);
    }
  }

  async function loadSiteLinksFixed() {
    if (!isAdmin()) return;
    const data = await getSiteSettings();
    if (!data) return;

    if ($("siteWhatsapp")) $("siteWhatsapp").value = data.whatsapp_url || "";
    if ($("siteTelegram")) $("siteTelegram").value = data.telegram_url || "";
  }

  async function renderSupporters() {
    const sb = client();
    if (!sb) return;

    const { data, error } = await sb
      .from("saree_supporters")
      .select("id,name,description,image_url,sort_order,visible")
      .eq("visible", true)
      .order("sort_order", { ascending: true })
      .limit(20);

    if (error) {
      console.warn("تعذر قراءة الداعمين:", error.message);
      $(SUPPORTERS_ID)?.remove();
      return;
    }

    // لا يوجد داعمون = لا يوجد قسم على الصفحة.
    if (!data?.length) {
      $(SUPPORTERS_ID)?.remove();
      return;
    }

    let box = $(SUPPORTERS_ID);
    if (!box) {
      box = document.createElement("section");
      box.id = SUPPORTERS_ID;
      insertAfterOwnerOrBeforeProducts(box);
    }

    box.innerHTML = `
      <div class="saree-supporters-box" dir="rtl">
        <div class="saree-supporters-title">⭐ أفضل الداعمين</div>
        <div class="saree-supporters-grid">
          ${data.map(item => `
            <div class="saree-supporter-card">
              ${item.image_url ? `<img src="${esc(item.image_url)}"
                alt="${esc(item.name || "داعم")}" loading="lazy">` : ""}
              <div class="saree-supporter-name">${esc(item.name || "داعم")}</div>
              ${item.description ? `<div class="saree-supporter-description">${esc(item.description)}</div>` : ""}
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  async function injectSupportersAdmin() {
    if (!isAdmin() || $("sareeSupportersAdminFixed")) return;

    const sb = client();
    const panel = $("adminPanel");
    if (!sb || !panel) return;

    const section = document.createElement("section");
    section.id = "sareeSupportersAdminFixed";
    section.className = "card";
    section.dir = "rtl";
    section.innerHTML = `
      <h2>⭐ إدارة أفضل الداعمين</h2>
      <div class="two">
        <input id="fixedSupporterName" placeholder="اسم الداعم">
        <input id="fixedSupporterDescription" placeholder="وصف مختصر">
        <input id="fixedSupporterImage" type="file" accept="image/*">
        <input id="fixedSupporterOrder" type="number" value="0" placeholder="الترتيب">
      </div>
      <button class="btn primary" id="fixedAddSupporter" type="button">إضافة الداعم</button>
      <div id="fixedSupportersList" style="margin-top:12px"></div>
    `;
    panel.appendChild(section);

    const load = async () => {
      const { data, error } = await sb.from("saree_supporters")
        .select("*").order("sort_order", { ascending: true });
      const list = $("fixedSupportersList");
      if (!list) return;
      if (error) {
        list.innerHTML = `<div class="muted">تعذر تحميل الداعمين: ${esc(error.message)}</div>`;
        return;
      }
      list.innerHTML = data?.length ? data.map(item => `
        <div class="priceRow" style="margin-bottom:8px">
          <b>${esc(item.name)}</b>
          ${item.visible ? `<span class="pill">ظاهر</span>` : `<span class="pill">مخفي</span>`}
          ${item.description ? `<div class="muted">${esc(item.description)}</div>` : ""}
          <button class="btn danger" type="button"
            onclick="window.sareeDeleteSupporterFixed('${esc(item.id)}')">حذف</button>
        </div>
      `).join("") : `<div class="muted">لا يوجد داعمون مضافون حالياً.</div>`;
    };

    $("fixedAddSupporter").onclick = async () => {
      const name = $("fixedSupporterName")?.value.trim();
      if (!name) return alert("اكتب اسم الداعم.");

      let image = null;
      const file = $("fixedSupporterImage")?.files?.[0];
      if (file && typeof window.uploadImage === "function") {
        try {
          image = await window.uploadImage(file, "supporters");
        } catch (error) {
          return alert("تعذر رفع صورة الداعم: " + error.message);
        }
      }

      const { error } = await sb.from("saree_supporters").insert({
        name,
        description: $("fixedSupporterDescription")?.value.trim() || null,
        image_url: image,
        sort_order: Number($("fixedSupporterOrder")?.value || 0),
        visible: true
      });

      if (error) return alert(error.message);

      $("fixedSupporterName").value = "";
      $("fixedSupporterDescription").value = "";
      $("fixedSupporterImage").value = "";
      $("fixedSupporterOrder").value = "0";

      await load();
      await renderSupporters();
    };

    await load();
  }

  window.sareeDeleteSupporterFixed = async function (id) {
    if (!isAdmin()) return alert("هذا الخيار للمدير فقط.");
    if (!confirm("هل تريد حذف هذا الداعم؟")) return;

    const sb = client();
    if (!sb) return;

    const { error } = await sb.from("saree_supporters").delete().eq("id", id);
    if (error) return alert(error.message);

    $(SUPPORTERS_ID)?.remove();
    await renderSupporters();

    const admin = $("sareeSupportersAdminFixed");
    if (admin) admin.remove();
    setTimeout(injectSupportersAdmin, 100);
  };

  function insertBeforeProducts(element) {
    const home = $("home");
    if (!home) return;

    const products = $("products");
    const heading = products?.previousElementSibling;

    // قبل عنوان "أفضل الأسعار حالياً" وبالتالي قبل المنتجات.
    if (heading && heading.tagName === "H2") {
      home.insertBefore(element, heading);
    } else if (products) {
      home.insertBefore(element, products);
    } else {
      home.appendChild(element);
    }
  }

  function insertAfterOwnerOrBeforeProducts(element) {
    const owner = $(OWNER_ID);
    if (owner?.parentNode) {
      owner.insertAdjacentElement("afterend", element);
      return;
    }
    insertBeforeProducts(element);
  }

  async function start() {
    addStyles();

    for (let i = 0; i < 40; i++) {
      if (client()) break;
      await new Promise(r => setTimeout(r, 250));
    }
    if (!client()) return;

    for (let i = 0; i < 40; i++) {
      if ($("home")) break;
      await new Promise(r => setTimeout(r, 250));
    }
    if (!$("home")) return;

    await renderOwnerContact();
    await renderSupporters();

    window.saveSiteLinks = saveSiteLinksFixed;
    window.loadSiteLinks = loadSiteLinksFixed;

    if (isAdmin()) {
      await loadSiteLinksFixed();
      setTimeout(injectSupportersAdmin, 700);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
