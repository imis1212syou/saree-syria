/* سعرلي سوريا — صاحب الموقع + الداعمون
 * تخزين مستقل في site_settings.owner_supporters_data (jsonb)
 * لا يستخدم key ولا جدول saree_supporters.
 */
(function () {
  'use strict';

  const COLUMN = 'owner_supporters_data';
  const SECTION_ID = 'sareeOwnerSupportersNew';
  const ADMIN_ID = 'sareeOwnerSupportersAdminNew';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const currentProfile = () => { try { return (typeof profileData !== 'undefined' && profileData) ? profileData : window.profileData; } catch (_) { return window.profileData || null; } };
  const isAdmin = () => String(currentProfile()?.role || '').toLowerCase() === 'admin';

  function safeWhatsapp(value) {
    let v = String(value || '').trim();
    if (!v) return '';
    if (/^[+]?[0-9\s().-]{7,}$/.test(v)) {
      v = v.replace(/[^0-9+]/g, '').replace(/^\+/, '');
      return 'https://wa.me/' + v;
    }
    if (!/^https:\/\//i.test(v)) v = 'https://' + v;
    try { return new URL(v).protocol === 'https:' ? new URL(v).href : ''; } catch (_) { return ''; }
  }

  function emptyData() { return { owner_whatsapp_url: '', supporters: [] }; }

  async function readData() {
    if (!window.supabaseClient) return emptyData();
    const { data, error } = await window.supabaseClient
      .from('site_settings')
      .select(COLUMN)
      .eq('id', 1)
      .maybeSingle();
    if (error) { console.warn('owner_supporters_data:', error.message); return emptyData(); }
    const raw = data?.[COLUMN];
    if (!raw || typeof raw !== 'object') return emptyData();
    return {
      owner_whatsapp_url: String(raw.owner_whatsapp_url || ''),
      supporters: Array.isArray(raw.supporters) ? raw.supporters : []
    };
  }

  async function writeData(payload) {
    const clean = {
      owner_whatsapp_url: String(payload.owner_whatsapp_url || '').trim(),
      supporters: (Array.isArray(payload.supporters) ? payload.supporters : []).map((x, i) => ({
        id: String(x.id || ('supporter_' + Date.now() + '_' + i)),
        name: String(x.name || '').trim(),
        description: String(x.description || '').trim(),
        image_url: String(x.image_url || '').trim(),
        sort_order: Number(x.sort_order || 0),
        visible: x.visible !== false
      })).filter(x => x.name)
    };
    const dbPayload = { [COLUMN]: clean, updated_at: new Date().toISOString() };
    const { data: updatedRows, error: updateError } = await window.supabaseClient
      .from('site_settings')
      .update(dbPayload)
      .eq('id', 1)
      .select('id');
    if (updateError) throw updateError;
    if (!updatedRows || updatedRows.length === 0) {
      const { error: insertError } = await window.supabaseClient
        .from('site_settings')
        .insert({ id: 1, ...dbPayload });
      if (insertError) throw insertError;
    }
    return clean;
  }

  function addStyles() {
    if ($('sareeOwnerSupportersNewStyles')) return;
    const s = document.createElement('style');
    s.id = 'sareeOwnerSupportersNewStyles';
    s.textContent = `
      #${SECTION_ID}{width:100%;margin:10px 0 14px;box-sizing:border-box;display:flex;flex-direction:column;gap:10px}
      #${SECTION_ID}.saree-os-hidden{display:none!important}
      #${SECTION_ID} .saree-owner-wa-wrap{display:flex;justify-content:flex-start;align-items:center;direction:rtl}
      #${SECTION_ID} .saree-owner-wa{position:relative;width:48px;height:48px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#25D366;box-shadow:0 6px 18px rgba(37,211,102,.28);text-decoration:none!important;overflow:hidden;transition:transform .2s ease,box-shadow .2s ease}
      #${SECTION_ID} .saree-owner-wa:hover{transform:translateY(-2px) scale(1.05);box-shadow:0 9px 24px rgba(37,211,102,.4)}
      #${SECTION_ID} .saree-owner-wa svg{width:27px;height:27px;fill:#fff;position:relative;z-index:2}
      #${SECTION_ID} .saree-owner-wa:after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 42%,rgba(255,255,255,.65) 50%,transparent 58%);animation:sareeWaShine 3.2s linear infinite}
      @keyframes sareeWaShine{0%{transform:translateX(-65%) rotate(10deg)}55%,100%{transform:translateX(65%) rotate(10deg)}}
      #${SECTION_ID} .saree-supporters-wrap{position:relative;border-radius:17px;padding:1px;background:linear-gradient(110deg,#8b6518,#f6d77a,#fff0a8,#a87820,#f0c95c,#8b6518);background-size:300% 300%;animation:sareeGoldBorder 7s ease infinite;overflow:hidden}
      #${SECTION_ID} .saree-supporters-inner{position:relative;background:#11181b;border-radius:16px;padding:13px 12px;overflow:hidden}
      #${SECTION_ID} .saree-supporters-inner:before{content:"";position:absolute;top:0;bottom:0;width:80px;background:linear-gradient(90deg,transparent,rgba(255,232,137,.18),transparent);transform:translateX(-130%) skewX(-18deg);animation:sareeGoldSweep 4.5s linear infinite;pointer-events:none}
      #${SECTION_ID} .saree-supporters-title{position:relative;color:#f4d36b;font-weight:900;font-size:17px;text-align:right;margin-bottom:10px;text-shadow:0 0 12px rgba(246,215,122,.25)}
      #${SECTION_ID} .saree-supporters-title span{display:inline-block;animation:sareeTitleGlow 2.6s ease-in-out infinite}
      #${SECTION_ID} .saree-supporters-list{position:relative;display:flex;flex-direction:column;gap:8px}
      #${SECTION_ID} .saree-supporter{position:relative;display:flex;align-items:center;gap:10px;min-height:58px;padding:9px 10px;border:1px solid rgba(230,190,70,.35);border-radius:13px;background:linear-gradient(100deg,rgba(255,255,255,.025),rgba(244,211,107,.07),rgba(255,255,255,.025));overflow:hidden;box-shadow:inset 0 0 18px rgba(244,211,107,.035),0 3px 13px rgba(0,0,0,.15)}
      #${SECTION_ID} .saree-supporter:after{content:"";position:absolute;top:-40%;bottom:-40%;width:55px;background:linear-gradient(90deg,transparent,rgba(255,244,180,.42),transparent);transform:translateX(-180%) skewX(-20deg);animation:sareeCardShine 4s ease-in-out infinite}
      #${SECTION_ID} .saree-supporter:nth-child(2):after{animation-delay:.8s}.saree-supporter:nth-child(3):after{animation-delay:1.6s}.saree-supporter:nth-child(4):after{animation-delay:2.4s}
      #${SECTION_ID} .saree-supporter-img{width:48px;height:48px;flex:0 0 48px;border-radius:11px;object-fit:cover;border:1px solid rgba(246,215,122,.65);box-shadow:0 0 12px rgba(246,215,122,.12)}
      #${SECTION_ID} .saree-supporter-name{color:#ffe49a;font-weight:900;font-size:14px;position:relative;z-index:1}.saree-supporter-desc{color:#aeb8bd;font-size:12px;line-height:1.5;margin-top:2px;position:relative;z-index:1}
      @keyframes sareeGoldBorder{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
      @keyframes sareeGoldSweep{0%{transform:translateX(-150%) skewX(-18deg)}65%,100%{transform:translateX(420%) skewX(-18deg)}}
      @keyframes sareeCardShine{0%,35%{transform:translateX(-180%) skewX(-20deg)}70%,100%{transform:translateX(520%) skewX(-20deg)}}
      @keyframes sareeTitleGlow{0%,100%{text-shadow:0 0 5px rgba(246,215,122,.15)}50%{text-shadow:0 0 16px rgba(246,215,122,.6)}}
      @media (prefers-reduced-motion:reduce){#${SECTION_ID} *{animation:none!important}}
      #${ADMIN_ID}{margin-top:12px}#${ADMIN_ID} .os-preview{border:1px solid #2c373c;border-radius:13px;padding:10px;margin-top:10px;background:#0d1418}.os-admin-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 0;border-bottom:1px solid #253035}.os-admin-row:last-child{border-bottom:0}
    `;
    document.head.appendChild(s);
  }

  function findAnchor() {
    const products = $('products');
    if (!products) return null;
    const heading = Array.from(document.querySelectorAll('#home h2')).find(h => /أفضل الأسعار حالياً|أسعار المنتجات|أسعار منتجات سوريا/.test(h.textContent || ''));
    return heading || products;
  }

  function ensureSection() {
    let box = $(SECTION_ID);
    if (box) return box;
    box = document.createElement('section');
    box.id = SECTION_ID;
    box.className = 'saree-os-hidden';
    const anchor = findAnchor();
    if (!anchor) return null;
    if (anchor.id === 'products') anchor.parentNode.insertBefore(box, anchor);
    else anchor.insertAdjacentElement('afterend', box);
    return box;
  }

  function render(data) {
    const box = ensureSection();
    if (!box) return;
    const wa = safeWhatsapp(data.owner_whatsapp_url);
    const supporters = (data.supporters || []).filter(x => x.visible !== false && x.name).sort((a,b) => Number(a.sort_order||0)-Number(b.sort_order||0));
    if (!wa && !supporters.length) { box.classList.add('saree-os-hidden'); box.innerHTML=''; return; }
    box.classList.remove('saree-os-hidden');
    box.innerHTML = `
      ${wa ? `<div class="saree-owner-wa-wrap" dir="rtl"><a class="saree-owner-wa" href="${esc(wa)}" target="_blank" rel="noopener noreferrer" aria-label="واتساب صاحب الموقع" title="واتساب صاحب الموقع"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.52 3.48A11.77 11.77 0 0 0 12.09 0C5.57 0 .27 5.3.27 11.82c0 2.08.54 4.1 1.57 5.89L.17 24l6.44-1.65a11.8 11.8 0 0 0 5.48 1.35h.01c6.52 0 11.82-5.3 11.82-11.82 0-3.16-1.23-6.13-3.4-8.4ZM12.1 21.7h-.01a9.83 9.83 0 0 1-5.01-1.37l-.36-.21-3.82.98 1.02-3.72-.23-.38a9.82 9.82 0 1 1 8.41 4.7Zm5.4-7.36c-.3-.15-1.78-.88-2.05-.98-.27-.1-.47-.15-.67.15-.2.3-.77.98-.94 1.18-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.21 5.09 4.5.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.78-.73 2.03-1.43.25-.7.25-1.3.17-1.43-.07-.12-.27-.2-.57-.35Z"/></svg></a></div>` : ''}
      ${supporters.length ? `<div class="saree-supporters-wrap"><div class="saree-supporters-inner" dir="rtl"><div class="saree-supporters-title"><span>✦ أفضل الداعمين ✦</span></div><div class="saree-supporters-list">${supporters.map(x => `<div class="saree-supporter">${x.image_url ? `<img class="saree-supporter-img" src="${esc(x.image_url)}" alt="${esc(x.name)}" loading="lazy">` : ''}<div><div class="saree-supporter-name">${esc(x.name)}</div>${x.description ? `<div class="saree-supporter-desc">${esc(x.description)}</div>` : ''}</div></div>`).join('')}</div></div></div>` : ''}
    `;
  }

  async function saveOwnerSupporters() {
    if (!isAdmin()) return alert('هذا الخيار للمدير فقط.');
    const current = await readData();
    const value = $('siteWhatsappNew')?.value.trim() || '';
    try { await writeData({ owner_whatsapp_url: value, supporters: current.supporters }); $('siteLinksMsg') && ($('siteLinksMsg').textContent = 'تم حفظ واتساب صاحب الموقع.'); await refresh(); }
    catch (e) { $('siteLinksMsg') && ($('siteLinksMsg').textContent = 'تعذر الحفظ: ' + e.message); }
  }

  async function injectAdmin() {
    if (!isAdmin() || !$('adminPanel') || $(ADMIN_ID)) return;
    const box = document.createElement('section'); box.id=ADMIN_ID; box.className='card'; box.dir='rtl';
    box.innerHTML = `<h2>📱 واتساب صاحب الموقع والداعمون</h2><p class="muted">يتم حفظ هذه البيانات كلها في عمود مستقل، ولا تستخدم إعدادات الروابط القديمة.</p><div class="two"><input id="siteWhatsappNew" placeholder="رقم أو رابط واتساب صاحب الموقع"><input id="osName" placeholder="اسم الداعم"><input id="osDesc" placeholder="وصف مختصر للداعم"><input id="osImage" type="file" accept="image/*"><input id="osOrder" type="number" value="0" placeholder="الترتيب"></div><div class="actions"><button class="btn primary" type="button" id="osSaveWhatsapp">حفظ واتساب صاحب الموقع</button><button class="btn secondary" type="button" id="osAddSupporter">إضافة الداعم</button></div><p id="osMsg" class="muted"></p><div class="os-preview"><b>الداعمون المضافون</b><div id="osList"></div></div>`;
    $('adminPanel').appendChild(box);

    async function load() {
      const data=await readData(); $('siteWhatsappNew').value=data.owner_whatsapp_url||'';
      const list=$('osList'); const arr=[...data.supporters].sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
      list.innerHTML=arr.length?arr.map(x=>`<div class="os-admin-row"><b>${esc(x.name)}</b><span class="pill">${x.visible===false?'مخفي':'ظاهر'}</span>${x.description?`<span class="muted">${esc(x.description)}</span>`:''}<button class="btn danger" type="button" data-id="${esc(x.id)}">حذف</button></div>`).join(''):'<div class="muted" style="margin-top:8px">لا يوجد داعمون حالياً.</div>';
      list.querySelectorAll('button[data-id]').forEach(btn=>btn.onclick=async()=>{const d=await readData();d.supporters=d.supporters.filter(x=>String(x.id)!==String(btn.dataset.id));try{await writeData(d);await load();render(d);}catch(e){alert(e.message)}});
    }
    $('osSaveWhatsapp').onclick=saveOwnerSupporters;
    $('osAddSupporter').onclick=async()=>{
      const name=$('osName')?.value.trim(); if(!name)return alert('اكتب اسم الداعم.');
      let image=''; const file=$('osImage')?.files?.[0];
      if(file&&typeof window.uploadImage==='function'){try{image=await window.uploadImage(file,'supporters');}catch(e){return alert('تعذر رفع الصورة: '+e.message)}}
      const d=await readData(); d.supporters.push({id:'supporter_'+Date.now(),name,description:$('osDesc')?.value.trim()||'',image_url:image,sort_order:Number($('osOrder')?.value||0),visible:true});
      try{await writeData(d);$('osName').value='';$('osDesc').value='';$('osImage').value='';$('osOrder').value='0';$('osMsg').textContent='تمت إضافة الداعم.';await load();render(d);}catch(e){$('osMsg').textContent='تعذر الحفظ: '+e.message}
    };
    await load();
  }

  async function refresh(){const d=await readData();render(d);if(isAdmin())await injectAdmin();return d;}

  async function start(){
    addStyles();
    for(let i=0;i<30&&!window.supabaseClient;i++) await new Promise(r=>setTimeout(r,300));
    if(!window.supabaseClient)return;
    for(let i=0;i<20&&!$('home');i++) await new Promise(r=>setTimeout(r,300));
    await refresh();
    window.sareeOwnerSupportersRefresh=refresh;
    window.saveSiteLinks=saveOwnerSupporters;
    window.loadSiteLinks=async()=>{const d=await readData();const el=$('siteWhatsapp');if(el)el.value=d.owner_whatsapp_url||'';const el2=$('siteWhatsappNew');if(el2)el2.value=d.owner_whatsapp_url||'';};
    const oldRenderAdmin = window.renderAdmin;
    if (typeof oldRenderAdmin === 'function' && !oldRenderAdmin.__sareeOwnerSupportersWrapped) {
      const wrapped = async function(){
        const result = await oldRenderAdmin.apply(this, arguments);
        await injectAdmin();
        return result;
      };
      wrapped.__sareeOwnerSupportersWrapped = true;
      window.renderAdmin = wrapped;
    }
    setInterval(() => { if (isAdmin() && $('adminPanel')) injectAdmin().catch(()=>{}); }, 1200);
  }
  start();
})();
