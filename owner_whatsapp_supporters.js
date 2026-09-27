/*
 * سعرلي سوريا — واتساب صاحب الموقع + أفضل الداعمين
 * ملف مستقل واحد.
 *
 * المتطلبات من المشروع الأساسي:
 * 1) وجود window.supabaseClient بعد تحميل Supabase.
 * 2) وجود #products و #adminPanel في الصفحة الرئيسية.
 * 3) إضافة العمود:
 *    ALTER TABLE public.site_settings
 *    ADD COLUMN IF NOT EXISTS owner_supporters_data JSONB;
 *
 * تخزين البيانات في site_settings.owner_supporters_data:
 * {
 *   "whatsapp": "9639XXXXXXXX أو https://wa.me/9639XXXXXXXX",
 *   "supporters": [
 *      {"name":"اسم الداعم","image_url":"https://..."},
 *      {"name":"اسم الداعم الثاني","image_url":"https://..."}
 *   ]
 * }
 *
 * الاستدعاء في الملف الأساسي:
 * <script src="owner_whatsapp_supporters.js"></script>
 * ضعه بعد تحميل Supabase وبعد ملفات الصفحة الأساسية.
 */
(function () {
  'use strict';

  const IDS = {
    root: 'ownerWhatsappSupportersRoot',
    admin: 'ownerWhatsappSupportersAdmin',
    styles: 'ownerWhatsappSupportersStyles'
  };

  const state = {
    whatsapp: '',
    supporters: []
  };

  const $ = (id) => document.getElementById(id);

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  function normalizeWhatsapp(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    if (/^https:\/\/wa\.me\//i.test(raw)) return raw;
    if (/^http:\/\/wa\.me\//i.test(raw)) return raw.replace(/^http:/i, 'https:');
    if (/^wa\.me\//i.test(raw)) return 'https://' + raw;

    // قبول روابط api.whatsapp.com/send?phone=...
    if (/^https?:\/\/(api\.)?whatsapp\.com\//i.test(raw)) return raw;

    // رقم فقط: يحذف + والمسافات والشرطات والأقواس.
    const digits = raw.replace(/\D/g, '');
    return digits ? 'https://wa.me/' + digits : '';
  }

  function normalizeData(data) {
    const source = data && typeof data === 'object' ? data : {};
    const supporters = Array.isArray(source.supporters)
      ? source.supporters.slice(0, 2).map(function (item) {
          return {
            name: String(item && item.name || '').trim(),
            image_url: String(item && (item.image_url || item.image) || '').trim()
          };
        }).filter(function (item) {
          return item.name || item.image_url;
        })
      : [];

    return {
      whatsapp: String(source.whatsapp || source.whatsapp_url || '').trim(),
      supporters: supporters
    };
  }

  async function loadData() {
    if (!window.supabaseClient) {
      console.warn('[owner_whatsapp_supporters] supabaseClient غير موجود.');
      return;
    }

    try {
      const result = await window.supabaseClient
        .from('site_settings')
        .select('owner_supporters_data')
        .limit(1)
        .maybeSingle();

      if (result.error) throw result.error;
      Object.assign(state, normalizeData(result.data && result.data.owner_supporters_data));
    } catch (error) {
      console.warn('[owner_whatsapp_supporters] تعذر قراءة الإعدادات:', error);
    }
  }

  function renderStyles() {
    if ($(IDS.styles)) return;

    const style = document.createElement('style');
    style.id = IDS.styles;
    style.textContent = `
      .ows-card{
        position:relative;
        overflow:hidden;
        margin:0 0 16px;
        padding:14px;
        border-radius:18px;
        border:1px solid rgba(37,211,102,.32);
        background:linear-gradient(145deg,#101a18,#12191d 58%,#0d1513);
        box-shadow:0 10px 30px rgba(0,0,0,.16);
      }
      .ows-card::before{
        content:"";
        position:absolute;
        top:-20%;
        left:-45%;
        width:38%;
        height:140%;
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.16),transparent);
        transform:skewX(-18deg);
        animation:owsShine 5s ease-in-out infinite;
        pointer-events:none;
      }
      @keyframes owsShine{
        0%,55%{left:-45%}
        82%,100%{left:120%}
      }
      .ows-wa{
        position:relative;
        z-index:1;
        display:flex;
        align-items:center;
        gap:11px;
        min-height:56px;
        padding:10px 12px;
        border-radius:15px;
        color:#fff !important;
        text-decoration:none !important;
        background:linear-gradient(135deg,rgba(37,211,102,.22),rgba(20,50,39,.72));
        border:1px solid rgba(37,211,102,.35);
        transition:transform .2s ease,box-shadow .2s ease;
      }
      .ows-wa:hover{transform:translateY(-1px);box-shadow:0 0 24px rgba(37,211,102,.2)}
      .ows-wa-icon{
        flex:0 0 40px;
        width:40px;
        height:40px;
        border-radius:50%;
        display:grid;
        place-items:center;
        color:#fff;
        background:#25d366;
        box-shadow:0 0 18px rgba(37,211,102,.4);
      }
      .ows-wa-icon svg{width:25px;height:25px;display:block}
      .ows-wa-text{display:flex;flex-direction:column;gap:2px;min-width:0}
      .ows-wa-text strong{font-size:15px}
      .ows-wa-text small{opacity:.78;font-size:12px}
      .ows-wa-arrow{margin-inline-start:auto;font-size:20px;opacity:.8}
      .ows-supporters{position:relative;z-index:1;margin-top:12px}
      .ows-supporters-title{
        display:flex;
        justify-content:center;
        align-items:center;
        gap:7px;
        margin:3px 0 10px;
        font-size:14px;
      }
      .ows-supporters-title b{
        background:linear-gradient(90deg,#fff,#ffe58a,#fff);
        background-size:200% auto;
        -webkit-background-clip:text;
        background-clip:text;
        color:transparent;
        animation:owsTextShine 2.8s linear infinite;
      }
      @keyframes owsTextShine{to{background-position:200% center}}
      .ows-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .ows-supporter{
        display:flex;
        align-items:center;
        gap:9px;
        padding:8px;
        border-radius:13px;
        border:1px solid rgba(255,215,96,.2);
        background:rgba(255,255,255,.045);
        box-shadow:0 0 14px rgba(255,215,96,.05);
      }
      .ows-avatar{
        flex:0 0 40px;
        width:40px;height:40px;border-radius:50%;
        overflow:hidden;display:grid;place-items:center;
        background:linear-gradient(135deg,#4c3920,#191919);
        border:1px solid rgba(255,220,110,.45);
      }
      .ows-avatar img{width:100%;height:100%;object-fit:cover}
      .ows-avatar span{font-size:18px}
      .ows-name{font-weight:700;font-size:13px;word-break:break-word}
      .ows-admin-card{margin-top:14px}
      .ows-admin-card h2{margin-top:0}
      .ows-admin-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
      .ows-admin-box{padding:11px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.025)}
      .ows-admin-box b{display:block;margin-bottom:8px}
      .ows-admin-box input{width:100%;box-sizing:border-box;margin:4px 0}
      .ows-preview{display:block;width:56px;height:56px;object-fit:cover;border-radius:50%;margin-top:7px;border:1px solid rgba(255,255,255,.2)}
      .ows-status{min-height:20px;margin-top:8px}
      @media(max-width:600px){.ows-grid,.ows-admin-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function whatsappIcon() {
    return `<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3.5a12.4 12.4 0 0 0-10.7 19l-1.1 4.1 4.2-1.1A12.4 12.4 0 1 0 16 3.5Zm0 2.6a9.8 9.8 0 0 1 8.2 15.2 9.7 9.7 0 0 1-8.2 4.4 9.6 9.6 0 0 1-5-1.4l-.6-.4-2.5.7.7-2.4-.4-.7A9.8 9.8 0 0 1 16 6.1Zm-4.2 4.6c-.3 0-.7.1-.9.4-.3.3-1.1 1.1-1.1 2.6s1.1 3 1.3 3.2c.2.2 2.2 3.5 5.4 4.8 2.7 1.1 3.2.9 3.8.8.6-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.1-.4-.2-.9-.5s-2-.9-2.3-1c-.3-.1-.5-.1-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.8-1-2.5-.2-.6-.5-.6-.8-.6h-.3Z"/></svg>`;
  }

  function publicMarkup() {
    const wa = normalizeWhatsapp(state.whatsapp);
    const supporters = state.supporters.slice(0, 2);
    if (!wa && !supporters.length) return '';

    let html = `<div id="${IDS.root}" class="ows-card">`;

    if (wa) {
      html += `
        <a class="ows-wa" href="${escapeAttr(wa)}" target="_blank" rel="noopener noreferrer" aria-label="التواصل مع صاحب الموقع عبر واتساب">
          <span class="ows-wa-icon">${whatsappIcon()}</span>
          <span class="ows-wa-text">
            <strong>واتساب صاحب الموقع</strong>
            <small>اضغط هنا للتواصل مباشرة</small>
          </span>
          <span class="ows-wa-arrow" aria-hidden="true">↗</span>
        </a>`;
    }

    if (supporters.length) {
      html += `<div class="ows-supporters">
        <div class="ows-supporters-title"><span>✨</span><b>أفضل الداعمين</b><span>✨</span></div>
        <div class="ows-grid">`;

      supporters.forEach(function (supporter) {
        html += `<div class="ows-supporter">
          <div class="ows-avatar">${supporter.image_url
            ? `<img src="${escapeAttr(supporter.image_url)}" alt="${escapeAttr(supporter.name || 'الداعم')}">`
            : '<span>★</span>'}</div>
          <div class="ows-name">${escapeHtml(supporter.name || 'داعم الموقع')}</div>
        </div>`;
      });

      html += `</div></div>`;
    }

    html += `</div>`;
    return html;
  }

  function renderPublic() {
    const products = $('products');
    if (!products || !products.parentNode) return;

    const old = $(IDS.root);
    if (old) old.remove();

    const html = publicMarkup();
    if (!html) return;

    // يوضع مباشرة قبل قائمة المنتجات: تحت عنوان الأسعار وقبل المنتجات.
    products.insertAdjacentHTML('beforebegin', html);
  }

  function adminMarkup() {
    const supporters = [0, 1].map(function (index) {
      return state.supporters[index] || { name: '', image_url: '' };
    });

    return `<div id="${IDS.admin}" class="card ows-admin-card">
      <h2>📱 واتساب صاحب الموقع وأفضل الداعمين</h2>
      <p class="muted">أدخل رقم واتساب أو رابط واتساب. ويمكن إضافة داعمين اثنين كحد أقصى. الخانة التي لا تحتوي بيانات لن تظهر للزوار.</p>

      <label>
        واتساب صاحب الموقع
        <input id="owsWhatsapp" type="text" inputmode="tel" autocomplete="off" value="${escapeAttr(state.whatsapp)}" placeholder="9639XXXXXXXX أو https://wa.me/9639XXXXXXXX">
      </label>

      <div class="ows-admin-grid">
        ${supporters.map(function (supporter, index) {
          return `<div class="ows-admin-box">
            <b>أفضل داعم ${index + 1}</b>
            <input id="owsSupporterName${index}" type="text" value="${escapeAttr(supporter.name)}" placeholder="اسم الداعم">
            <input id="owsSupporterImage${index}" type="url" value="${escapeAttr(supporter.image_url)}" placeholder="رابط صورة الداعم (اختياري)">
            ${supporter.image_url ? `<img class="ows-preview" src="${escapeAttr(supporter.image_url)}" alt="معاينة صورة الداعم">` : ''}
          </div>`;
        }).join('')}
      </div>

      <div class="actions">
        <button type="button" class="btn primary" id="owsSave">حفظ</button>
        <button type="button" class="btn secondary" id="owsClear">مسح الكل</button>
      </div>
      <p id="owsStatus" class="muted ows-status"></p>
    </div>`;
  }

  function isAdmin() {
    // المشروع الحالي يستخدم profileData.role === 'admin'.
    return !!(window.profileData && window.profileData.role === 'admin');
  }

  function renderAdmin() {
    const panel = $('adminPanel');
    if (!panel || !isAdmin()) return;

    const old = $(IDS.admin);
    if (old) old.remove();

    panel.insertAdjacentHTML('beforeend', adminMarkup());

    const saveButton = $('owsSave');
    const clearButton = $('owsClear');

    if (saveButton) saveButton.addEventListener('click', saveData);
    if (clearButton) clearButton.addEventListener('click', clearData);
  }

  async function writeData(payload) {
    if (!window.supabaseClient) throw new Error('supabaseClient غير موجود.');

    // يستخدم دالة المشروع الحالية إن كانت موجودة لأنها تتعامل مع صلاحيات المدير وRLS.
    const rpc = await window.supabaseClient.rpc('admin_update_owner_supporters_data', {
      p_data: payload
    });

    if (!rpc.error) return;

    // احتياط: محاولة التحديث المباشر إذا كانت سياسات RLS في مشروعك تسمح للمدير بذلك.
    const direct = await window.supabaseClient
      .from('site_settings')
      .update({ owner_supporters_data: payload })
      .not('id', 'is', null);

    if (direct.error) throw rpc.error;
  }

  async function saveData() {
    const button = $('owsSave');
    const status = $('owsStatus');
    if (button) button.disabled = true;
    if (status) status.textContent = 'جاري الحفظ...';

    try {
      const supporters = [];

      for (let index = 0; index < 2; index++) {
        const name = String(($('owsSupporterName' + index) || {}).value || '').trim();
        const imageUrl = String(($('owsSupporterImage' + index) || {}).value || '').trim();
        if (name || imageUrl) supporters.push({ name: name, image_url: imageUrl });
      }

      const payload = {
        whatsapp: String(($('owsWhatsapp') || {}).value || '').trim(),
        supporters: supporters.slice(0, 2)
      };

      await writeData(payload);
      Object.assign(state, normalizeData(payload));
      renderPublic();
      renderAdmin();

      const newStatus = $('owsStatus');
      if (newStatus) newStatus.textContent = 'تم الحفظ بنجاح.';
    } catch (error) {
      console.error('[owner_whatsapp_supporters] save:', error);
      if (status) status.textContent = 'تعذر الحفظ: ' + (error && error.message ? error.message : 'خطأ غير معروف');
    } finally {
      const currentButton = $('owsSave');
      if (currentButton) currentButton.disabled = false;
    }
  }

  async function clearData() {
    if (!window.confirm('هل تريد مسح واتساب صاحب الموقع وجميع الداعمين؟')) return;

    const button = $('owsClear');
    const status = $('owsStatus');
    if (button) button.disabled = true;
    if (status) status.textContent = 'جاري المسح...';

    try {
      const payload = { whatsapp: '', supporters: [] };
      await writeData(payload);
      Object.assign(state, normalizeData(payload));
      renderPublic();
      renderAdmin();
    } catch (error) {
      console.error('[owner_whatsapp_supporters] clear:', error);
      if (status) status.textContent = 'تعذر المسح: ' + (error && error.message ? error.message : 'خطأ غير معروف');
    }
  }

  function patchRenderAdmin() {
    // لا نعتمد على تعديل ملف المشروع نفسه. إذا كانت renderAdmin موجودة، نلفها فقط.
    if (typeof window.renderAdmin !== 'function') return;
    if (window.renderAdmin.__owsWrapped) return;

    const original = window.renderAdmin;
    const wrapped = async function () {
      const result = await original.apply(this, arguments);
      renderAdmin();
      return result;
    };

    wrapped.__owsWrapped = true;
    wrapped.__owsOriginal = original;
    window.renderAdmin = wrapped;
  }

  function start() {
    renderStyles();
    loadData().then(function () {
      renderPublic();
      renderAdmin();
    });

    // renderAdmin قد يتم تعريفه بعد تحميل هذا الملف، لذلك نراقب لفترة قصيرة فقط.
    let attempts = 0;
    const timer = setInterval(function () {
      attempts++;
      patchRenderAdmin();
      renderPublic();
      if (isAdmin()) renderAdmin();
      if (attempts >= 40) clearInterval(timer);
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
