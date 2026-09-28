/* سعرلي سوريا — إضافة مستقلة:
   إدارة أصحاب الشركات + صلاحيات الشركة + مشاهدات الشركة + إضافة/تعديل/حذف المواد.
   هذا الملف لا يغيّر ملفات المشروع الأصلية ولا يستبدل company_system.js.
   حمّله بعد company_system.js.
*/
(() => {
  'use strict';
  if (window.__SAREE_COMPANY_OWNER_ADMIN_PATCH__) return;
  window.__SAREE_COMPANY_OWNER_ADMIN_PATCH__ = true;

  const NS = 'sareeCompanyOwnerAdminPatch';
  const ADMIN_CARD_ID = 'sareeCoPatchAdminCard';
  const OWNER_CARD_ID = 'sareeCoPatchOwnerCard';
  const MODAL_ID = 'sareeCoPatchModal';
  const STYLE_ID = 'sareeCoPatchStyle';
  const OWNER_NAV_ID = 'sareeCoPatchOwnerNav';
  const client = () => window.supabaseClient || null;

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const attr = esc;
  const money = (v) => Number(v || 0).toLocaleString('ar-SY', { maximumFractionDigits: 2 });

  function injectCss() {
    if ($(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${ADMIN_CARD_ID},#${OWNER_CARD_ID}{margin-top:14px}
      .sco-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .sco-grid input,.sco-grid select,.sco-grid textarea{width:100%;box-sizing:border-box;padding:10px;border:1px solid rgba(127,127,127,.35);border-radius:10px;background:var(--card-bg,#10191e);color:inherit;font:inherit}
      .sco-perms{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:10px 0}
      .sco-perms label{display:flex;gap:7px;align-items:center;padding:8px;border:1px solid rgba(127,127,127,.22);border-radius:9px}
      .sco-row{border:1px solid rgba(127,127,127,.22);border-radius:12px;padding:11px;margin:9px 0}
      .sco-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}
      .sco-stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:10px 0}
      .sco-stat{border:1px solid rgba(127,127,127,.22);border-radius:12px;padding:12px;text-align:center}
      .sco-stat b{font-size:22px;display:block}
      .sco-modal{position:fixed;inset:0;background:rgba(0,0,0,.68);z-index:2147483640;display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box}
      .sco-modal-box{width:min(760px,100%);max-height:92vh;overflow:auto;border-radius:18px;padding:16px;background:var(--card-bg,#10191e);color:inherit;border:1px solid rgba(127,127,127,.3);box-sizing:border-box}
      .sco-modal-box textarea{min-height:90px}
      .sco-muted{opacity:.75;font-size:.9em}
      @media(max-width:650px){.sco-grid,.sco-perms,.sco-stat-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function modal(title, html) {
    $(MODAL_ID)?.remove();
    const m = document.createElement('div');
    m.id = MODAL_ID;
    m.className = 'sco-modal';
    m.innerHTML = `<div class="sco-modal-box" dir="rtl">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <h2 style="margin:0 0 12px">${esc(title)}</h2>
        <button class="btn secondary" type="button" id="scoClose">×</button>
      </div>
      ${html}
    </div>`;
    document.body.appendChild(m);
    $('#scoClose').onclick = () => m.remove();
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    return m;
  }

  async function isAdmin() {
    const c = client();
    if (!c?.rpc) return false;
    try {
      const r = await c.rpc('is_admin');
      return !r.error && r.data === true;
    } catch (_) { return false; }
  }

  async function currentUserId() {
    const c = client();
    if (!c?.auth?.getUser) return null;
    try {
      const r = await c.auth.getUser();
      return r.data?.user?.id || null;
    } catch (_) { return null; }
  }

  async function ownerContext() {
    const c = client();
    const uid = await currentUserId();
    if (!uid || !c?.from) return null;
    const { data, error } = await c.from('company_users')
      .select('user_id,company_id,can_manage_products,can_edit_products,can_delete_products,can_manage_categories,can_manage_settings,can_view_orders,can_view_visits,active,companies(*)')
      .eq('user_id', uid).eq('active', true).maybeSingle();
    if (error || !data?.company_id || !data?.companies) return null;
    return data;
  }

  function ownerPermissions(ctx) {
    return `
      <div class="sco-perms">
        <label><input data-sco-perm="manage" type="checkbox" ${ctx?.can_manage_products?'checked':''}> إضافة وإدارة المواد</label>
        <label><input data-sco-perm="edit" type="checkbox" ${ctx?.can_edit_products?'checked':''}> تعديل المواد</label>
        <label><input data-sco-perm="delete" type="checkbox" ${ctx?.can_delete_products?'checked':''}> حذف/إخفاء المواد</label>
        <label><input data-sco-perm="cat" type="checkbox" ${ctx?.can_manage_categories?'checked':''}> إدارة التصنيفات</label>
        <label><input data-sco-perm="views" type="checkbox" ${ctx?.can_view_visits?'checked':''}> مشاهدة مشاهدات الشركة</label>
      </div>`;
  }

  async function adminListCompanies() {
    const c = client();
    const { data, error } = await c.from('companies').select('id,name,active').eq('active', true).order('name');
    if (error) throw error;
    return data || [];
  }

  async function adminListOwners() {
    const c = client();
    const { data, error } = await c.rpc('admin_list_company_users_v2');
    if (error) throw error;
    return data || [];
  }

  function ownerRowsHtml(items) {
    if (!items.length) return '<div class="sco-muted">لا يوجد أصحاب شركات مرتبطون حالياً.</div>';
    return items.map(u => {
      const key = String(u.user_id).replace(/[^A-Za-z0-9_]/g,'');
      return `<div class="sco-row" data-sco-owner="${attr(u.user_id)}">
        <div><b>${esc(u.email || u.user_id)}</b><div class="sco-muted">${esc(u.company_name || 'بدون شركة')}</div></div>
        ${ownerPermissions(u)}
        <div class="sco-actions">
          <button class="btn primary" type="button" onclick="window.sareeCoPatchSaveOwner('${attr(u.user_id)}')">حفظ الصلاحيات</button>
          <button class="btn danger" type="button" onclick="window.sareeCoPatchUnlinkOwner('${attr(u.user_id)}')">فك الربط</button>
        </div>
      </div>`;
    }).join('');
  }

  async function renderAdminCard() {
    if (!(await isAdmin())) return;
    const panel = $('adminPanel');
    if (!panel) return;
    let box = $(ADMIN_CARD_ID);
    if (!box) {
      box = document.createElement('div');
      box.id = ADMIN_CARD_ID;
      box.className = 'card';
      panel.appendChild(box);
    }

    try {
      const [companies, owners] = await Promise.all([adminListCompanies(), adminListOwners()]);
      box.innerHTML = `
        <h2>🏢 صلاحيات أصحاب الشركات</h2>
        <p class="muted">اربط حساب صاحب الشركة مباشرة بالبريد الإلكتروني، ثم امنحه فقط الصلاحيات المطلوبة. الصلاحيات تُطبّق داخل شركته فقط.</p>
        <div class="actions">
          <button class="btn primary" type="button" id="scoOpenLink">ربط صاحب شركة</button>
          <button class="btn secondary" type="button" id="scoRefreshOwners">تحديث</button>
        </div>
        <div id="scoOwnersList" style="margin-top:10px">${ownerRowsHtml(owners)}</div>
      `;
      $('scoOpenLink').onclick = () => openAdminLinkModal(companies);
      $('scoRefreshOwners').onclick = renderAdminCard;
    } catch (e) {
      box.innerHTML = `<h2>🏢 صلاحيات أصحاب الشركات</h2><div class="dangerbox">${esc(e.message || 'تعذر تحميل أصحاب الشركات')}</div>`;
    }
  }

  async function openAdminLinkModal(companies) {
    const options = companies.map(c => `<option value="${attr(c.id)}">${esc(c.name)}</option>`).join('');
    const m = modal('ربط صاحب شركة', `
      <div class="sco-grid">
        <input id="scoLinkEmail" type="email" placeholder="بريد صاحب الشركة">
        <select id="scoLinkCompany">${options}</select>
      </div>
      ${ownerPermissions({can_manage_products:true,can_edit_products:true,can_delete_products:true,can_manage_categories:false,can_view_visits:true})}
      <div class="sco-actions">
        <button class="btn primary" type="button" id="scoLinkSave">حفظ وربط</button>
      </div>
      <p class="sco-muted">الحساب يجب أن يكون موجوداً في Supabase Auth.</p>
    `);
    $('#scoLinkSave').onclick = async () => {
      const email = $('#scoLinkEmail').value.trim();
      const companyId = $('#scoLinkCompany').value;
      if (!email) return alert('اكتب بريد صاحب الشركة.');
      const get = k => !!m.querySelector(`input[data-sco-perm="${k}"]`)?.checked;
      const c = client();
      const { error } = await c.rpc('admin_link_company_user_by_email', {
        p_email: email,
        p_company_id: companyId,
        p_can_manage_products: get('manage'),
        p_can_edit_products: get('edit'),
        p_can_delete_products: get('delete'),
        p_can_manage_categories: get('cat'),
        p_can_view_visits: get('views'),
        p_can_manage_settings: false
      });
      if (error) return alert(error.message);
      m.remove();
      await renderAdminCard();
      alert('تم ربط صاحب الشركة ومنحه الصلاحيات.');
    };
  }

  window.sareeCoPatchSaveOwner = async function(userId) {
    if (!(await isAdmin())) return alert('المدير فقط.');
    const row = document.querySelector(`[data-sco-owner="${CSS.escape(userId)}"]`);
    if (!row) return;
    const get = k => !!row.querySelector(`input[data-sco-perm="${k}"]`)?.checked;
    const c = client();
    const { error } = await c.rpc('admin_set_company_permissions_v2', {
      p_user_id: userId,
      p_can_manage_products: get('manage'),
      p_can_edit_products: get('edit'),
      p_can_delete_products: get('delete'),
      p_can_manage_categories: get('cat'),
      p_can_manage_settings: false,
      p_can_view_orders: false,
      p_can_view_visits: get('views'),
      p_active: true
    });
    if (error) return alert(error.message);
    alert('تم حفظ الصلاحيات.');
    await renderAdminCard();
  };

  window.sareeCoPatchUnlinkOwner = async function(userId) {
    if (!(await isAdmin())) return alert('المدير فقط.');
    if (!confirm('فك ربط هذا الحساب من الشركة؟')) return;
    const c = client();
    const { error } = await c.rpc('admin_unlink_company_account', { p_user_id: userId });
    if (error) return alert(error.message);
    await renderAdminCard();
  };

  async function getOwnerStats(ctx) {
    if (!ctx?.can_view_visits) return null;
    const c = client();
    const { data, error } = await c.rpc('company_owner_visitor_stats', { p_company_id: ctx.company_id });
    if (error) throw error;
    return data?.[0] || null;
  }

  async function getOwnerProducts(ctx) {
    const c = client();
    const { data, error } = await c.from('company_products').select('*')
      .eq('company_id', ctx.company_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  function ownerProductRows(ctx, products) {
    if (!products.length) return '<div class="sco-muted">لا توجد مواد في الشركة.</div>';
    return products.map(p => `
      <div class="sco-row">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div>
            <b>${esc(p.name)}</b>
            <div class="sco-muted">${esc(p.barcode || 'بدون باركود')} • ${p.price_new == null ? 'بدون سعر' : money(p.price_new)+' ل.س'}</div>
            ${p.active ? '' : '<div class="sco-muted">مخفية</div>'}
          </div>
        </div>
        <div class="sco-actions">
          ${ctx.can_edit_products || ctx.can_manage_products ? `<button class="btn secondary" type="button" onclick="window.sareeCoPatchEditProduct('${attr(p.id)}')">تعديل</button>` : ''}
          ${ctx.can_delete_products || ctx.can_manage_products ? `<button class="btn danger" type="button" onclick="window.sareeCoPatchDeleteProduct('${attr(p.id)}')">حذف</button>` : ''}
        </div>
      </div>`).join('');
  }

  async function renderOwnerCard(ctx) {
    const panel = $('adminPanel');
    if (!panel || !ctx?.companies) return;
    let box = $(OWNER_CARD_ID);
    if (!box) {
      box = document.createElement('div');
      box.id = OWNER_CARD_ID;
      box.className = 'card';
      panel.appendChild(box);
    }

    try {
      const [products, stats] = await Promise.all([
        getOwnerProducts(ctx),
        getOwnerStats(ctx).catch(() => null)
      ]);
      box.innerHTML = `
        <h2>🏢 لوحة شركتي — ${esc(ctx.companies.name || '')}</h2>
        <p class="muted">لا يمكن لهذا الحساب إدارة أو تعديل أي شركة أخرى. كل عمليات المواد مرتبطة تلقائياً بشركة هذا الحساب.</p>
        <div class="sco-stat-grid">
          <div class="sco-stat"><b>${products.filter(p=>p.active).length}</b><span>مواد نشطة</span></div>
          ${ctx.can_view_visits ? `<div class="sco-stat"><b>${Number(stats?.total_visits || 0).toLocaleString('ar-SY')}</b><span>إجمالي الزيارات</span></div><div class="sco-stat"><b>${Number(stats?.unique_visitors || 0).toLocaleString('ar-SY')}</b><span>زوار فريدون</span></div>` : '<div class="sco-stat"><b>—</b><span>المشاهدات غير مفعلة</span></div><div class="sco-stat"><b>—</b><span>المشاهدات غير مفعلة</span></div>'}
        </div>
        <div class="sco-actions">
          ${ctx.can_manage_products ? `<button class="btn primary" type="button" id="scoOwnerAdd">➕ إضافة مادة</button>` : ''}
          <button class="btn secondary" type="button" id="scoOwnerRefresh">تحديث</button>
          <button class="btn secondary" type="button" onclick="window.openCompanyById?.('${attr(ctx.company_id)}')">فتح صفحة الشركة</button>
        </div>
        <div style="margin-top:10px"><h3>مواد الشركة</h3><div id="scoOwnerProducts">${ownerProductRows(ctx, products)}</div></div>
      `;
      if ($('scoOwnerAdd')) $('scoOwnerAdd').onclick = () => openOwnerProductEditor(ctx, null);
      $('scoOwnerRefresh').onclick = () => renderOwnerCard(ctx);
    } catch (e) {
      box.innerHTML = `<h2>🏢 لوحة شركتي</h2><div class="dangerbox">${esc(e.message || 'تعذر تحميل بيانات الشركة')}</div>`;
    }
  }

  async function refreshOwner() {
    const ctx = await ownerContext();
    if (!ctx) {
      $(OWNER_CARD_ID)?.remove();
      $(OWNER_NAV_ID)?.remove();
      return null;
    }
    injectOwnerNav(ctx);
    if (document.getElementById('adminPanel')) await renderOwnerCard(ctx);
    return ctx;
  }

  function injectOwnerNav(ctx) {
    const nav = document.querySelector('.navin');
    if (!nav || $(OWNER_NAV_ID)) return;
    const b = document.createElement('button');
    b.id = OWNER_NAV_ID;
    b.type = 'button';
    b.textContent = 'لوحة شركتي';
    b.className = 'btn secondary';
    b.onclick = async () => {
      window.show?.('admin');
      setTimeout(() => renderOwnerCard(ctx), 50);
    };
    nav.appendChild(b);
  }

  async function openOwnerProductEditor(ctx, existing) {
    if (!ctx?.can_manage_products && !existing) return alert('لا توجد صلاحية إضافة المواد.');
    if (existing && !(ctx.can_edit_products || ctx.can_manage_products)) return alert('لا توجد صلاحية تعديل المواد.');
    const p = existing || {};
    const m = modal(existing ? 'تعديل مادة الشركة' : 'إضافة مادة للشركة', `
      <div class="sco-grid">
        <input id="scoPName" placeholder="اسم المادة" value="${attr(p.name || '')}">
        <input id="scoPBrand" placeholder="العلامة التجارية (اختياري)" value="${attr(p.brand || '')}">
        <input id="scoPUnit" placeholder="الوزن / الحجم" value="${attr(p.unit || '')}">
        <input id="scoPCategory" placeholder="التصنيف" value="${attr(p.category || '')}">
        <input id="scoPBarcode" placeholder="الباركود (اختياري)" value="${attr(p.barcode || '')}">
        <input id="scoPPrice" type="number" min="0" step="0.01" placeholder="السعر — اختياري" value="${p.price_new == null ? '' : attr(p.price_new)}">
      </div>
      <textarea id="scoPDesc" placeholder="وصف المادة (اختياري)">${esc(p.description || '')}</textarea>
      <div class="sco-actions">
        <button class="btn primary" type="button" id="scoPSave">حفظ</button>
      </div>
      <p class="sco-muted">السعر اختياري. الباركود اختياري ويمكن تركه فارغاً.</p>
    `);
    $('#scoPSave').onclick = async () => {
      const name = $('#scoPName').value.trim();
      if (!name) return alert('اسم المادة مطلوب.');
      const rawPrice = $('#scoPPrice').value.trim();
      const price = rawPrice === '' ? null : Number(rawPrice);
      if (price !== null && (!Number.isFinite(price) || price < 0)) return alert('السعر غير صالح.');
      const payload = {
        p_name: name,
        p_brand: $('#scoPBrand').value.trim() || null,
        p_unit: $('#scoPUnit').value.trim() || null,
        p_category: $('#scoPCategory').value.trim() || null,
        p_category_id: null,
        p_barcode: $('#scoPBarcode').value.trim() || null,
        p_description: $('#scoPDesc').value.trim() || null,
        p_image_url: existing?.image_url || null,
        p_price_new: price
      };
      let r;
      if (existing) {
        r = await client().rpc('company_update_product', { p_id: existing.id, ...payload, p_active: true });
      } else {
        r = await client().rpc('company_add_product', payload);
      }
      if (r.error) return alert(r.error.message);
      m.remove();
      await renderOwnerCard(await ownerContext());
    };
  }

  window.sareeCoPatchEditProduct = async function(id) {
    const ctx = await ownerContext();
    if (!ctx) return alert('الحساب غير مرتبط بشركة.');
    const { data, error } = await client().from('company_products').select('*').eq('id', id).eq('company_id', ctx.company_id).maybeSingle();
    if (error) return alert(error.message);
    if (!data) return alert('المادة غير موجودة في شركتك.');
    return openOwnerProductEditor(ctx, data);
  };

  window.sareeCoPatchDeleteProduct = async function(id) {
    const ctx = await ownerContext();
    if (!ctx || !(ctx.can_delete_products || ctx.can_manage_products)) return alert('لا توجد صلاحية حذف المواد.');
    if (!confirm('حذف/إخفاء المادة من صفحة الشركة؟')) return;
    const { error } = await client().rpc('company_delete_product', { p_id: id });
    if (error) return alert(error.message);
    await renderOwnerCard(ctx);
  };

  async function boot() {
    injectCss();
    const c = client();
    if (!c?.auth) return;
    await new Promise(r => setTimeout(r, 250));
    const admin = await isAdmin();
    if (admin) {
      // ننتظر ظهور لوحة المدير دون لمس صلاحيات باقي المشروع.
      const timer = setInterval(async () => {
        if ($('adminPanel')) {
          clearInterval(timer);
          await renderAdminCard();
        }
      }, 300);
      setTimeout(() => clearInterval(timer), 12000);
    }
    await refreshOwner();
    c.auth.onAuthStateChange(() => setTimeout(refreshOwner, 350));
    const obs = new MutationObserver(() => {
      if (admin && $('adminPanel') && !$(ADMIN_CARD_ID)) renderAdminCard();
      refreshOwner();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window[NS] = {
    refreshOwner,
    renderAdminCard,
    renderOwnerCard,
    openOwnerProductEditor
  };
})();