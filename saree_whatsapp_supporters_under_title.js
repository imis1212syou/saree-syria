// ============================================================
// سعرلي سوريا - واتساب صاحب الموقع + أفضل الداعمين
// ============================================================

(function () {
  "use strict";

  // ------------------------------------------------------------
  // CSS
  // ------------------------------------------------------------
  const style = document.createElement("style");

  style.textContent = `
    .saree-contact-supporters {
      width: min(1100px, 94%);
      margin: 25px auto;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .saree-contact-box,
    .saree-supporters-box {
      background: #ffffff;
      border-radius: 18px;
      padding: 20px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.08);
      border: 1px solid #eeeeee;
      direction: rtl;
      text-align: center;
    }

    .saree-contact-box h3,
    .saree-supporters-box h3 {
      margin: 0 0 10px;
      font-size: 21px;
    }

    .saree-contact-box p,
    .saree-supporters-box p {
      margin: 6px 0 15px;
      color: #666;
    }

    .saree-contact-buttons {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    .saree-contact-buttons a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 11px 20px;
      border-radius: 12px;
      color: white;
      text-decoration: none;
      font-weight: bold;
      transition: 0.2s;
    }

    .saree-contact-buttons a:hover {
      transform: translateY(-2px);
      opacity: 0.9;
    }

    .saree-whatsapp-btn {
      background: #25D366;
    }

    .saree-telegram-btn {
      background: #229ED9;
    }

    .saree-supporters-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 15px;
    }

    .saree-supporter-card {
      background: #f8f9fa;
      border-radius: 14px;
      padding: 14px;
      border: 1px solid #eee;
    }

    .saree-supporter-name {
      font-weight: bold;
      margin-bottom: 5px;
    }

    .saree-supporter-amount {
      font-weight: bold;
      margin-top: 5px;
    }

    .saree-no-supporters {
      color: #777;
      padding: 10px;
    }
  `;

  document.head.appendChild(style);


  // ------------------------------------------------------------
  // إنشاء القسم
  // ------------------------------------------------------------
  function createSections() {
    if (document.querySelector(".saree-contact-supporters")) {
      return;
    }

    const home = document.querySelector("#home");

    if (!home) {
      return;
    }

    const container = document.createElement("div");
    container.className = "saree-contact-supporters";

    container.innerHTML = `
      <!-- واتساب وتلغرام صاحب الموقع -->
      <section class="saree-contact-box">
        <h3>📞 تواصل مع صاحب الموقع</h3>

        <p>
          للاستفسارات، الاقتراحات أو الإبلاغ عن مشكلة
        </p>

        <div class="saree-contact-buttons">
          <a
            id="saree-whatsapp-link"
            class="saree-whatsapp-btn"
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            style="display:none;"
          >
            💬 واتساب صاحب الموقع
          </a>

          <a
            id="saree-telegram-link"
            class="saree-telegram-btn"
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            style="display:none;"
          >
            ✈️ تلغرام صاحب الموقع
          </a>
        </div>
      </section>


      <!-- أفضل الداعمين -->
      <section class="saree-supporters-box">
        <h3>🏆 أفضل الداعمين</h3>

        <p>
          شكراً لكل من ساهم في دعم وتطوير سعرلي سوريا ❤️
        </p>

        <div
          id="saree-supporters-list"
          class="saree-supporters-list"
        >
          <div class="saree-no-supporters">
            جاري تحميل قائمة الداعمين...
          </div>
        </div>
      </section>
    `;


    // ----------------------------------------------------------
    // وضع القسم تحت الـ Hero / عنوان الموقع
    // ----------------------------------------------------------
    const hero = home.querySelector(".hero");

    if (hero) {
      hero.insertAdjacentElement("afterend", container);
    } else {
      home.prepend(container);
    }


    loadContactLinks();
    loadSupporters();
  }


  // ------------------------------------------------------------
  // تحميل روابط واتساب وتلغرام
  // من جدول site_settings
  // key = site_contact_links
  // ------------------------------------------------------------
  async function loadContactLinks() {
    try {
      const supabase =
        window.supabaseClient ||
        window.supabase;

      if (!supabase) {
        console.warn("Supabase client غير موجود");
        return;
      }

      const { data, error } = await supabase
        .from("site_settings")
        .select("whatsapp_url, telegram_url")
        .eq("key", "site_contact_links")
        .maybeSingle();

      if (error) {
        console.error(
          "خطأ في تحميل روابط التواصل:",
          error
        );
        return;
      }

      if (!data) {
        return;
      }

      const whatsapp =
        document.getElementById(
          "saree-whatsapp-link"
        );

      const telegram =
        document.getElementById(
          "saree-telegram-link"
        );


      if (
        whatsapp &&
        data.whatsapp_url
      ) {
        whatsapp.href = data.whatsapp_url;
        whatsapp.style.display = "inline-flex";
      }


      if (
        telegram &&
        data.telegram_url
      ) {
        telegram.href = data.telegram_url;
        telegram.style.display = "inline-flex";
      }

    } catch (error) {
      console.error(
        "خطأ غير متوقع في روابط التواصل:",
        error
      );
    }
  }


  // ------------------------------------------------------------
  // تحميل أفضل الداعمين
  // من جدول saree_supporters
  // ------------------------------------------------------------
  async function loadSupporters() {
    try {
      const supabase =
        window.supabaseClient ||
        window.supabase;

      if (!supabase) {
        console.warn("Supabase client غير موجود");
        return;
      }

      const list =
        document.getElementById(
          "saree-supporters-list"
        );

      if (!list) {
        return;
      }


      const { data, error } = await supabase
        .from("saree_supporters")
        .select("*")
        .order("amount", {
          ascending: false
        });


      if (error) {
        console.error(
          "خطأ في تحميل أفضل الداعمين:",
          error
        );

        list.innerHTML = `
          <div class="saree-no-supporters">
            لا يمكن تحميل قائمة الداعمين حالياً
          </div>
        `;

        return;
      }


      if (!data || data.length === 0) {
        list.innerHTML = `
          <div class="saree-no-supporters">
            لا يوجد داعمون مضافون حالياً
          </div>
        `;

        return;
      }


      list.innerHTML = data
        .map((supporter, index) => {

          const name =
            supporter.name ||
            supporter.supporter_name ||
            "داعم";

          const amount =
            supporter.amount ??
            supporter.support_amount ??
            "";

          return `
            <div class="saree-supporter-card">

              <div class="saree-supporter-name">
                ${index + 1}. ${escapeHtml(name)}
              </div>

              ${
                amount !== ""
                  ? `
                    <div class="saree-supporter-amount">
                      ❤️ ${escapeHtml(String(amount))}
                    </div>
                  `
                  : ""
              }

            </div>
          `;
        })
        .join("");

    } catch (error) {
      console.error(
        "خطأ غير متوقع في أفضل الداعمين:",
        error
      );
    }
  }


  // ------------------------------------------------------------
  // حماية النصوص
  // ------------------------------------------------------------
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  // ------------------------------------------------------------
  // تشغيل بعد تحميل الصفحة
  // ------------------------------------------------------------
  function start() {
    createSections();
  }


  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      start
    );
  } else {
    start();
  }

})();
