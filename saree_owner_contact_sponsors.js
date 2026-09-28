/*
 * سعرلي سوريا — إضافة مستقلة: تواصل مع صاحب الموقع + الداعمون
 *
 * IMPORTANT:
 * - هذا الملف لا يعدّل أي ملف من المشروع ولا يعتمد على site_contact.js القديم.
 * - يجب تحميل هذا الملف مرة واحدة في صفحة الموقع (بعد Supabase وواجهة المشروع).
 * - يستخدم جداول Supabase مستقلة تماماً:
 *     saree_owner_contact_settings
 *     saree_site_sponsors
 * - يستخدم bucket مستقل للصور:
 *     saree-site-sponsor-images
 *
 * يتكامل تلقائياً مع المتغيرات الموجودة في المشروع إن وجدت:
 *   supabaseClient / profileData / ADMIN_UID
 */
(() => {
  'use strict';
  if (window.__SAREE_OWNER_CONTACT_SPONSORS__) return;
  window.__SAREE_OWNER_CONTACT_SPONSORS__ = true;

  const NS = 'sareeOwnerContactSponsors';
  const TABLE_CONTACT = 'saree_owner_contact_settings';
  const TABLE_SPONSORS = 'saree_site_sponsors';
  const BUCKET = 'saree-site-sponsor-images';
  const STYLE_ID = 'saree-owner-contact-sponsors-style';
  const CONTACT_ID = 'sareeOwnerContactSponsorsButton';
  const SPONSORS_ID = 'sareeSiteSponsorsBlock';
  const ADMIN_BUTTON_ID = 'sareeOwnerSponsorsAdminButton';
  const MODAL_ID = 'sareeOwnerSponsorsAdminModal';

  const $ = (id) => document.getElementById(id);
  const client = () => window.supabaseClient || window.supabase || null;

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function css() {
    if ($(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${CONTACT_ID}{display:inline-flex!important;align-items:center;justify-content:center;cursor:pointer}
      .saree-ocs-modal{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
      .saree-ocs-box{width:min(760px,100%);max-height:92vh;overflow:auto;background:#10191e;color:#f4f7f8;border:1px solid #33434b;border-radius:18px;padding:18px;box-shadow:0 20px 70px rgba(0,0,0,.55);font-family:inherit;direction:rtl}
      .saree-ocs-box h2,.saree-ocs-box h3{margin:0 0 12px}
      .saree-ocs-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .saree-ocs-box input,.saree-ocs-box textarea,.saree-ocs-box select{box-sizing:border-box;width:100%;padding:11px;border-radius:10px;border:1px solid #44545d;background:#172229;color:#fff;font:inherit;margin:0 0 10px}
      .saree-ocs-box textarea{min-height:90px;resize:vertical}
      .saree-ocs-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .saree-ocs-actions button{border:0;border-radius:10px;padding:10px 14px;cursor:pointer;font:inherit}
      .saree-ocs-primary{background:#1687c8;color:#fff}.saree-ocs-danger{background:#a83232;color:#fff}.saree-ocs-secondary{background:#34444d;color:#fff}
      .saree-ocs-muted{color:#aeb8bd;font-size:13px}
      .saree-ocs-contact{position:fixed;inset:0;z-index:2147482990;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
      .saree-ocs-contact-box{width:min(430px,100%);background:#fff;color:#111;border-radius:18px;padding:20px;box-sizing:border-box;text-align:center;box-shadow:0 20px 70px rgba(0,0,0,.45)}
      .saree-ocs-contact-box h2{margin:0 0 16px;font-size:21px}
      .saree-ocs-contact-link{display:block;text-decoration:none!important;border-radius:12px;padding:13px 16px;margin:9px 0;font-weight:700;color:#fff!important}
      .saree-ocs-wa{background:#25D366}.saree-ocs-tg{background:#229ED9}.saree-ocs-fb{background:#1877F2}
      .saree-ocs-close{background:#eee!important;color:#222!important;border:0;padding:10px 16px;border-radius:10px;cursor:pointer;font:inherit;margin-top:5px}
      #${SPONSORS_ID}{margin:18px 0}
      .saree-ocs-sponsor-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
      .saree-ocs-sponsor{background:var(--card-bg,#fff);border:1px solid rgba(127,127,127,.22);border-radius:14px;padding:12px;overflow:hidden}
      .saree-ocs-sponsor img{display:block;width:100%;height:150px;object-fit:cover;border-radius:10px;margin-bottom:10px}
      .saree-ocs-sponsor-name{font-weight:800;font-size:17px;margin-bottom:5px}
      .saree-ocs-sponsor-desc{line-height:1.65;white-space:pre-wrap}
      .saree-ocs-admin-row{border:1px solid #33434b;border-radius:12px;padding:10px;margin:8px 0;background:#151f24}
      .saree-ocs-admin-row img{width:70px;height:70px;object-fit:cover;border-radius:9px;vertical-align:middle;margin-left:8px}
      @media(max-width:600px){.saree-ocs-grid{grid-template-columns:1fr}.saree-ocs-box{padding:14px}}
    `;
    document.head.appendChild(s);
  }

  let ADMIN_STATUS = null;

  function isAdmin() {
    const p = window.profileData;
    if (p && String(p.role || '').toLowerCase() === 'admin') return true;
    const uid = window.ADMIN_UID;
    return !!uid && !!window.__SAREE_OWNER_CONTACT_CURRENT_USER__ && String(window.__SAREE_OWNER_CONTACT_CURRENT_USER__) === String(uid);
  }

  async function verifyAdminFromSupabase(force=false) {
    if (!force && ADMIN_STATUS !== null) return ADMIN_STATUS;
    if (isAdmin()) { ADMIN_STATUS = true; return true; }
    const c = client();
    if (!c?.rpc) { ADMIN_STATUS = false; return false; }
    try {
      const { data, error } = await c.rpc('saree_ocs_is_admin');
      ADMIN_STATUS = !error && data === true;
      return ADMIN_STATUS;
    } catch (_) {
      ADMIN_STATUS = false;
      return false;
    }
  }

  async function currentUserId() {
    const c = client();
    if (!c?.auth?.getUser) return null;
    try {
      const r = await c.auth.getUser();
      const id = r?.data?.user?.id || null;
      window.__SAREE_OWNER_CONTACT_CURRENT_USER__ = id;
      return id;
    } catch (_) { return null; }
  }

  function normalizeUrl(v, type) {
    let x = String(v || '').trim();
    if (!x) return '';
    if (type === 'whatsapp' && /^[+]?\d[\d\s()\-]{6,}$/.test(x)) {
      x = x.replace(/[^\d+]/g, '').replace(/^\+/, '');
      return 'https://wa.me/' + x;
    }
    if (type === 'telegram' && x.startsWith('@')) return 'https://t.me/' + x.slice(1);
    if (!/^https?:\/\//i.test(x)) x = 'https://' + x;
    try {
      const u = new URL(x);
      return u.protocol === 'https:' ? u.href : '';
    } catch (_) { return ''; }
  }

  function contactButton() {
    if ($(CONTACT_ID)) return $(CONTACT_ID);
    const pwa = document.getElementById('sareePwaInstallButton');
    const b = document.createElement('button');
    b.id = CONTACT_ID;
    b.type = 'button';
    b.className = pwa?.className || 'btn primary';
    b.textContent = 'تواصل مع صاحب الموقع';
    b.title = 'تواصل مع صاحب الموقع';
    b.addEventListener('click', openContact);
    if (pwa?.parentNode) {
      pwa.parentNode.insertBefore(b, pwa);
    } else {
      const top = document.querySelector('.top');
      if (top) top.appendChild(b);
      else document.body.insertBefore(b, document.body.firstChild);
    }
    return b;
  }

  async function loadContact() {
    const c = client();
    if (!c?.from) return {};
    try {
      const {data} = await c.from(TABLE_CONTACT).select('whatsapp_url,telegram_url,facebook_url').eq('id', 1).maybeSingle();
      return data || {};
    } catch (e) { console.warn(NS, 'contact:', e); return {}; }
  }

  async function openContact() {
    const data = await loadContact();
    const links = [
      ['whatsapp_url','واتساب','saree-ocs-wa','whatsapp'],
      ['telegram_url','تلغرام','saree-ocs-tg','telegram'],
      ['facebook_url','فيسبوك','saree-ocs-fb','facebook']
    ].map(([key,label,cls,type]) => {
      const url = normalizeUrl(data[key], type);
      return url ? `<a class="saree-ocs-contact-link ${cls}" href="${esc(url)}">${label}</a>` : '';
    }).join('');
    const m = document.createElement('div');
    m.className = 'saree-ocs-contact';
    m.innerHTML = `<div class="saree-ocs-contact-box" dir="rtl"><h2>تواصل مع صاحب الموقع</h2>${links || '<p>لا توجد روابط تواصل مضافة حالياً.</p>'}<button class="saree-ocs-close" type="button">إغلاق</button></div>`;
    document.body.appendChild(m);
    m.querySelector('.saree-ocs-close').onclick = () => m.remove();
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  }

  function findProductsHeading() {
    const candidates = [...document.querySelectorAll('h1,h2,h3')];
    return candidates.find(x => /أفضل الأسعار|المنتجات/i.test(x.textContent || '')) || document.getElementById('products');
  }

  async function loadSponsors() {
    const c = client();
    if (!c?.from) return [];
    try {
      const {data,error} = await c.from(TABLE_SPONSORS).select('id,name,description,image_url,published,sort_order,created_at').eq('published',true).order('sort_order',{ascending:true}).order('created_at',{ascending:false});
      if (error) throw error;
      return data || [];
    } catch (e) { console.warn(NS, 'sponsors:', e); return []; }
  }

  function renderSponsors(items) {
    let box = $(SPONSORS_ID);
    if (!items.length) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement('section'); box.id = SPONSORS_ID; box.dir = 'rtl'; }
    box.innerHTML = `<h2>الداعمون</h2><div class="saree-ocs-sponsor-grid">${items.map(x => `<article class="saree-ocs-sponsor">${x.image_url ? `<img src="${esc(x.image_url)}" alt="${esc(x.name)}">` : ''}<div class="saree-ocs-sponsor-name">${esc(x.name)}</div>${x.description ? `<div class="saree-ocs-sponsor-desc">${esc(x.description)}</div>` : ''}</article>`).join('')}</div>`;
    const heading = findProductsHeading();
    if (heading && heading.parentNode) heading.parentNode.insertBefore(box, heading);
    else if (document.getElementById('products')?.parentNode) document.getElementById('products').parentNode.insertBefore(box, document.getElementById('products'));
    return box;
  }

  function modal(html) {
    $(MODAL_ID)?.remove();
    const m = document.createElement('div');
    m.id = MODAL_ID; m.className = 'saree-ocs-modal';
    m.innerHTML = `<div class="saree-ocs-box">${html}</div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    return m;
  }

  async function saveContact(m) {
    const c = client(); if (!c?.from) return alert('Supabase غير متاح.');
    if (!isAdmin()) return alert('هذا الخيار للمدير فقط.');
    const payload = {id:1, whatsapp_url:m.querySelector('#socs_whatsapp').value.trim() || null, telegram_url:m.querySelector('#socs_telegram').value.trim() || null, facebook_url:m.querySelector('#socs_facebook').value.trim() || null, updated_at:new Date().toISOString()};
    const {error} = await c.from(TABLE_CONTACT).upsert(payload,{onConflict:'id'});
    if (error) return alert(error.message);
    alert('تم حفظ روابط التواصل.');
  }

  async function uploadSponsorImage(file) {
    const c = client();
    if (!file) return null;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
    const path = `sponsors/${crypto.randomUUID()}.${ext}`;
    const {error} = await c.storage.from(BUCKET).upload(path,file,{upsert:false,contentType:file.type || 'image/jpeg'});
    if (error) throw error;
    const {data} = c.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  }

  async function listSponsorsAdmin() {
    const c = client();
    const {data,error} = await c.from(TABLE_SPONSORS).select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:false});
    if (error) throw error;
    return data || [];
  }

  async function openSponsorEditor(item) {
    const editing = !!item;
    const m = modal(`<h2>${editing ? 'تعديل الداعم' : 'إضافة داعم'}</h2>
      <div class="saree-ocs-grid"><input id="socs_name" placeholder="اسم الداعم" value="${esc(item?.name || '')}"><input id="socs_sort" type="number" placeholder="الترتيب" value="${esc(item?.sort_order ?? 0)}"></div>
      <textarea id="socs_desc" placeholder="وصف الداعم">${esc(item?.description || '')}</textarea>
      <input id="socs_image" type="file" accept="image/*">
      <label><input id="socs_published" type="checkbox" ${item?.published ? 'checked' : ''}> نشر الداعم للعامة</label>
      <p class="saree-ocs-muted">${item?.image_url ? 'الصورة الحالية محفوظة، واختيار صورة جديدة يستبدلها.' : 'اختر صورة للداعم اختيارياً.'}</p>
      <div class="saree-ocs-actions"><button id="socs_save" class="saree-ocs-primary">حفظ</button><button id="socs_cancel" class="saree-ocs-secondary">إلغاء</button></div>`);
    m.querySelector('#socs_cancel').onclick = () => m.remove();
    m.querySelector('#socs_save').onclick = async () => {
      if (!isAdmin()) return alert('هذا الخيار للمدير فقط.');
      const c = client();
      const name = m.querySelector('#socs_name').value.trim();
      if (!name) return alert('اسم الداعم مطلوب.');
      const btn = m.querySelector('#socs_save'); btn.disabled = true; btn.textContent = 'جاري الحفظ...';
      try {
        let image_url = item?.image_url || null;
        const file = m.querySelector('#socs_image').files?.[0];
        if (file) image_url = await uploadSponsorImage(file);
        const payload = {name,description:m.querySelector('#socs_desc').value.trim() || null,image_url,published:m.querySelector('#socs_published').checked,sort_order:Number(m.querySelector('#socs_sort').value || 0),updated_at:new Date().toISOString()};
        let r;
        if (editing) r = await c.from(TABLE_SPONSORS).update(payload).eq('id',item.id);
        else r = await c.from(TABLE_SPONSORS).insert(payload);
        if (r.error) throw r.error;
        m.remove(); await refreshSponsors(); await openAdmin();
      } catch(e) { alert(e.message || String(e)); btn.disabled=false; btn.textContent='حفظ'; }
    };
  }

  async function deleteSponsor(id) {
    if (!isAdmin()) return alert('هذا الخيار للمدير فقط.');
    if (!confirm('حذف هذا الداعم؟')) return;
    const c = client(); const {error} = await c.from(TABLE_SPONSORS).delete().eq('id',id);
    if (error) return alert(error.message);
    await refreshSponsors(); await openAdmin();
  }

  async function openAdmin() {
    if (!(await verifyAdminFromSupabase())) return alert('هذا الخيار للمدير فقط.');
    const contact = await loadContact();
    let sponsors=[]; try { sponsors=await listSponsorsAdmin(); } catch(e) { return alert(e.message); }
    const rows = sponsors.length ? sponsors.map(x => `<div class="saree-ocs-admin-row">${x.image_url ? `<img src="${esc(x.image_url)}" alt="">` : ''}<b>${esc(x.name)}</b> ${x.published ? '<span>• منشور</span>' : '<span>• غير منشور</span>'}<div class="saree-ocs-muted">${esc(x.description || '')}</div><div class="saree-ocs-actions"><button class="saree-ocs-secondary" data-edit="${esc(x.id)}">تعديل</button><button class="saree-ocs-danger" data-del="${esc(x.id)}">حذف</button></div></div>`).join('') : '<p class="saree-ocs-muted">لا يوجد داعمون.</p>';
    const m = modal(`<h2>إضافة/إدارة تواصل الموقع والداعمين</h2>
      <h3>تواصل مع صاحب الموقع</h3>
      <input id="socs_whatsapp" placeholder="رابط واتساب أو رقم الهاتف" value="${esc(contact.whatsapp_url || '')}">
      <input id="socs_telegram" placeholder="رابط تلغرام أو @username" value="${esc(contact.telegram_url || '')}">
      <input id="socs_facebook" placeholder="رابط فيسبوك" value="${esc(contact.facebook_url || '')}">
      <div class="saree-ocs-actions"><button id="socs_contact_save" class="saree-ocs-primary">حفظ روابط التواصل</button></div>
      <hr style="margin:18px 0;border:0;border-top:1px solid #33434b">
      <h3>الداعمون</h3><div class="saree-ocs-actions"><button id="socs_add" class="saree-ocs-primary">إضافة داعم</button></div>
      <div id="socs_list">${rows}</div>`);
    m.querySelector('#socs_contact_save').onclick = () => saveContact(m);
    m.querySelector('#socs_add').onclick = () => openSponsorEditor();
    m.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { const x=sponsors.find(v=>String(v.id)===String(b.dataset.edit)); if(x) openSponsorEditor(x); });
    m.querySelectorAll('[data-del]').forEach(b => b.onclick = () => deleteSponsor(b.dataset.del));
  }

  async function refreshSponsors() { renderSponsors(await loadSponsors()); }

  async function injectAdminButton() {
    if (!(await verifyAdminFromSupabase())) return;
    if ($(ADMIN_BUTTON_ID)) return;

    const panel = document.getElementById('adminPanel');
    if (!panel) return;

    const card = document.createElement('div');
    card.id = ADMIN_BUTTON_ID;
    card.className = 'card';
    card.setAttribute('data-saree-ocs-admin-card', 'true');
    card.innerHTML = `
      <h2>🤝 تواصل الموقع والداعمون</h2>
      <p class="muted">إدارة روابط واتساب وتلغرام وفيسبوك، وإضافة وتعديل ونشر الداعمين.</p>
      <div class="actions">
        <button type="button" class="btn primary" id="sareeOcsOpenAdminButton">فتح إدارة التواصل والداعمين</button>
      </div>`;
    panel.insertBefore(card, panel.firstChild);
    card.querySelector('#sareeOcsOpenAdminButton').onclick = openAdmin;
  }

  async function boot() {
    css();
    await currentUserId();
    contactButton();
    await refreshSponsors();
    await injectAdminButton();
  }

  function observe() {
    let timer=0;
    const mo=new MutationObserver(() => { clearTimeout(timer); timer=setTimeout(() => { contactButton(); void injectAdminButton(); if(!$(SPONSORS_ID)) refreshSponsors(); },250); });
    mo.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('load',()=>setTimeout(boot,50),{once:true});
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,50),{once:true}); else setTimeout(boot,50);
    if(window.supabaseClient?.auth?.onAuthStateChange){
      window.supabaseClient.auth.onAuthStateChange(() => setTimeout(async()=>{await currentUserId(); ADMIN_STATUS=null; await injectAdminButton();},150));
    }
  }

  window.sareeOwnerContactSponsors = { openContact, openAdmin, refreshSponsors };
  observe();
})();
