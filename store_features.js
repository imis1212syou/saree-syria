/* سعرلي سوريا — store_features.js
   النسخة النهائية الموحدة لميزات المتاجر والتجار والشركات والموقع والباركود.
   لا توليد باركود ولا تنزيله. البحث بالباركود معزول حسب المتجر.
*/
(function(){
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const normBarcode = v => String(v ?? '').replace(/\D/g,'').trim();
  const role = () => String(profileData?.role || '').toLowerCase();
  const isAdmin = () => window.__SAREE_ADMIN_STATUS__ === true;
  const canManageStore = storeId => isAdmin() || (
    role() === 'store' &&
    !!profileData?.store_id &&
    String(profileData.store_id) === String(storeId)
  );
  const userStoreId = () => profileData?.store_id || null;
  const storeImage = st => st?.image_url || st?.logo_url || '';
  const storeCompany = st => st?.companies?.name || st?.company_name || st?.company || '';
  const storeWhatsapp = st => st?.whatsapp_url || st?.whatsapp || '';

  const STORE_BARCODE_TABLE = 'store_product_barcodes';
  window.__sareeStoreAdditionalBarcodes = window.__sareeStoreAdditionalBarcodes || [];
  let barcodeValidationToken = 0;
  let barcodeValidationBusy = false;
  let barcodePrimaryUsed = false;
  let barcodeAdditionalUsed = false;

  function activeStoreIdForMaterialForm(){
    if(isAdmin()) return $('merchantStoreSelect')?.value || window.__editingMaterial?.storeId || null;
    return role()==='store' ? (profileData?.store_id || window.__editingMaterial?.storeId || null) : (window.__editingMaterial?.storeId || null);
  }

  function additionalBarcodes(){
    return Array.from(new Set((window.__sareeStoreAdditionalBarcodes || [])
      .map(normBarcode)
      .filter(Boolean)));
  }

  function renderAdditionalBarcodes(){
    const box=$('storeAdditionalBarcodesList');
    if(!box) return;
    const codes=additionalBarcodes();
    box.innerHTML=codes.length
      ? codes.map((code,i)=>`<span class="pill" style="display:inline-flex;align-items:center;gap:6px;margin:3px 3px 0 0">${esc(code)} <button type="button" class="btn secondary" data-remove-store-barcode="${esc(i)}" style="padding:2px 7px;min-width:auto">×</button></span>`).join('')
      : '<span class="muted">لا توجد باركودات إضافية.</span>';
    box.querySelectorAll('[data-remove-store-barcode]').forEach(btn=>btn.onclick=()=>{
      const i=Number(btn.dataset.removeStoreBarcode);
      window.__sareeStoreAdditionalBarcodes.splice(i,1);
      barcodeAdditionalUsed=false;
      if($('storeAdditionalBarcodeMsg')?.textContent==='مستخدم') $('storeAdditionalBarcodeMsg').textContent='';
      renderAdditionalBarcodes();
      syncBarcodeSubmitState();
    });
  }

  function ensureAdditionalBarcodeUI(){
    const host=document.querySelector('.barcodeBox');
    if(!host || $('storeAdditionalBarcodesBox')) return;
    const wrap=document.createElement('div');
    wrap.id='storeAdditionalBarcodesBox';
    wrap.innerHTML=`
      <label class="muted">باركودات إضافية للمادة (اختياري)</label>
      <div class="actions">
        <button type="button" class="btn secondary" id="storeAdditionalBarcodeScanBtn">📷 مسح باركود إضافي بالكاميرا</button>
      </div>
      <p id="storeAdditionalBarcodeMsg" class="muted"></p>
      <div id="storeAdditionalBarcodesList"></div>
    `;
    host.appendChild(wrap);
    $('storeAdditionalBarcodeScanBtn')?.addEventListener('click',()=>{
      const storeId=activeStoreIdForMaterialForm();
      if(!storeId) return alert('اختر المتجر أولاً.');
      if(typeof window.openBarcodeScannerForAdditional!=='function') return alert('ماسح الباركود غير محمّل.');
      window.openBarcodeScannerForAdditional(storeId);
    });
    renderAdditionalBarcodes();
  }

  window.addScannedStoreAdditionalBarcode=async function(value){
    const code=normBarcode(value);
    if(!code) return false;
    ensureAdditionalBarcodeUI();
    const storeId=activeStoreIdForMaterialForm();
    const primary=normBarcode($('barcode')?.value);
    const msg=$('storeAdditionalBarcodeMsg');
    if(primary && primary===code){
      if(msg) msg.textContent='مستخدم';
      barcodeAdditionalUsed=false;
      syncBarcodeSubmitState();
      return false;
    }
    if(additionalBarcodes().includes(code)){
      if(msg) msg.textContent='مستخدم';
      barcodeAdditionalUsed=false;
      syncBarcodeSubmitState();
      return false;
    }
    if(storeId){
      try{
        const used=await storeBarcodeExists(storeId,code,null);
        if(used){
          if(msg) msg.textContent='مستخدم';
          barcodeAdditionalUsed=false;
          syncBarcodeSubmitState();
          return false;
        }
      }catch(err){
        console.warn('store additional barcode live lookup:',err);
      }
    }
    window.__sareeStoreAdditionalBarcodes.push(code);
    barcodeAdditionalUsed=false;
    if(msg) msg.textContent='تمت إضافة الباركود الإضافي: '+code;
    renderAdditionalBarcodes();
    syncBarcodeSubmitState();
    return true;
  };

  async function loadStoreAdditionalBarcodes(storeId,productId){
    window.__sareeStoreAdditionalBarcodes=[];
    ensureAdditionalBarcodeUI();
    if(!storeId || !productId){renderAdditionalBarcodes();return;}
    const {data,error}=await supabaseClient.from(STORE_BARCODE_TABLE)
      .select('barcode').eq('store_id',storeId).eq('product_id',productId);
    if(error) throw error;
    window.__sareeStoreAdditionalBarcodes=(data||[]).map(x=>normBarcode(x.barcode)).filter(Boolean);
    const primary=normBarcode($('barcode')?.value);
    window.__sareeStoreAdditionalBarcodes=additionalBarcodes().filter(x=>x!==primary);
    renderAdditionalBarcodes();
  }

  async function validateAdditionalBarcodes(storeId,productId){
    const desired=additionalBarcodes().filter(code=>code!==normBarcode($('barcode')?.value));
    if(!desired.length) return;
    const rows=await loadApprovedStoreListings(storeId);
    const conflicts=new Set();
    for(const code of desired){
      const conflict=rows.some(r=>String(r.product_id)!==String(productId||'') && rowBarcodeMatches(r,code));
      if(conflict) conflicts.add(code);
    }
    if(conflicts.size){
      window.__sareeStoreAdditionalBarcodes=additionalBarcodes().filter(code=>!conflicts.has(code));
      if($('storeAdditionalBarcodeMsg')) $('storeAdditionalBarcodeMsg').textContent='مستخدم';
      renderAdditionalBarcodes();
    }
    const {error}=await supabaseClient.from(STORE_BARCODE_TABLE).select('barcode').limit(1);
    if(error && !/empty|relation .*store_product_barcodes|schema cache|does not exist/i.test(String(error.message||''))) throw error;
    if(error) throw new Error('يجب تنفيذ SUPABASE_REQUIRED_CHANGES.sql في Supabase لتفعيل الباركودات الإضافية.');
  }

  async function saveStoreAdditionalBarcodes(storeId,productId){
    if(!storeId || !productId) return;
    ensureAdditionalBarcodeUI();
    const desired=additionalBarcodes().filter(code=>code!==normBarcode($('barcode')?.value));
    const {error}=await supabaseClient.rpc('store_set_product_barcodes',{
      p_store_id:String(storeId),
      p_product_id:String(productId),
      p_barcodes:desired
    });
    if(error) throw error;
    window.__sareeStoreAdditionalBarcodes=desired;
    renderAdditionalBarcodes();
  }

  function rowBarcodeMatches(row,code){
    const target=normBarcode(code);
    if(!target) return false;
    if(normBarcode(row?.products?.barcode || row?.barcode || '')===target) return true;
    return Array.isArray(row?.store_product_barcodes) && row.store_product_barcodes.some(x=>normBarcode(x?.barcode)===target);
  }

  window.lookupStoreBarcode = async function(storeId,code){
    const target=normBarcode(code);
    if(!storeId || !target) return {row:null,matchedBy:null};
    const rows=await loadApprovedStoreListings(storeId);
    const primary=rows.find(row=>normBarcode(row?.products?.barcode || row?.barcode || '')===target);
    if(primary) return {row:primary,matchedBy:'primary'};
    const alias=rows.find(row=>Array.isArray(row?.store_product_barcodes) && row.store_product_barcodes.some(x=>normBarcode(x?.barcode)===target));
    return {row:alias||null,matchedBy:alias?'alias':null};
  };

  window.setScannedStoreBarcodeForForm = async function(storeId,code,productId){
    const target=normBarcode(code);
    if(!target) return;
    ensureAdditionalBarcodeUI();
    const primary=normBarcode($('barcode')?.value);
    if(productId && primary!==target){
      try{ await loadStoreAdditionalBarcodes(storeId,productId); }catch(err){ console.warn('load aliases after scan:',err); }
      if(!additionalBarcodes().includes(target)) window.__sareeStoreAdditionalBarcodes.push(target);
      renderAdditionalBarcodes();
      return;
    }
    if($('barcode')) $('barcode').value=target;
  };

  async function loadStoreMaterialCompanyOptions(selectedId){
    const box = $('merchantCompanyBox');
    if(!box) return;
    let list = Array.isArray(window.companies) ? window.companies : [];
    if(!list.length){
      try{
        const {data,error}=await supabaseClient.from('companies').select('id,name').eq('active',true).order('name');
        if(!error) list=data||[];
      }catch(_){}
    }
    // عند التعبئة التلقائية قد تكون الشركة المحفوظة غير موجودة ضمن
    // قائمة الشركات النشطة الحالية. نجلبها بالـ id فقط حتى لا تضيع
    // بيانات الشركة، من دون تغيير صلاحيات أو ربط جديد.
    if(selectedId && !list.some(c => String(c.id) === String(selectedId))){
      try{
        const {data:chosenCompany,error:companyError}=await supabaseClient
          .from('companies').select('id,name').eq('id',selectedId).maybeSingle();
        if(!companyError && chosenCompany) list=[chosenCompany,...list];
      }catch(_){}
    }
    box.innerHTML = `
      <label class="muted">الشركة المرتبطة بالمادة (اختياري)</label>
      <select id="merchantCompanySelect">
        <option value="">بدون شركة</option>
        ${list.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
      </select>
    `;
    if($('merchantCompanySelect')) $('merchantCompanySelect').value = selectedId || '';
  }

  async function loadStoreMaterialCompanyInfo(selectedId){
    const box = $('merchantCompanyBox');
    if(!box) return;
    let name='';
    if(selectedId){
      let list = Array.isArray(window.companies) ? window.companies : [];
      if(!list.length){
        try{
          const {data,error}=await supabaseClient.from('companies').select('id,name').eq('active',true).order('name');
          if(!error) list=data||[];
        }catch(_){}
      }
      name = list.find(c=>String(c.id)===String(selectedId))?.name || '';
    }
    box.innerHTML = `<div class="notice">الشركة المرتبطة بالمادة: <b>${esc(name || (selectedId ? 'شركة محفوظة' : 'بدون شركة'))}</b></div>`;
  }

  const mapsUrl = st => {
    if(st?.latitude != null && st?.longitude != null){
      return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(st.latitude + ',' + st.longitude);
    }
    if(st?.address || st?.city || st?.area){
      return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([st.address,st.area,st.city].filter(Boolean).join(', '));
    }
    return '';
  };

  function qrStoreUrl(id){
    const base = typeof window.storeUrl === 'function' ? window.storeUrl(id) : (window.location.origin+window.location.pathname+'?store='+encodeURIComponent(id));
    return base + (base.includes('?') ? '&' : '?') + 'qr=1';
  }
  function removeEntityQrFloat(){
    $('sareeEntityQrFloat')?.remove();
  }

  function entityQrUrl(type,id){
    try{
      const u=new URL(window.location.href);
      u.searchParams.delete('store');
      u.searchParams.delete('company');
      u.searchParams.set(type==='company'?'company':'store',String(id));
      u.searchParams.set('qr','1');
      return u.toString();
    }catch(_){
      return window.location.origin+window.location.pathname+'?'+(type==='company'?'company':'store')+'='+encodeURIComponent(id)+'&qr=1';
    }
  }

  window.sareeShowEntityQrFloat=function(entityType,id,name){
    removeEntityQrFloat();
    if(typeof QRCode==='undefined' || !id) return;
    const host = entityType==='store'
      ? document.querySelector('#storeDetailBody .storeHeroCard')
      : document.querySelector('#companyDetailBody > .card');
    if(!host) return;
    const wrap=document.createElement('div');
    wrap.id='sareeEntityQrFloat';
    wrap.setAttribute('aria-label','QR '+String(name||''));
    wrap.setAttribute('role','button');
    wrap.setAttribute('tabindex','0');
    wrap.title='اضغط على QR للطباعة';
    wrap.style.cssText='float:left!important;position:relative!important;left:auto!important;top:auto!important;z-index:1!important;width:clamp(126px,28vw,136px)!important;height:auto!important;padding:7px!important;margin:8px 12px 8px 0!important;background:#fff!important;border:1px solid rgba(24,70,86,.18)!important;border-radius:14px!important;box-shadow:0 4px 14px rgba(0,0,0,.10)!important;box-sizing:border-box!important;text-align:center!important;direction:rtl!important;pointer-events:auto!important;overflow:hidden!important;clear:none!important;cursor:pointer!important;';
    const printQr=function(){
      try{
        if(entityType==='company' && typeof window.printCompanyQR==='function') window.printCompanyQR(id);
        else if(entityType==='store' && typeof window.printStoreQR==='function') window.printStoreQR(id);
      }catch(err){ console.warn('QR print:',err); }
    };
    wrap.addEventListener('click',printQr);
    wrap.addEventListener('keydown',e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); printQr(); } });
    const box=document.createElement('div');
    box.id='sareeEntityQrFloatBox';
    box.style.cssText='width:100%!important;height:auto!important;aspect-ratio:1/1!important;display:flex!important;align-items:center!important;justify-content:center!important;margin:0 auto!important;padding:0!important;box-sizing:border-box!important;overflow:hidden!important;';
    const label=document.createElement('div');
    label.textContent='QR';
    label.style.cssText='margin:4px 0 0!important;height:17px!important;line-height:17px!important;color:#1f4f63!important;font:700 15px/17px Arial,sans-serif!important;';
    wrap.appendChild(box);
    wrap.appendChild(label);
    host.insertBefore(wrap,host.firstChild);
    try{
      const qrSize=Math.max(100,Math.min(124,Math.round((host.clientWidth||480)*0.25)));
      new QRCode(box,{text:entityQrUrl(entityType,id),width:qrSize,height:qrSize,correctLevel:QRCode.CorrectLevel?.H ?? 2});
      box.querySelectorAll('img,canvas').forEach(node=>{
        node.style.setProperty('width','100%','important');
        node.style.setProperty('height','100%','important');
        node.style.setProperty('max-width','100%','important');
        node.style.setProperty('max-height','100%','important');
        node.style.setProperty('display','block','important');
      });
    }catch(err){
      console.warn('entity QR inline:',err);
      removeEntityQrFloat();
    }
  };

  function syncEntityQrFloat(){
    const storePage=$('storeDetail')?.classList.contains('active');
    const companyPage=$('companyDetail')?.classList.contains('active');
    if(storePage){
      const id=new URLSearchParams(location.search).get('store');
      if(id) window.sareeShowEntityQrFloat('store',id,$('storeDetailName')?.textContent||'المتجر');
      return;
    }
    if(companyPage){
      const id=new URLSearchParams(location.search).get('company');
      if(id) window.sareeShowEntityQrFloat('company',id,$('companyDetailName')?.textContent||'الشركة');
      return;
    }
    removeEntityQrFloat();
  }

  const entityQrObserver=new MutationObserver(syncEntityQrFloat);
  entityQrObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('popstate',()=>setTimeout(syncEntityQrFloat,0));

  function visitorId(){
    try{
      let id=localStorage.getItem('saree_visitor_id');
      if(!id){id=(crypto.randomUUID?crypto.randomUUID():('v_'+Date.now()+'_'+Math.random().toString(36).slice(2)));localStorage.setItem('saree_visitor_id',id);}
      return id;
    }catch(_){ return 'v_'+Date.now()+'_'+Math.random().toString(36).slice(2); }
  }
  window.recordSareeQrVisit = async function(entityType,entityId){
    if(!entityType || !entityId || !window.supabaseClient) return false;
    try{const {error}=await supabaseClient.rpc('record_qr_visit',{p_entity_type:String(entityType),p_entity_id:String(entityId),p_visitor_id:visitorId()});if(error)throw error;return true;}catch(err){console.warn('QR visit:',err);return false;}
  };
  window.getSareeQrVisitCount = async function(entityType,entityId){
    if(!entityType || !entityId || !window.supabaseClient) return null;
    try{const {data,error}=await supabaseClient.rpc('qr_owner_visit_count',{p_entity_type:String(entityType),p_entity_id:String(entityId)});if(error)throw error;const n=Number(data||0);return Number.isFinite(n)?n:null;}catch(err){console.warn('QR visit count:',err);return null;}
  };

  window.getSareeSiteVisitCount = async function(){
    if(!window.supabaseClient) return null;
    try{
      const {data,error}=await supabaseClient.rpc('owner_site_visit_count');
      if(error) throw error;
      const n=Number(data||0);
      return Number.isFinite(n)?n:null;
    }catch(err){
      console.warn('site visit count:',err);
      return null;
    }
  };

  window.__sareeLocation = window.__sareeLocation || {lat:null,lng:null,requested:false,ready:false};

  function haversine(lat1,lon1,lat2,lon2){
    const rad = n => Number(n) * Math.PI / 180;
    const R = 6371;
    const dLat = rad(lat2-lat1);
    const dLon = rad(lon2-lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function distanceText(st){
    const loc = window.__sareeLocation;
    if(!loc || loc.lat == null || loc.lng == null || st?.latitude == null || st?.longitude == null) return '';
    const km = haversine(loc.lat,loc.lng,Number(st.latitude),Number(st.longitude));
    return km < 1 ? Math.round(km*1000) + ' م' : km.toFixed(1) + ' كم';
  }

  function updateDistancesInPlace(){
    document.querySelectorAll('[data-store-distance]').forEach(node => {
      const st = (stores || []).find(s => String(s.id) === String(node.dataset.storeDistance));
      if(!st) return;
      const txt = distanceText(st);
      node.textContent = txt ? '📏 ' + txt : '';
      node.classList.toggle('hidden', !txt);
    });
  }

  window.requestSareeLocation = function(){
    const state = window.__sareeLocation;
    if(state.requested){ updateDistancesInPlace(); return; }
    state.requested = true;
    if(!navigator.geolocation){ return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        state.lat = pos.coords.latitude;
        state.lng = pos.coords.longitude;
        state.ready = true;
        updateDistancesInPlace();
      },
      () => { state.ready = false; },
      {enableHighAccuracy:false,timeout:9000,maximumAge:300000}
    );
  };

  async function refreshStores(){
    const {data,error} = await supabaseClient.from('stores').select('*,companies(id,name)').eq('active',true).order('name');
    if(error) throw error;
    stores = Array.isArray(data) ? data : [];
    return stores;
  }

  function companyCard(company, list){
    const name = company || 'متاجر مستقلة';
    return `<div class="card">
      <div class="pill companyBadge">🏢 ${esc(name)}</div>
      <div class="name">${list.length} ${list.length === 1 ? 'متجر' : 'متاجر'}</div>
      <div class="muted">عرض معلومات الشركة والمتاجر المرتبطة بها.</div>
      <button type="button" class="btn secondary" data-company-open="${esc(company || '')}">صفحة الشركة</button>
    </div>`;
  }

  window.openCompany = function(companyName){
    const name = String(companyName || '').trim();
    const list = (stores || []).filter(st => (storeCompany(st) || '').trim() === name);
    if(!name){
      const independent = (stores || []).filter(st => !storeCompany(st));
      return renderCompanyDetail('متاجر مستقلة', independent);
    }
    renderCompanyDetail(name,list);
  };

  function renderCompanyDetail(name,list){
    if(!$('companyDetail')) return;
    $('companyDetailName').textContent = name || 'الشركة';
    $('companyDetailBody').innerHTML = `
      <div class="card">
        <span class="pill companyBadge">🏢 ${esc(name || 'متاجر مستقلة')}</span>
        <div class="name">${list.length} متاجر</div>
        <p class="muted">هذه الصفحة تجمع المتاجر التابعة للشركة وتعرض بياناتها الأساسية ووسائل التواصل المتاحة.</p>
      </div>
      <div class="grid">
        ${list.length ? list.map(renderStoreCard).join('') : '<div class="card muted">لا توجد متاجر مسجلة تحت هذه الشركة.</div>'}
      </div>`;
    window.show('companyDetail');
    window.scrollTo(0,0);
  }

  function renderStoreCard(st){
    const img = storeImage(st);
    const company = storeCompany(st);
    const wa = storeWhatsapp(st);
    const maps = mapsUrl(st);
    return `<article class="card storeCard">
      ${img ? `<img class="img storeLogo" src="${esc(img)}" alt="شعار ${esc(st.name || 'المتجر')}" loading="lazy">` : '<div class="storeLogoPlaceholder">سعرلي سوريا</div>'}
      <div class="row" style="justify-content:space-between;align-items:center">
        <div class="name">${esc(st.name || 'متجر')}</div>
        ${st.verified ? '<span class="pill">✓ موثّق</span>' : ''}
      </div>
      ${company ? `<button type="button" class="pill companyBadge companyButton" data-company-open="${esc(company)}">🏢 ${esc(company)}</button>` : ''}
      <div class="muted">${esc([st.city,st.area].filter(Boolean).join(' — '))}</div>
      ${st.address ? `<div class="muted">📍 ${esc(st.address)}</div>` : ''}
      ${st.phone ? `<div class="muted">📞 ${esc(st.phone)}</div>` : ''}
      ${st.opening_hours ? `<div class="muted">🕐 ${esc(st.opening_hours)}</div>` : ''}
      <div class="pill store-distance hidden" data-store-distance="${esc(st.id)}"></div>
      <div class="actions">
        <button type="button" class="btn primary" data-store-open="${esc(st.id)}">فتح صفحة المتجر</button>
        ${maps ? `<button type="button" class="btn secondary" data-map-open="${esc(maps)}">الاتجاهات</button>` : ''}
        ${wa ? `<a class="btn secondary" href="${esc(wa)}" target="_blank" rel="noopener">💬 واتساب</a>` : ''}
      </div>
    </article>`;
  }

  window.renderStores = async function(){
    const box = $('storesList');
    if(!box) return;
    try{ await refreshStores(); }catch(err){ console.warn('stores:',err); }
    const list = Array.isArray(stores) ? stores : [];
    const companies = new Map();
    list.forEach(st => {
      const key = storeCompany(st).trim();
      if(!companies.has(key)) companies.set(key,[]);
      companies.get(key).push(st);
    });
    const companyBox = $('companiesList');
    if(companyBox){
      companyBox.innerHTML = Array.from(companies.entries()).filter(([k])=>k).map(([k,v])=>companyCard(k,v)).join('') || '<div class="card muted">لا توجد شركات مسجلة بعد.</div>';
    }
    box.innerHTML = list.length ? list.map(renderStoreCard).join('') : '<div class="card muted">لا توجد متاجر حالياً.</div>';
    bindStoreListEvents(box);
    if(companyBox) bindStoreListEvents(companyBox);
    updateDistancesInPlace();
  };

  function bindStoreListEvents(root){
    root.querySelectorAll('[data-store-open]').forEach(btn=>btn.onclick=()=>window.openStore(btn.dataset.storeOpen));
    root.querySelectorAll('[data-map-open]').forEach(btn=>btn.onclick=()=>window.open(btn.dataset.mapOpen,'_blank','noopener'));
    root.querySelectorAll('[data-company-open]').forEach(btn=>btn.onclick=()=>window.openCompany(btn.dataset.companyOpen));
  }

  function priceNumber(row){ return Number(row?.price_new ?? row?.price ?? 0); }
  function priceOld(v){ return typeof window.old === 'function' ? window.old(v) : Number(v||0)*100; }
  function fmt(v){ return typeof window.f === 'function' ? window.f(v) : Number(v||0).toLocaleString('en-US',{maximumFractionDigits:2}); }

  window.renderProducts = function(){
    const q=(document.getElementById('search')?.value||'').trim().toLowerCase();
    const city=document.getElementById('cityFilter')?.value||'';
    const cat=document.getElementById('catFilter')?.value||'';
    const list=(products||[]).map(p=>{
      const ps=(prices||[]).filter(x=>String(x.product_id)===String(p.id) && x.approved===true && x.price_new!=null).sort((a,b)=>Number(a.price_new)-Number(b.price_new));
      return {p,ps,c:ps[0]||null};
    }).filter(x=>{
      if(!x.c) return false;
      const p=x.p;
      const txt=[p.name,p.description,p.brand,p.category,p.unit].join(' ').toLowerCase();
      const cityOk=!city || x.ps.some(row=>String(row.stores?.city||'')===String(city)||String(row.stores?.area||'')===String(city));
      return (!q||txt.includes(q)) && (!cat||p.category===cat) && cityOk;
    });
    const box=document.getElementById('products');
    if(!box) return;
    box.innerHTML=list.map(({p,ps,c})=>{
      const fav=favorites.includes(p.id);
      return `<article class="card">${p.image_url?`<img class="img" src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`:''}<span class="pill">${esc(p.category||'عام')}</span><div class="name">${esc(p.name||'مادة')}</div><div class="muted">${esc(p.unit||'')} ${p.brand?'• '+esc(p.brand):''}</div><div class="price">${fmt(priceNumber(c))} ل.س جديدة</div><div class="old">${priceOld(priceNumber(c))} ل.س قديمة</div><div class="meta"><span>الأرخص: ${esc(c.stores?.name||'')}</span><span>${esc(c.stores?.city||'')}</span></div><div class="meta"><span>${ps.length} متاجر</span><span>آخر تحديث: ${c.updated_at?esc(new Date(c.updated_at).toLocaleDateString('ar')):'—'}</span></div><div class="actions"><button class="btn secondary" onclick="toggleFav('${esc(p.id)}')">${fav?'★ إزالة من المفضلة':'☆ أضف للمفضلة'}</button><button class="btn primary" onclick="window.sareeOpenProductInfo?.('${esc(p.id)}')">تفاصيل الأسعار</button><button class="btn secondary" onclick="addBasket('${esc(p.id)}')">أضف للسلة</button></div></article>`;
    }).join('') || '<div class="card muted">لا توجد مواد لها أسعار معتمدة حالياً.</div>';
  };

  async function loadApprovedStoreListings(storeId){
    const {data,error} = await supabaseClient
      .from('price_listings')
      .select('*,products(*)')
      .eq('store_id',storeId)
      .eq('approved',true)
      .order('updated_at',{ascending:false});
    if(error) throw error;
    const rows=Array.isArray(data) ? data : [];
    if(!rows.length) return rows;
    const productIds=[...new Set(rows.map(r=>r.product_id).filter(Boolean))];
    if(!productIds.length) return rows;
    const {data:aliases,error:aliasError}=await supabaseClient.from(STORE_BARCODE_TABLE)
      .select('store_id,product_id,barcode')
      .eq('store_id',storeId).in('product_id',productIds);
    if(aliasError){
      if(/relation .*store_product_barcodes|schema cache|does not exist/i.test(String(aliasError.message||''))) {
        rows.forEach(r=>{r.store_product_barcodes=[];});
        return rows;
      }
      throw aliasError;
    }
    const byProduct=new Map();
    (aliases||[]).forEach(a=>{const k=String(a.product_id);if(!byProduct.has(k))byProduct.set(k,[]);byProduct.get(k).push(a);});
    rows.forEach(r=>{r.store_product_barcodes=byProduct.get(String(r.product_id))||[];});
    return rows;
  }

  function uniqueListings(list){
    const byProduct = new Map();
    list.forEach(row=>{
      const key = String(row.product_id || row.id);
      if(!byProduct.has(key)) byProduct.set(key,row);
    });
    return Array.from(byProduct.values());
  }

  function renderStorePriceCards(list,storeId){
    const rows = uniqueListings(list);
    const canEdit = canManageStore(storeId);
    if(!rows.length) return '<div class="card muted">لا توجد أسعار معتمدة لهذا المتجر حالياً.</div>';
    return rows.map(row=>{
      const p = row.products || {};
      const barcode = normBarcode(p.barcode || row.barcode || '');
      return `<article class="card storeProductCard" data-product-id="${esc(p.id || row.product_id || '')}">
        ${p.image_url ? `<img class="img materialImage" src="${esc(p.image_url)}" alt="${esc(p.name || 'مادة')}" loading="lazy">` : ''}
        <span class="pill">${esc(p.category || 'عام')}</span>
        <div class="name">${esc(p.name || 'مادة')}</div>
        ${p.brand ? `<div class="muted">${esc(p.brand)}</div>` : ''}
        ${p.unit ? `<div class="muted">${esc(p.unit)}</div>` : ''}
        ${barcode ? `<div class="muted">باركود: ${esc(barcode)}</div>` : ''}
        <div class="price">${fmt(priceNumber(row))} ل.س جديدة</div>
        <div class="old">${priceOld(priceNumber(row))} ل.س قديمة</div>
        <div class="muted">آخر تحديث: ${row.updated_at ? esc(new Date(row.updated_at).toLocaleString('ar')) : '—'}</div>
        ${canEdit ? `<div class="actions"><button type="button" class="btn secondary" data-edit-listing="${esc(row.id)}" data-store-id="${esc(storeId)}">تعديل المادة</button><button type="button" class="btn danger" data-delete-listing="${esc(row.id)}" data-store-id="${esc(storeId)}">حذف من المتجر</button></div>` : ''}
      </article>`;
    }).join('');
  }

  window.renderStoreDetail = async function(id){
    const body = $('storeDetailBody');
    const title = $('storeDetailName');
    if(!body || !title) return;
    const storeId = id || new URLSearchParams(location.search).get('store');
    if(!storeId){ title.textContent='المتجر'; body.innerHTML='<div class="card muted">لم يتم تحديد المتجر.</div>'; return; }
    try{ await refreshStores(); }catch(err){ console.warn('stores:',err); }
    const st = (stores || []).find(x=>String(x.id)===String(storeId));
    if(!st){ title.textContent='المتجر'; body.innerHTML='<div class="card muted">المتجر غير موجود أو غير متاح حالياً.</div>'; return; }
    if(typeof window.recordStoreVisit==='function') window.recordStoreVisit(st.id).catch(()=>{});
    const qrMode=new URLSearchParams(location.search).get('qr')==='1';
    if(qrMode && typeof window.recordSareeQrVisit==='function') window.recordSareeQrVisit('store',st.id).catch(()=>{});
    title.textContent = st.name || 'المتجر';
    let listings=[];
    try{ listings = await loadApprovedStoreListings(st.id); }catch(err){ console.warn('store listings:',err); }
    const company = storeCompany(st);
    const img = storeImage(st);
    const wa = storeWhatsapp(st);
    const maps = mapsUrl(st);
    body.innerHTML = `
      <div class="card storeHeroCard">
        ${img ? `<img class="img storeDetailLogo" src="${esc(img)}" alt="شعار ${esc(st.name||'المتجر')}">` : ''}
        <div class="row" style="justify-content:space-between;align-items:center">
          <h2>${esc(st.name || 'المتجر')}</h2>${st.verified?'<span class="pill">✓ موثّق</span>':''}
        </div>
        ${company ? `<button type="button" class="pill companyBadge companyButton" id="storeCompanyBtn">🏢 ${esc(company)}</button>` : ''}
        ${[st.city,st.area].filter(Boolean).length ? `<p class="muted">📍 ${esc([st.city,st.area].filter(Boolean).join(' — '))}</p>` : ''}
        ${st.address ? `<p class="muted">📍 العنوان: ${esc(st.address)}</p>` : ''}
        ${st.phone ? `<div class="actions"><a class="btn secondary" href="tel:${esc(st.phone)}">📞 الهاتف</a></div>` : ''}
        ${wa ? `<div class="actions"><a class="btn primary" href="${esc(wa)}" target="_blank" rel="noopener">💬 واتساب المتجر</a></div>` : ''}
        ${st.opening_hours ? `<p class="muted">🕐 ساعات الدوام: ${esc(st.opening_hours)}</p>` : ''}
        ${st.working_days ? `<p class="muted">📅 أيام العمل: ${esc(st.working_days)}</p>` : ''}
        ${maps ? `<button type="button" class="btn secondary" id="storeDirectionsBtn">موقع واتجاه المتجر</button>` : ''}
        ${canManageStore(st.id) ? `<div class="actions"><button type="button" class="btn secondary" id="storeOwnerEditBtn">✏️ تعديل المتجر</button><span class="notice" style="margin-top:0">👁️ إجمالي زوار المتجر: <b id="storeSiteTotalVisitCount">—</b></span><span class="notice" style="margin-top:0">📱 زوار QR: <b id="storeQrVisitCount">—</b></span></div>` : ''}
      </div>
      <div class="card">
        <h3>بحث بالباركود داخل هذا المتجر فقط</h3>
        <p class="muted">النتيجة تُبحث ضمن الأسعار المعتمدة لهذا المتجر فقط، حتى لو كان الرقم نفسه موجوداً في متجر آخر.</p>
        <div class="barcodeSearch">
          <input id="storeBarcodeSearch" inputmode="numeric" autocomplete="off" placeholder="أدخل رقم الباركود">
          <button type="button" class="btn secondary" id="storeBarcodeCamera">📷</button>
          <button type="button" class="btn primary" id="storeBarcodeSearchBtn">بحث</button>
        </div>
        <div id="storeBarcodeMsg" class="muted"></div>
        <div id="storeBarcodeResult"></div>
      </div>
      <div class="card">
        <h3>أسعار المتجر (${uniqueListings(listings).length})</h3>
        <div id="storeProductsGrid" class="grid">${renderStorePriceCards(listings,st.id)}</div>
      </div>`;

    window.sareeShowEntityQrFloat?.('store',st.id,st.name||'المتجر');

    $('storeCompanyBtn')?.addEventListener('click',()=>company && window.openCompanyById ? window.openCompanyById(st.company_id) : window.openCompany?.(company));
    $('storeDirectionsBtn')?.addEventListener('click',()=>window.open(maps,'_blank','noopener'));
    $('storeOwnerEditBtn')?.addEventListener('click',()=>{ if(isAdmin()) window.openAdminStoreEdit?.(st.id); else window.openMerchantStoreEdit?.(st.id); });
    if(canManageStore(st.id)){
      const loadStoreTotal=async()=>{
        try{
          let total=null;
          if(isAdmin()){
            const {data,error}=await supabaseClient.rpc('admin_store_visitor_counts');
            if(!error && Array.isArray(data)){
              const row=data.find(x=>String(x.store_id)===String(st.id));
              if(row) total=Number(row.visitor_count||0);
            }
          }else{
            const {data,error}=await supabaseClient.rpc('merchant_store_visitor_count',{p_store_id:st.id});
            if(!error) total=Number(data||0);
          }
          if($('storeSiteTotalVisitCount')) $('storeSiteTotalVisitCount').textContent=(total!=null && Number.isFinite(total))?fmt(total):'—';
        }catch(_){ }
      };
      loadStoreTotal();
    }
    if(canManageStore(st.id) && typeof window.getSareeQrVisitCount==='function') window.getSareeQrVisitCount('store',st.id).then(n=>{ if($('storeQrVisitCount')) $('storeQrVisitCount').textContent=n==null?'—':fmt(n); });
    $('storeBarcodeSearchBtn')?.addEventListener('click',()=>window.searchStoreBarcode(st.id));
    $('storeBarcodeSearch')?.addEventListener('keydown',ev=>{ if(ev.key==='Enter') window.searchStoreBarcode(st.id); });
    $('storeBarcodeCamera')?.addEventListener('click',()=>window.openBarcodeScannerForStore ? window.openBarcodeScannerForStore(st.id) : alert('ماسح الباركود غير محمّل.'));
    bindMaterialActions(body);
  };

  function bindMaterialActions(root){
    root.querySelectorAll('[data-edit-listing]').forEach(btn=>btn.onclick=()=>window.editStoreMaterial(btn.dataset.editListing,btn.dataset.storeId));
    root.querySelectorAll('[data-delete-listing]').forEach(btn=>btn.onclick=()=>window.deleteStoreMaterial(btn.dataset.deleteListing,btn.dataset.storeId));
  }

  window.searchStoreBarcode = async function(storeId,value){
    const input = $('storeBarcodeSearch');
    const msg = $('storeBarcodeMsg');
    const result = $('storeBarcodeResult');
    const code = normBarcode(value ?? input?.value);
    if(!code){ if(msg) msg.textContent='أدخل رقم الباركود أو امسحه بالكاميرا.'; if(result) result.innerHTML=''; return; }
    if(input) input.value = code;
    if(msg) msg.textContent='جاري البحث داخل هذا المتجر فقط...';
    if(result) result.innerHTML='';
    try{
      const found=await window.lookupStoreBarcode(storeId,code);
      const unique=found.row ? uniqueListings([found.row]) : [];
      if(!unique.length){
        if(msg) msg.textContent='لا توجد مادة بهذا الباركود في هذا المتجر.';
        if(result) result.innerHTML='<div class="card muted">لم يتم العثور على المادة داخل هذا المتجر.</div>';
        return;
      }
      const row = unique[0];
      const p = row.products || {};
      if(msg) msg.textContent='تم العثور على مادة واحدة ضمن هذا المتجر.';
      if(result) result.innerHTML = renderStorePriceCards([row],storeId);
      bindMaterialActions(result);
    }catch(err){
      console.error(err);
      if(msg) msg.textContent='تعذر البحث عن الباركود حالياً.';
    }
  };

  window.handleStoreBarcodeScan = function(value,storeId){
    const sid = storeId || window.currentStoreId || new URLSearchParams(location.search).get('store');
    if(!sid) return;
    window.searchStoreBarcode(sid,value);
  };

  async function ensureCurrentUser(){
    const {data:{user}} = await supabaseClient.auth.getUser();
    if(!user) throw new Error('يجب تسجيل الدخول.');
    return user;
  }

  async function productUsedByOtherStores(productId,storeId){
    const {data,error}=await supabaseClient.from('price_listings').select('store_id').eq('product_id',productId).neq('store_id',storeId).limit(1);
    if(error) throw error;
    return Array.isArray(data)&&data.length>0;
  }
  async function storeBarcodeExists(storeId,code,excludeProductId){
    const barcode = normBarcode(code);
    if(!storeId || !barcode) return false;
    const rows = await loadApprovedStoreListings(storeId);
    return rows.some(r => {
      if(excludeProductId && String(r.product_id)===String(excludeProductId)) return false;
      return rowBarcodeMatches(r,barcode);
    });
  }

  function syncBarcodeSubmitState(){
    const btn=$('addSubmitBtn');
    if(btn) btn.disabled=Boolean(barcodeValidationBusy || barcodePrimaryUsed);
  }

  function resetBarcodeValidationState(){
    barcodeValidationToken++;
    barcodeValidationBusy=false;
    barcodePrimaryUsed=false;
    barcodeAdditionalUsed=false;
    syncBarcodeSubmitState();
  }

  window.validateStorePrimaryBarcode=async function(){
    const input=$('barcode');
    if(!input){
      barcodePrimaryUsed=false;
      barcodeValidationBusy=false;
      syncBarcodeSubmitState();
      return true;
    }
    const code=normBarcode(input.value);
    const storeId=activeStoreIdForMaterialForm();
    const editing=window.__editingMaterial;
    const currentPrimary=normBarcode(editing?.originalBarcode||'');
    const token=++barcodeValidationToken;
    barcodePrimaryUsed=false;

    if(!code || !storeId){
      barcodeValidationBusy=false;
      if($('barcodeMsg')?.textContent==='مستخدم في المتجر') $('barcodeMsg').textContent='';
      syncBarcodeSubmitState();
      return true;
    }

    // أثناء التعديل، الباركود الأساسي الحالي نفسه ليس تكراراً.
    if(editing && currentPrimary && code===currentPrimary){
      barcodeValidationBusy=false;
      if($('barcodeMsg')?.textContent==='مستخدم في المتجر') $('barcodeMsg').textContent='';
      syncBarcodeSubmitState();
      return true;
    }

    // ممنوع أن يساوي الباركود الأساسي باركوداً إضافياً للمادة نفسها.
    if(additionalBarcodes().includes(code)){
      barcodePrimaryUsed=true;
      if($('barcodeMsg')) $('barcodeMsg').textContent='مستخدم في المتجر';
      syncBarcodeSubmitState();
      return false;
    }

    barcodeValidationBusy=true;
    syncBarcodeSubmitState();
    try{
      // لا نستثني المادة الحالية هنا: أي تكرار داخل المتجر مرفوض.
      const used=await storeBarcodeExists(storeId,code,null);
      if(token!==barcodeValidationToken) return false;
      barcodePrimaryUsed=Boolean(used);
      if($('barcodeMsg')){
        if(used) $('barcodeMsg').textContent='مستخدم في المتجر';
        else if($('barcodeMsg').textContent==='مستخدم في المتجر') $('barcodeMsg').textContent='';
      }
      syncBarcodeSubmitState();
      return !barcodePrimaryUsed;
    }catch(err){
      if(token===barcodeValidationToken){
        barcodePrimaryUsed=false;
        barcodeValidationBusy=false;
        syncBarcodeSubmitState();
      }
      console.warn('store barcode live validation:',err);
      return true;
    }finally{
      if(token===barcodeValidationToken){
        barcodeValidationBusy=false;
        syncBarcodeSubmitState();
      }
    }
  };

  function bindStoreBarcodeLiveValidation(){
    const input=$('barcode');
    if(input && !input.dataset.storeBarcodeValidationBound){
      input.dataset.storeBarcodeValidationBound='1';
      input.addEventListener('input',()=>window.validateStorePrimaryBarcode());
      input.addEventListener('change',()=>window.validateStorePrimaryBarcode());
      input.addEventListener('blur',()=>window.validateStorePrimaryBarcode());
    }
    syncBarcodeSubmitState();
  }

  function resetMaterialForm(){
    window.__editingMaterial = null;
    window.__sareeStoreAdditionalBarcodes=[];
    resetBarcodeValidationState();
    ['pn','brand','unit','cat','pr','barcode','addMsg','barcodeMsg'].forEach(id=>{ if($(id)) $(id).value=''; if($(id)) $(id).textContent=''; });
    if($('pimg')) $('pimg').value='';
    window.__barcodeTemplateImageUrl=null;
    if($('barcodeTemplateImagePreview')) $('barcodeTemplateImagePreview').innerHTML='';
    if($('existingProduct')) $('existingProduct').value='';
    if($('merchantCompanySelect')) $('merchantCompanySelect').value='';
    if($('addHeading')) $('addHeading').textContent='إضافة مادة أو سعر';
    if($('addSubmitBtn')) $('addSubmitBtn').textContent='إرسال للمراجعة';
    ['pn','brand','unit','cat'].forEach(id=>{ if($(id)) $(id).disabled=false; });
    renderAdditionalBarcodes();
  }

  window.showAdd = async function(){
    ensureAdditionalBarcodeUI();
    if(!profileData) return alert('هذه الميزة للحسابات المصرح لها فقط.');
    if(isAdmin()){
      window.__editingMaterial = null;
      window.show('add');
      const options = '<option value="">اختر المتجر</option>' + (stores||[]).map(st=>`<option value="${esc(st.id)}">${esc(st.name)}${st.city?' — '+esc(st.city):''}</option>`).join('');
      $('merchantStoreBox').innerHTML = `<label class="muted">المتجر المستهدف</label><select id="merchantStoreSelect">${options}</select>`;
      await loadStoreMaterialCompanyOptions('');
      window.__sareeStoreAdditionalBarcodes=[];
      renderAdditionalBarcodes();
      $('addHeading').textContent='إضافة مادة أو سعر';
      $('addSubmitBtn').textContent='إضافة ونشر';
      return;
    }
    if(role()!=='store' || !profileData.store_id){
      return alert('الحساب غير مرتبط بمتجر بعد.');
    }
    const st=(stores||[]).find(s=>String(s.id)===String(profileData.store_id));
    window.__editingMaterial = null;
    resetBarcodeValidationState();
    window.show('add');
    $('merchantStoreBox').innerHTML=`<div class="notice">المتجر المرتبط: <b>${esc(st?.name||'غير ظاهر')}</b></div>`;
    await loadStoreMaterialCompanyOptions('');
    window.__sareeStoreAdditionalBarcodes=[];
    renderAdditionalBarcodes();
    $('addHeading').textContent='إضافة مادة أو سعر';
    $('addSubmitBtn').textContent='إضافة ونشر';
  };

  window.editStoreMaterial = async function(listingId,storeId){
    if(!canManageStore(storeId)) return alert('ليس لديك صلاحية تعديل مواد هذا المتجر.');
    try{
      const {data,error} = await supabaseClient.from('price_listings').select('id,store_id,product_id,price_new,price,products(*)').eq('id',listingId).eq('store_id',storeId).single();
      if(error) throw error;
      if(!data) throw new Error('لم يتم العثور على المادة.');
      const p=data.products||{};
      window.__editingMaterial={listingId,storeId,productId:data.product_id,companyId:p.company_id||null,originalBarcode:normBarcode(p.barcode||data.barcode||'')};
      window.show('add');
      $('existingProduct').value='';
      ['pn','brand','unit','cat'].forEach(id=>{ if($(id)) $(id).disabled=false; });
      $('pn').value=p.name||'';
      $('brand').value=p.brand||'';
      $('unit').value=p.unit||'';
      $('cat').value=p.category||'عام';
      $('barcode').value=normBarcode(p.barcode||data.barcode||'');
      resetBarcodeValidationState();
      $('pr').value=Number(data.price_new ?? data.price ?? 0);
      $('merchantStoreBox').innerHTML = `<div class="notice">تعديل مادة من متجر: <b>${esc((stores||[]).find(s=>String(s.id)===String(storeId))?.name||storeId)}</b>${p.image_url?'<br>الصورة الحالية محفوظة ما لم تختر صورة جديدة.':''}</div>`;
      await loadStoreMaterialCompanyOptions(p.company_id||'');
      await loadStoreAdditionalBarcodes(storeId,data.product_id);
      await window.validateStorePrimaryBarcode?.();
      $('addHeading').textContent='تعديل المادة أو السعر';
      $('addSubmitBtn').textContent='حفظ التعديلات';
      $('addMsg').textContent='';
      window.__editingMaterial.currentImageUrl=p.image_url||null;
    }catch(err){ console.error(err); alert('تعذر فتح المادة للتعديل: '+(err.message||'خطأ غير معروف')); }
  };

  window.deleteStoreMaterial = async function(listingId,storeId){
    if(!canManageStore(storeId)) return alert('ليس لديك صلاحية حذف مواد هذا المتجر.');
    if(!confirm('هل أنت متأكد من حذف المادة من هذا المتجر؟')) return;
    try{
      const {data:listing,error:listingError}=await supabaseClient.from('price_listings').select('product_id').eq('id',listingId).eq('store_id',storeId).single();
      if(listingError) throw listingError;
      const {error:barcodeError}=await supabaseClient.rpc('store_set_product_barcodes',{
        p_store_id:String(storeId),
        p_product_id:String(listing.product_id),
        p_barcodes:[]
      });
      if(barcodeError) throw barcodeError;
      const {error}=await supabaseClient.from('price_listings').delete().eq('id',listingId).eq('store_id',storeId);
      if(error) throw error;
      // حدّث نسخة الأسعار الموجودة في الذاكرة فور نجاح الحذف، حتى لا يبقى المنتج ظاهرًا في الرئيسية بسبب بيانات قديمة.
      prices = (Array.isArray(prices) ? prices : []).filter(row=>String(row?.id)!==String(listingId));
      if(typeof window.renderProducts==='function') window.renderProducts();
      alert('تم حذف المادة من المتجر ✅');
      await window.renderStoreDetail(storeId);
    }catch(err){ console.error(err); alert('تعذر حذف المادة: '+(err.message||'خطأ غير معروف')); }
  };

  function addPayloadWithBarcode(base,barcode){ return barcode ? {...base,product_barcode:barcode} : base; }

  async function insertChangeRequest(payload,barcode){
    let {error}=await supabaseClient.from('change_requests').insert(addPayloadWithBarcode(payload,barcode));
    if(error && barcode && /column|schema cache|product_barcode/i.test(String(error.message||''))){
      ({error}=await supabaseClient.from('change_requests').insert(payload));
    }
    return error;
  }

  window.submitPrice = async function(){
    await window.validateStorePrimaryBarcode?.();
    if(barcodePrimaryUsed){ if($('barcodeMsg')) $('barcodeMsg').textContent='مستخدم في المتجر'; syncBarcodeSubmitState(); return; }
    const selected=$('existingProduct').value;
    const n=$('pn').value.trim();
    const brand=$('brand').value.trim();
    const unit=$('unit').value.trim();
    const category=$('cat').value.trim()||'عام';
    const barcode=normBarcode($('barcode').value);
    const companyId=$('merchantCompanySelect')?.value||null;
    const v=Number($('pr').value);
    const file=$('pimg').files?.[0] || null;
    if(!Number.isFinite(v)||v<0) return alert('اكتب السعر بشكل صحيح.');
    if(!profileData) return alert('يجب تسجيل الدخول.');
    const editing=window.__editingMaterial;
    if(!n) return alert('اكتب اسم المادة.');

    if(editing){
      const storeId=String(editing.storeId);
      const companyId=$('merchantCompanySelect')?.value||null;
      if(!canManageStore(storeId)) return alert('ليس لديك صلاحية تعديل هذه المادة.');
      try{
        const {data:row,error}=await supabaseClient.from('price_listings').select('id,store_id,product_id,price_new,price,products(*)').eq('id',editing.listingId).eq('store_id',storeId).single();
        if(error) throw error;
        const current=row.products||{};
        const currentPrimary=normBarcode(current.barcode||row.barcode||'');
        if(barcode && barcode!==currentPrimary && await storeBarcodeExists(storeId,barcode,null)){
          barcodePrimaryUsed=true;
          if($('barcodeMsg')) $('barcodeMsg').textContent='مستخدم في المتجر';
          syncBarcodeSubmitState();
          return;
        }
        try{ await validateAdditionalBarcodes(storeId,row.product_id); }catch(err){ return alert(err.message||'تعذر التحقق من الباركودات الإضافية.'); }
        let imageUrl=current.image_url||null;
        if(file) imageUrl=await uploadImage(file,'materials');
        const productValues={name:n||current.name||'مادة',brand:brand||null,unit:unit||null,category,image_url:imageUrl,barcode:barcode||null,company_id:companyId||null};
        const sharedWithOtherStore=await productUsedByOtherStores(row.product_id,storeId);
        if(role()==='store' || sharedWithOtherStore){
          const user=await ensureCurrentUser();
          const oldProductId=row.product_id;
          const oldAdditionalBarcodes=additionalBarcodes().slice();
          const {data:clone,error:cloneError}=await supabaseClient.from('products').insert({...productValues,active:true,created_by:user.id}).select().single();
          if(cloneError) throw cloneError;
          const {error:updateListingError}=await supabaseClient.from('price_listings').update({product_id:clone.id,price_new:v,price:v,approved:true,updated_at:new Date().toISOString()}).eq('id',editing.listingId).eq('store_id',storeId);
          if(updateListingError) throw updateListingError;
          if(oldAdditionalBarcodes.length){
            const {error:oldBarcodeDeleteError}=await supabaseClient.rpc('store_set_product_barcodes',{
              p_store_id:String(storeId),
              p_product_id:String(oldProductId),
              p_barcodes:[]
            });
            if(oldBarcodeDeleteError) throw oldBarcodeDeleteError;
          }
          await saveStoreAdditionalBarcodes(storeId,clone.id);
        }else{
          const {error:productError}=await supabaseClient.from('products').update(productValues).eq('id',row.product_id);
          if(productError) throw productError;
          const {error:updateListingError}=await supabaseClient.from('price_listings').update({price_new:v,price:v,approved:true,updated_at:new Date().toISOString()}).eq('id',editing.listingId).eq('store_id',storeId);
          if(updateListingError) throw updateListingError;
          await saveStoreAdditionalBarcodes(storeId,row.product_id);
        }
        alert('تم حفظ تعديلات المادة بنجاح ✅');
        window.__editingMaterial=null;
        await window.renderStoreDetail(storeId);
        return;
      }catch(err){ console.error(err); return alert('تعذر حفظ التعديلات: '+(err.message||'خطأ غير معروف')); }
    }

    let storeId=null;
    if(isAdmin()) storeId=$('merchantStoreSelect')?.value||null;
    else if(role()==='store' && profileData.store_id) storeId=profileData.store_id;
    if(!storeId) return alert('اختر المتجر أولاً.');
    if(!selected&&!n) return alert('اكتب اسم المادة الجديدة.');
    try{ await validateAdditionalBarcodes(storeId,selected||null); }catch(err){ return alert(err.message||'تعذر التحقق من الباركودات الإضافية.'); }

    try{
      let imageUrl=window.__barcodeTemplateImageUrl || null;
      if(file) imageUrl=await uploadImage(file,'materials');
      let productId=selected||null;
      if(productId){
        const {data:p,error}=await supabaseClient.from('products').select('*').eq('id',productId).single();
        if(error) throw error;
        if(!barcode && p.barcode) $('barcode').value=normBarcode(p.barcode);
      }

      if(isAdmin()){
        if(!productId){
          if(barcode && await storeBarcodeExists(storeId,barcode,null)){ barcodePrimaryUsed=true; if($('barcodeMsg')) $('barcodeMsg').textContent='مستخدم في المتجر'; syncBarcodeSubmitState(); return; }
          const {data:p,error}=await supabaseClient.from('products').insert({name:n,brand:brand||null,unit:unit||null,category,barcode:barcode||null,image_url:imageUrl,company_id:companyId||null,active:true,created_by:profileData.id}).select().single();
          if(error) throw error;
          productId=p.id;
        }else{
          const {data:baseProduct,error:baseError}=await supabaseClient.from('products').select('*').eq('id',productId).single();
          if(baseError) throw baseError;
          const requestedBarcode=barcode||normBarcode(baseProduct.barcode||'');
          const requestedImage=imageUrl||baseProduct.image_url||null;
          const dataChanged=String(n||baseProduct.name||'')!==String(baseProduct.name||'')
            || String(brand||'')!==String(baseProduct.brand||'')
            || String(unit||'')!==String(baseProduct.unit||'')
            || String(category||'عام')!==String(baseProduct.category||'عام')
            || requestedBarcode!==normBarcode(baseProduct.barcode||'')
            || String(companyId||'')!==String(baseProduct.company_id||'')
            || Boolean(file);
          if(requestedBarcode && requestedBarcode!==normBarcode(baseProduct.barcode||'') && await storeBarcodeExists(storeId,requestedBarcode,null)){ barcodePrimaryUsed=true; if($('barcodeMsg')) $('barcodeMsg').textContent='مستخدم في المتجر'; syncBarcodeSubmitState(); return; }
          const sharedWithOtherStore=await productUsedByOtherStores(productId,storeId);
          if(sharedWithOtherStore || dataChanged){
            const {data:clone,error:cloneError}=await supabaseClient.from('products').insert({name:n||baseProduct.name||'مادة',brand:brand||null,unit:unit||null,category,barcode:requestedBarcode||null,image_url:requestedImage,company_id:companyId||null,active:true,created_by:profileData.id}).select().single();
            if(cloneError) throw cloneError;
            productId=clone.id;
          }else if(imageUrl){
            const {error:imageError}=await supabaseClient.from('products').update({image_url:imageUrl}).eq('id',productId);
            if(imageError) throw imageError;
          }
        }
        const {data:existing,error:existingError}=await supabaseClient.from('price_listings').select('id').eq('product_id',productId).eq('store_id',storeId).maybeSingle();
        if(existingError) throw existingError;
        const pricePayload={price_new:v,price:v,approved:true,updated_at:new Date().toISOString()};
        if(existing){
          const {error}=await supabaseClient.from('price_listings').update(pricePayload).eq('id',existing.id).eq('store_id',storeId);
          if(error) throw error;
        }else{
          const {error}=await supabaseClient.from('price_listings').insert({product_id:productId,store_id:storeId,...pricePayload,submitted_by:profileData.id,approved_by:profileData.id});
          if(error) throw error;
        }
        await saveStoreAdditionalBarcodes(storeId,productId);
        alert('تم حفظ المادة بنجاح');
        resetMaterialForm();
        await window.showAdd?.();
        if($('addMsg')) $('addMsg').textContent='تمت إضافة المادة بنجاح. يمكنك تسجيل مادة أخرى الآن ✅';
        await window.refreshAll?.();
        return;
      }

      const user=await ensureCurrentUser();
      if(role()==='store'){
        if(!storeId) return alert('الحساب غير مرتبط بمتجر بعد.');
        let finalProductId=productId;
        if(!finalProductId){
          if(barcode && await storeBarcodeExists(storeId,barcode,null)){ barcodePrimaryUsed=true; if($('barcodeMsg')) $('barcodeMsg').textContent='مستخدم في المتجر'; syncBarcodeSubmitState(); return; }
          const {data:p,error}=await supabaseClient.from('products').insert({
            name:n,brand:brand||null,unit:unit||null,category,barcode:barcode||null,image_url:imageUrl,company_id:companyId||null,active:true,created_by:user.id
          }).select().single();
          if(error) throw error;
          finalProductId=p.id;
        }
        const {data:existing,error:existingError}=await supabaseClient.from('price_listings').select('id').eq('product_id',finalProductId).eq('store_id',storeId).maybeSingle();
        if(existingError) throw existingError;
        const pricePayload={price_new:v,price:v,approved:true,submitted_by:user.id,approved_by:user.id,updated_at:new Date().toISOString()};
        if(existing){
          const {error}=await supabaseClient.from('price_listings').update(pricePayload).eq('id',existing.id).eq('store_id',storeId);
          if(error) throw error;
        }else{
          const {error}=await supabaseClient.from('price_listings').insert({product_id:finalProductId,store_id:storeId,...pricePayload});
          if(error) throw error;
        }
        await saveStoreAdditionalBarcodes(storeId,finalProductId);
        alert('تم حفظ المادة بنجاح');
        resetMaterialForm();
        await showAdd();
        $('addMsg').textContent='تمت إضافة المادة بنجاح. يمكنك تسجيل مادة أخرى الآن ✅';
        await window.refreshAll?.();
        return;
      }

      const payload={request_type:productId?'price':'product',product_id:productId,store_id:storeId,price_new:v,product_name:productId?null:n,product_description:null,product_category:category,product_unit:unit,product_image_url:imageUrl,submitted_by:user.id,status:'pending'};
      const reqError=await insertChangeRequest(payload,productId?null:barcode);
      if(reqError) throw reqError;
      $('addMsg').textContent='تم إرسال الطلب للمراجعة. لن يظهر للعامة قبل موافقة المدير.';
      ['pn','brand','unit','cat','pr','barcode'].forEach(id=>{ if($(id)) $(id).value=''; });
      if($('pimg')) $('pimg').value='';
      window.__barcodeTemplateImageUrl=null;
      if($('barcodeTemplateImagePreview')) $('barcodeTemplateImagePreview').innerHTML='';
      if($('existingProduct')) $('existingProduct').value='';
      alert('تم إرسال الطلب للمراجعة ✅');
    }catch(err){
      console.error(err);
      $('addMsg').textContent='خطأ: '+(err.message||'تعذر تنفيذ العملية');
    }
  };

  window.renderMerchant = async function(){
    if(role()!=='store') return;
    window.show('merchant');
    const st=(stores||[]).find(s=>String(s.id)===String(userStoreId()));
    const can=!!profileData.store_id;
    let reqs=[],error=null;
    if(profileData.id){
      const q=await supabaseClient.from('change_requests').select('*').eq('submitted_by',profileData.id).order('created_at',{ascending:false});
      reqs=q.data||[]; error=q.error;
    }
    $('merchantRole').textContent = st ? `المتجر المرتبط: ${st.name}. لديك صلاحية كاملة لإدارة متجرك ونشر التعديلات مباشرة.` : 'الحساب غير مرتبط بمتجر بعد.';
    $('merchantPanel').innerHTML=`
      <div class="card">
        ${st?.image_url ? `<img class="img storeLogo" src="${esc(st.image_url)}" alt="${esc(st.name)}">` : ''}
        <div class="name">${esc(st?.name||'لا يوجد متجر مرتبط')}</div>
        <div class="notice ${can?'':'pending'}">${can?'صلاحية كاملة لإدارة متجرك ومواده وأسعاره والنشر المباشر.':'الحساب غير مرتبط بمتجر بعد.'}</div>
        ${st ? `<div class="card" style="margin-top:10px"><div class="name" id="merchantVisitorCount">—</div><div class="muted">إجمالي زيارات المتجر</div></div>` : ''}
        <div class="actions">
          ${st ? `<button type="button" class="btn primary" onclick="openStore('${esc(st.id)}')">فتح متجري</button><button type="button" class="btn secondary" onclick="openMerchantStoreEdit('${esc(st.id)}')">تعديل بيانات المتجر</button>` : ''}
          <button type="button" class="btn primary" ${can?'':'disabled'} onclick="showAdd()">إضافة مادة / سعر</button>
          <button type="button" class="btn secondary" onclick="logout()">تسجيل الخروج</button>
        </div>
      </div>
      <div class="card"><h2>طلباتك</h2>${error?`<p class="muted">${esc(error.message)}</p>`:reqs.length?reqs.map(r=>`<div class="priceRow"><b>${esc(r.product_name||'طلب تعديل سعر')}</b><div class="muted">${r.price_new!=null?fmt(r.price_new)+' ل.س جديدة':''} • ${r.created_at?esc(new Date(r.created_at).toLocaleString('ar')):''}</div><span class="pill">${r.status==='pending'?'قيد المراجعة':r.status==='approved'?'مقبول':'مرفوض'}</span>${r.reason?`<div class="muted">السبب: ${esc(r.reason)}</div>`:''}</div>`).join(''):'<p class="muted">لا توجد طلبات.</p>'}</div>`;
    if(typeof window.loadMerchantStoreVisitorCount==='function') window.loadMerchantStoreVisitorCount();
  };

  // تسجيل زيارة المتجر وتحديث العداد
  window.recordStoreVisit = async function(storeId){
    if(!storeId || !window.supabaseClient) return false;
    try{
      const {error}=await supabaseClient.rpc('record_store_visit',{p_store_id:storeId});
      if(error) throw error;
      return true;
    }catch(err){
      console.warn('record store visit:',err);
      return false;
    }
  };

  window.loadMerchantStoreVisitorCount = async function(){
    if(!profileData || role()!=='store' || !profileData.store_id) return;
    try{
      const {data,error}=await supabaseClient.rpc('merchant_store_visitor_count',{p_store_id:profileData.store_id});
      if(!error && $('merchantVisitorCount')) $('merchantVisitorCount').textContent=fmt(data||0);
    }catch(err){ console.warn('merchant visitor count:',err); }
  };

  window.loadVisitorCount = async function(){
    if(!isAdmin()) return;
    try{ const {data,error}=await supabaseClient.rpc('admin_visitor_count'); if(!error && $('visitorCount')) $('visitorCount').textContent=fmt(data||0); }
    catch(err){ console.warn(err); }
  };

  window.loadAdminStoreVisitorCounts = async function(){
    if(!isAdmin()) return;
    try{
      const {data,error}=await supabaseClient.rpc('admin_store_visitor_counts');
      if(!error && Array.isArray(data)) data.forEach(row=>{ const node=$('sv_'+row.store_id); if(node) node.textContent=fmt(row.visitor_count||0); });
      if(typeof window.getSareeQrVisitCount==='function'){
        for(const st of (stores||[])){ try{const n=await window.getSareeQrVisitCount('store',st.id);const node=$('qrvisit_'+st.id);if(node)node.textContent=n==null?'—':fmt(n);}catch(_){} }
      }
    }catch(err){ console.warn(err); }
  };

  window.saveSiteLinks = async function(){
    if(!isAdmin()) return alert('هذا الخيار للمدير فقط.');
    const payload={key:'site_contact_links',whatsapp_url:$('siteWhatsapp')?.value.trim()||null,telegram_url:$('siteTelegram')?.value.trim()||null,updated_by:profileData.id};
    const {error}=await supabaseClient.from('site_settings').upsert(payload,{onConflict:'key'});
    if($('siteLinksMsg')) $('siteLinksMsg').textContent=error?'تعذر حفظ الروابط: '+error.message:'تم حفظ روابط الموقع.';
  };

  window.loadSiteLinks = async function(){
    if(!isAdmin()) return;
    try{
      const {data,error}=await supabaseClient.from('site_settings').select('whatsapp_url,telegram_url').eq('key','site_contact_links').maybeSingle();
      if(error) return;
      if(data){ if($('siteWhatsapp')) $('siteWhatsapp').value=data.whatsapp_url||''; if($('siteTelegram')) $('siteTelegram').value=data.telegram_url||''; }
    }catch(err){ console.warn(err); }
  };

  window.adminMerchantPermissions = async function(){
    if(!isAdmin()) return alert('هذه الصفحة للمدير فقط.');
    await window.renderAdmin();
    const box=$('adminMerchantPermissionsBox');
    if(box){ box.classList.remove('hidden'); box.scrollIntoView({behavior:'smooth',block:'start'}); }
  };

  window.saveMerchantPermission = async function(merchantId){
    if(!isAdmin()) return alert('المدير فقط يستطيع تغيير الصلاحيات.');
    // حسابات الشركات منفصلة عن التجار ولا يجوز ربطها بمتجر من قسم التجار.
    try{
      const linked=await supabaseClient.from('company_users').select('id,company_id').eq('user_id',merchantId).eq('active',true).maybeSingle();
      if(linked.error) throw linked.error;
      if(linked.data) return alert('هذا الحساب مرتبط بشركة. استخدم قسم «الشركات وربط أصحاب الشركات» ولا تربطه بمتجر.');
    }catch(err){
      return alert('تعذر التحقق من نوع الحساب: '+(err.message||err));
    }
    const checked=document.querySelector(`input[name="merchant-store-${CSS.escape(merchantId)}"]:checked`);
    const storeId=checked?.value||null;
    try{
      if(storeId){
        const occupied=await supabaseClient.from('profiles').select('id,name').eq('store_id',storeId).neq('id',merchantId).limit(1).maybeSingle();
        if(occupied.error) throw occupied.error;
        if(occupied.data) return alert('هذا المتجر مرتبط مسبقاً بحساب تاجر آخر. كل متجر يمكن ربطه بحساب تاجر واحد فقط.');
        // ربط التاجر بمتجره يعني تفعيل متجره وصلاحياته فوراً؛ لا توجد موافقة إضافية أو صلاحية منفصلة.
        const {error:storeError}=await supabaseClient.from('stores').update({active:true,verified:true}).eq('id',storeId);
        if(storeError) throw storeError;
      }
      const {error}=await supabaseClient.from('profiles').update({role:'store',store_id:storeId,can_edit_prices:!!storeId,verified:!!storeId}).eq('id',merchantId);
      if(error) throw error;
      alert(storeId ? 'تم ربط التاجر بالمتجر وتفعيل كامل الصلاحيات والنشر المباشر فوراً ✅' : 'تم فك ربط التاجر.');
      await window.renderAdmin();
    }catch(err){ alert('تعذر حفظ الربط: '+(err.message||'خطأ غير معروف')); }
  };


  function bindExistingProductBarcodeLoader(){
    const select=$('existingProduct');
    if(!select || select.dataset.storeBarcodeBound==='1') return;
    select.dataset.storeBarcodeBound='1';
    select.addEventListener('change',async()=>{
      const pid=select.value;
      if(!pid){window.__sareeStoreAdditionalBarcodes=[];renderAdditionalBarcodes();return;}
      const storeId=activeStoreIdForMaterialForm();
      try{
        const {data:p,error}=await supabaseClient.from('products').select('barcode').eq('id',pid).maybeSingle();
        if(error) throw error;
        if($('barcode') && dataBarcode(p?.barcode)) $('barcode').value=normBarcode(p.barcode);
        await loadStoreAdditionalBarcodes(storeId,pid);
      }catch(err){
        console.warn('load store material barcodes:',err);
      }
    });
  }
  function dataBarcode(v){ return normBarcode(v); }
  function initStoreBarcodeFeature(){
    ensureAdditionalBarcodeUI();
    bindStoreBarcodeLiveValidation();
    bindExistingProductBarcodeLoader();

    // لا يوجد تعبئة تلقائية للباركود الأساسي هنا. هذا يحافظ على مسار 62،
    // ويمنع إدخال/مسح باركود جديد من تشغيل بحث عن مادة قديمة أو تعديل الحقل الأساسي.

    $('merchantStoreSelect')?.addEventListener('change',async()=>{
      const pid=$('existingProduct')?.value;
      if(pid){try{await loadStoreAdditionalBarcodes(activeStoreIdForMaterialForm(),pid)}catch(err){console.warn('store barcode change:',err)}}
    });
  }
  setTimeout(initStoreBarcodeFeature,0);

  window.saveUser = window.saveUser || (async()=>{});

  window.adminAddCompany = async function(){
    if(!isAdmin()) return alert('المدير فقط يستطيع إضافة شركة.');
    const name=$('companyName')?.value.trim();
    if(!name) return alert('اكتب اسم الشركة.');
    const payload={
      name,
      phone:$('companyPhone')?.value.trim()||null,
      address:$('companyAddress')?.value.trim()||null,
      whatsapp_url:$('companyWhatsapp')?.value.trim()||null,
      verified:!!$('companyVerified')?.checked,
      active:true
    };
    const {error}=await supabaseClient.from('companies').insert(payload);
    if(error) return alert('تعذر إضافة الشركة: '+error.message);
    alert('تمت إضافة الشركة بنجاح ✅');
    await window.renderAdmin();
  };

  window.editAdminCompany = async function(id){
    if(!isAdmin()) return;
    const {data,error}=await supabaseClient.from('companies').select('*').eq('id',id).single();
    if(error) return alert(error.message);
    const name=prompt('اسم الشركة:',data.name||'');
    if(name===null) return;
    const phone=prompt('هاتف الشركة:',data.phone||'');
    if(phone===null) return;
    const address=prompt('عنوان الشركة:',data.address||'');
    if(address===null) return;
    const whatsapp_url=prompt('رابط واتساب الشركة:',data.whatsapp_url||'');
    if(whatsapp_url===null) return;
    const {error:upErr}=await supabaseClient.from('companies').update({name:name.trim(),phone:phone.trim()||null,address:address.trim()||null,whatsapp_url:whatsapp_url.trim()||null,updated_at:new Date().toISOString()}).eq('id',id);
    if(upErr) return alert('تعذر تعديل الشركة: '+upErr.message);
    alert('تم تعديل الشركة بنجاح.');
    await window.renderAdmin();
  };

  window.toggleAdminCompanyVerification = async function(id){
    if(!isAdmin()) return;
    const {data,error}=await supabaseClient.from('companies').select('verified').eq('id',id).single();
    if(error) return alert(error.message);
    const {error:upErr}=await supabaseClient.from('companies').update({verified:!data.verified,updated_at:new Date().toISOString()}).eq('id',id);
    if(upErr) return alert(upErr.message);
    await window.renderAdmin();
  };

  window.deleteAdminCompany = async function(id){
    if(!isAdmin()) return;
    if(!confirm('حذف هذه الشركة؟ سيتم إبقاء المتاجر المرتبطة بها بدون شركة.')) return;
    const {error}=await supabaseClient.from('companies').delete().eq('id',id);
    if(error) return alert('تعذر حذف الشركة: '+error.message);
    alert('تم حذف الشركة.');
    await window.renderAdmin();
  };

  // استيراد المواد والأسعار دفعة واحدة من CSV — إضافة مستقلة لا تغيّر مسار الإضافة اليدوية.
  function parseBulkCsv(text){
    text=String(text||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
    const rows=[]; let row=[], cell='', quoted=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i], next=text[i+1];
      if(quoted){
        if(ch==='"' && next==='"'){cell+='"';i++;}
        else if(ch==='"') quoted=false;
        else cell+=ch;
      }else{
        if(ch==='"') quoted=true;
        else if(ch===','){row.push(cell);cell='';}
        else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';}
        else cell+=ch;
      }
    }
    if(cell!=='' || row.length){row.push(cell);rows.push(row);}
    if(!rows.length)return [];
    const clean=v=>String(v??'').trim();
    const headers=rows[0].map(clean);
    return rows.slice(1).filter(r=>r.some(v=>clean(v)!=='')).map(r=>{
      const o={};headers.forEach((h,i)=>o[h]=clean(r[i]));return o;
    });
  }

  function bulkField(row,names){
    for(const n of names){
      if(row[n]!=null && String(row[n]).trim()!=='') return String(row[n]).trim();
    }
    return '';
  }

  function normalizeBulkHeaderRow(row){
    const out={};
    Object.keys(row||{}).forEach(k=>{
      const key=String(k).trim().toLowerCase();
      out[key]=row[k];
    });
    const pick=(keys)=>{for(const k of keys){if(out[k]!=null&&String(out[k]).trim()!=='')return String(out[k]).trim();}return '';};
    return {
      storeName:pick(['store_name','store name','اسم المتجر','المتجر','store']),
      storeId:pick(['store_id','store id','معرف المتجر']),
      name:pick(['product_name','product name','اسم المادة','اسم المنتج','المادة','المنتج','name']),
      brand:pick(['brand','العلامة التجارية','العلامة']),
      unit:pick(['unit','size','الوزن','الحجم','الوحدة','الوزن / الحجم']),
      category:pick(['category','التصنيف','الفئة']),
      barcode:normBarcode(pick(['barcode','باركود','الباركود','رمز الباركود'])),
      price:pick(['price_new','price','price new','السعر','السعر الجديد'])
    };
  }

  window.downloadBulkImportTemplate=function(){
    if(!isAdmin()) return alert('هذا الخيار للمدير فقط.');
    const csv='store_name,product_name,brand,unit,category,barcode,price_new\nاسم المتجر,اسم المادة,,1 لتر,التصنيف,1234567890123,50\n';
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='materials_import_template.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };

  window.importMaterialsCsv=async function(input){
    if(!isAdmin()) return alert('هذا الخيار للمدير فقط.');
    const file=input?.files?.[0]; if(!file)return;
    const msg=$('bulkImportMsg'), result=$('bulkImportResult'), btn=$('bulkImportBtn');
    if(msg)msg.textContent='جاري قراءة الملف...'; if(result)result.innerHTML=''; if(btn)btn.disabled=true;
    try{
      const text=await file.text();
      const raw=parseBulkCsv(text);
      if(!raw.length)throw Error('ملف CSV فارغ أو لا يحتوي على بيانات.');
      const rows=raw.map(normalizeBulkHeaderRow);
      const missing=[];
      rows.forEach((r,i)=>{
        const problems=[];
        if(!r.storeName&&!r.storeId)problems.push('اسم المتجر');
        if(!r.name)problems.push('اسم المادة');
        if(r.price==='')problems.push('السعر');
        if(r.price!=='' && (!Number.isFinite(Number(r.price))||Number(r.price)<0))problems.push('السعر غير صحيح');
        if(problems.length)missing.push(`السطر ${i+2}: ${problems.join('، ')}`);
      });
      if(missing.length)throw Error('يوجد نقص أو خطأ في البيانات:\n'+missing.slice(0,20).join('\n')+(missing.length>20?'\n...':''));

      const {data:storeRows,error:storeError}=await supabaseClient.from('stores').select('id,name').order('name');
      if(storeError)throw storeError;
      const storeList=storeRows||[];
      const byName=new Map(storeList.map(st=>[String(st.name||'').trim().toLowerCase(),st]));
      const byId=new Map(storeList.map(st=>[String(st.id),st]));
      const seen=new Set(), stats={success:0,skipped:0,errors:0}; const errors=[]; const created=[];
      for(let i=0;i<rows.length;i++){
        const r=rows[i];
        try{
          let st=null;
          if(r.storeId) st=byId.get(String(r.storeId))||null;
          if(!st && r.storeName) st=byName.get(r.storeName.toLowerCase())||null;
          if(!st)throw Error('المتجر غير موجود أو اسم المتجر غير مطابق تماماً.');
          const duplicateKey=`${st.id}|${r.barcode||'name:'+r.name.toLowerCase()+'|'+r.unit.toLowerCase()}`;
          if(seen.has(duplicateKey)){stats.skipped++;continue;}
          seen.add(duplicateKey);

          let existing=null;
          const {data:listings,error:listingsError}=await supabaseClient
            .from('price_listings')
            .select('id,product_id,products(*)')
            .eq('store_id',st.id)
            .eq('approved',true);
          if(listingsError)throw listingsError;

          if(r.barcode){
            existing=(listings||[]).find(x=>normBarcode(x.products?.barcode)===r.barcode)||null;
          }else{
            const wantedName=String(r.name||'').trim().toLowerCase();
            const wantedUnit=String(r.unit||'').trim().toLowerCase();
            existing=(listings||[]).find(x=>{
              const p=x.products||{};
              return String(p.name||'').trim().toLowerCase()===wantedName &&
                     String(p.unit||'').trim().toLowerCase()===wantedUnit;
            })||null;
          }

          if(existing){
            const current=existing.products||{};
            const productUpdate={
              name:r.name||current.name,
              brand:r.brand||current.brand||null,
              unit:r.unit||current.unit||null,
              category:r.category||current.category||'عام'
            };
            if(r.barcode) productUpdate.barcode=r.barcode;

            const sharedWithOtherStore=await productUsedByOtherStores(existing.product_id,st.id);
            let listingProductId=existing.product_id;
            const dataChanged=String(productUpdate.name||'')!==String(current.name||'')
              || String(productUpdate.brand||'')!==String(current.brand||'')
              || String(productUpdate.unit||'')!==String(current.unit||'')
              || String(productUpdate.category||'عام')!==String(current.category||'عام')
              || (r.barcode && normBarcode(r.barcode)!==normBarcode(current.barcode||''));
            if(sharedWithOtherStore || dataChanged){
              const {data:clone,error:cloneError}=await supabaseClient
                .from('products')
                .insert({...productUpdate,image_url:current.image_url||null,active:true,created_by:profileData.id})
                .select()
                .single();
              if(cloneError)throw cloneError;
              listingProductId=clone.id;
            }else{
              const {error:productUpdateError}=await supabaseClient
                .from('products')
                .update(productUpdate)
                .eq('id',existing.product_id);
              if(productUpdateError)throw productUpdateError;
            }

            const pricePayload={
              price_new:Number(r.price),
              price:Number(r.price),
              approved:true,
              updated_at:new Date().toISOString()
            };
            const {error:listingUpdateError}=await supabaseClient
              .from('price_listings')
              .update({...pricePayload,product_id:listingProductId})
              .eq('id',existing.id)
              .eq('store_id',st.id);
            if(listingUpdateError)throw listingUpdateError;

            stats.success++;
            continue;
          }

          const productPayload={name:r.name,brand:r.brand||null,unit:r.unit||null,category:r.category||'عام',barcode:r.barcode||null,image_url:null,active:true,created_by:profileData.id};
          const {data:p,error:productError}=await supabaseClient.from('products').insert(productPayload).select().single();
          if(productError)throw productError;
          created.push({productId:p.id,storeId:st.id});
          const {error:listingError}=await supabaseClient.from('price_listings').insert({product_id:p.id,store_id:st.id,price_new:Number(r.price),price:Number(r.price),approved:true,submitted_by:profileData.id,approved_by:profileData.id});
          if(listingError){
            await supabaseClient.from('products').delete().eq('id',p.id);
            throw listingError;
          }
          stats.success++;
        }catch(err){stats.errors++;errors.push(`السطر ${i+2}: ${err.message||'خطأ غير معروف'}`);}
      }
      if(msg)msg.textContent=`اكتمل الاستيراد: تم إدخال ${stats.success}، تم تخطي ${stats.skipped}، أخطاء ${stats.errors}.`;
      if(result){
        result.innerHTML=`<div class="notice">تم إدخال/تحديث ${stats.success} مادة/سعر بنجاح. تم تخطي ${stats.skipped}، والأخطاء: ${stats.errors}.</div>`+(errors.length?`<div class="card dangerbox" style="margin-top:10px"><b>التفاصيل</b><div class="muted" style="white-space:pre-line;margin-top:8px">${esc(errors.slice(0,50).join('\n'))}</div></div>`:'');
      }
      input.value='';
      await window.refreshAll?.();
      const newMsg=$('bulkImportMsg');if(newMsg)newMsg.textContent=`اكتمل الاستيراد: ${stats.success} إدخال/تحديث، ${stats.skipped} متخطى، ${stats.errors} خطأ.`;
    }catch(err){
      if(msg)msg.textContent='تعذر الاستيراد: '+(err.message||'خطأ غير معروف');
      if(result)result.innerHTML=`<div class="card dangerbox">${esc(err.message||'تعذر قراءة الملف')}</div>`;
    }finally{if(btn)btn.disabled=false;}
  };

  window.renderAdmin = async function(){
    if(!isAdmin()) return;
    window.show('admin');
    const [rq,pr,st,us,co,cu]=await Promise.all([
      supabaseClient.from('change_requests').select('*').eq('status','pending').order('created_at',{ascending:false}),
      supabaseClient.from('products').select('*').order('name'),
      supabaseClient.from('stores').select('*,companies(id,name)').order('name'),
      supabaseClient.from('profiles').select('*').order('created_at',{ascending:false}),
      supabaseClient.from('companies').select('*').order('name'),
      supabaseClient.from('company_users').select('user_id').eq('active',true)
    ]);
    const error=rq.error||pr.error||st.error||us.error||co.error||cu.error;
    if(error){ $('adminPanel').innerHTML=`<div class="card dangerbox">خطأ: ${esc(error.message)}</div>`; return; }
    requests=rq.data||[]; products=pr.data||products||[]; stores=st.data||stores||[];
    const users=us.data||[];
    const companies=co.data||[];
    const linkedCompanyUserIds=new Set((cu.data||[]).map(x=>String(x.user_id)));
    const merchants=users.filter(u=>u.role==='store'&&u.id!==ADMIN_UID&&!linkedCompanyUserIds.has(String(u.id)));
    const pending=requests.length ? requests.map(r=>`<div class="priceRow"><div class="accordionHead" data-toggle-id="req_${esc(r.id)}"><b>${esc(r.product_name||'طلب تعديل سعر')}</b><span>▾</span></div><div id="req_${esc(r.id)}" class="accordionBody hidden"><div class="muted">${r.price_new!=null?fmt(r.price_new)+' ل.س جديدة':''}<br>${r.created_at?esc(new Date(r.created_at).toLocaleString('ar')):''}</div><div class="actions"><button class="btn approve" onclick="approveRequest('${esc(r.id)}')">موافقة ونشر</button><button class="btn reject" onclick="rejectRequest('${esc(r.id)}')">رفض</button></div></div></div>`).join('') : '<p class="muted">لا توجد طلبات معلقة.</p>';
    const merchantHtml=merchants.length ? merchants.map(u=>{
      const current=(stores||[]).find(s=>String(s.id)===String(u.store_id));
      return `<div class="priceRow merchantAdminItem">
        <div class="accordionHead" data-toggle-id="merchant_${esc(u.id)}"><div><b>${esc(u.name||'تاجر')}</b><div class="muted">${current?`مرتبط بـ ${esc(current.name)}`:'غير مرتبط بمتجر'} ${u.phone?'• 📞 '+esc(u.phone):''} • ${current?'صلاحية كاملة':'بدون متجر'}</div></div><span>▾</span></div>
        <div id="merchant_${esc(u.id)}" class="accordionBody hidden">
          <p class="muted">اضغط «ربط التاجر بالمتجر» لعرض قائمة المتاجر. يمكن اختيار متجر واحد فقط.</p>
          <div class="actions">
          <button type="button" class="btn secondary" data-link-merchant="${esc(u.id)}">ربط التاجر بالمتجر</button>
          <button type="button" class="btn secondary" onclick="toggleAdminMerchantVerification('${esc(u.id)}')">${u.verified?'إلغاء توثيق التاجر':'توثيق التاجر'}</button>
          <button type="button" class="btn danger" onclick="deleteAdminMerchant('${esc(u.id)}')">حذف التاجر</button>
        </div>
          <div id="merchantStores_${esc(u.id)}" class="hidden" style="margin-top:10px">
            <div class="card"><b>اختر متجرًا واحدًا</b>${(stores||[]).map(s=>`<label class="merchantStoreOption"><input type="radio" name="merchant-store-${esc(u.id)}" value="${esc(s.id)}" ${String(u.store_id)===String(s.id)?'checked':''}> ${esc(s.name)}${s.city?' — '+esc(s.city):''}</label>`).join('') || '<p class="muted">لا توجد متاجر.</p>'}
            <div class="notice">عند ربط التاجر بمتجر يحصل تلقائياً على كامل صلاحيات إدارة متجره والنشر المباشر، ولا توجد صلاحية منفصلة للتفعيل.</div>
            <div class="actions"><button type="button" class="btn primary" onclick="saveMerchantPermission('${esc(u.id)}')">حفظ ربط المتجر</button><button type="button" class="btn danger" onclick="clearMerchantLink('${esc(u.id)}')">فك ربط المتجر</button></div></div>
          </div>
        </div>
      </div>`;
    }).join('') : '<p class="muted">لا توجد حسابات تجار حالياً.</p>';
    const storesHtml=(stores||[]).length ? (stores||[]).map(s=>`<div class="priceRow"><div class="accordionHead" data-toggle-id="storeAdmin_${esc(s.id)}"><div><b>${esc(s.name)}</b><div class="muted">${esc([s.city,s.area].filter(Boolean).join(' — '))}</div></div><span>▾</span></div><div id="storeAdmin_${esc(s.id)}" class="accordionBody hidden">${storeImage(s)?`<img class="img storeLogo" src="${esc(storeImage(s))}" alt="${esc(s.name)}">`:''}<div class="muted">${esc(s.address||'')}</div>${s.phone?`<div class="muted">📞 ${esc(s.phone)}</div>`:''}${storeCompany(s)?`<div class="pill companyBadge">🏢 ${esc(storeCompany(s))}</div>`:''}${storeWhatsapp(s)?`<div class="muted">واتساب: ${esc(storeWhatsapp(s))}</div>`:''}<div class="muted">إجمالي زيارات المتجر: <b id="sv_${esc(s.id)}">—</b></div><div class="muted">📱 زوار QR المتجر: <b id="qrvisit_${esc(s.id)}">—</b></div><div id="qr_${esc(s.id)}" class="qrbox"></div><div class="actions">
          <button type="button" class="btn secondary" onclick="openStore('${esc(s.id)}')">فتح صفحة المتجر</button>
          <button type="button" class="btn secondary" onclick="printStoreQR('${esc(s.id)}')">طباعة QR</button>
          <button type="button" class="btn primary" onclick="openAdminStoreEdit('${esc(s.id)}')">تعديل المتجر</button>
          <button type="button" class="btn secondary" onclick="toggleAdminStoreVerification('${esc(s.id)}')">${s.verified?'إلغاء توثيق المتجر':'توثيق المتجر'}</button>
          <button type="button" class="btn danger" onclick="deleteAdminStore('${esc(s.id)}')">حذف المتجر</button>
        </div></div></div>`).join('') : '<p class="muted">لا توجد متاجر.</p>';
    const usersHtml=users.filter(u=>u.id!==ADMIN_UID).length ? users.filter(u=>u.id!==ADMIN_UID).map(u=>`<div class="priceRow"><div class="accordionHead" data-toggle-id="user_${esc(u.id)}"><b>${esc(u.name||u.id)}</b><span>▾</span></div><div id="user_${esc(u.id)}" class="accordionBody hidden"><div class="muted">الدور: ${esc(u.role||'user')} ${u.phone?'• 📞 '+esc(u.phone):''}${u.store_id?' • مرتبط بمتجر':''}</div><div class="actions"><button type="button" class="btn secondary" onclick="setAccountToUser('${esc(u.id)}')">تحويل إلى مستخدم وإزالة الربط</button></div></div></div>`).join('') : '<p class="muted">لا توجد حسابات.</p>';
    $('adminPanel').innerHTML=`
      <div class="grid"><div class="card"><div class="name">${requests.length}</div><div class="muted">طلبات معلقة</div></div><div class="card"><div class="name">${(stores||[]).length}</div><div class="muted">متاجر</div></div><div class="card"><div class="name">${(products||[]).length}</div><div class="muted">منتجات</div></div><div class="card"><div class="name">${users.length}</div><div class="muted">حسابات</div></div><div class="card"><div class="name" id="visitorCount">—</div><div class="muted">إجمالي زيارات الموقع</div></div></div>
      <div class="card"><div class="accordionHead" data-toggle-id="adminRequestsBody"><h2>طلبات التجار</h2><span>▾</span></div><div id="adminRequestsBody" class="accordionBody hidden">${pending}</div></div>
      <div class="card"><div class="accordionHead" data-toggle-id="adminAddStoreBody"><h2>إضافة متجر</h2><span>▾</span></div><div id="adminAddStoreBody" class="accordionBody hidden"><div class="two"><input id="sn" placeholder="اسم المتجر"><input id="scity" placeholder="المدينة"><input id="sarea" placeholder="المنطقة"><input id="saddr" placeholder="العنوان"><input id="sphone" placeholder="الهاتف"><input id="swhatsapp" placeholder="رابط واتساب المتجر"><select id="scompany"><option value="">بدون شركة</option>${companies.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select><input id="shours" placeholder="ساعات الدوام"><input id="sdays" placeholder="أيام العمل"><input id="simg" type="file" accept="image/*"></div><button class="btn primary" onclick="adminAddStore()">إضافة المتجر</button></div></div>
      <div id="adminMerchantPermissionsBox" class="card"><div class="accordionHead" data-toggle-id="adminMerchantsBody"><div><h2>إدارة وربط التجار</h2><div class="muted">كل تاجر يمكن ربطه بمتجر واحد، ويحصل تلقائياً على كامل الصلاحيات والنشر المباشر.</div></div><span>▾</span></div><div id="adminMerchantsBody" class="accordionBody hidden">${merchantHtml}</div></div>
      <div class="card"><div class="accordionHead" data-toggle-id="adminStoresBody"><h2>إدارة المتاجر</h2><span>▾</span></div><div id="adminStoresBody" class="accordionBody hidden">${storesHtml}</div></div>
      <div class="card"><div class="accordionHead" data-toggle-id="adminUsersBody"><h2>الحسابات</h2><span>▾</span></div><div id="adminUsersBody" class="accordionBody hidden">${usersHtml}</div></div>
      <div class="card"><h2>رقم الهاتف عند إنشاء الحساب</h2><label class="rememberRow"><input id="signupPhoneAdminToggle" type="checkbox" onchange="saveSignupPhoneSetting(this.checked).then(()=>{this.closest('.card').querySelector('.signupPhoneSettingMsg').textContent='تم حفظ الإعداد.'}).catch(e=>{this.checked=!this.checked;this.closest('.card').querySelector('.signupPhoneSettingMsg').textContent='تعذر حفظ الإعداد: '+e.message})"> إظهار حقل رقم الهاتف عند إنشاء حسابات التاجر والشركة</label><p class="muted signupPhoneSettingMsg">بدون تأكيد لرقم الهاتف.</p></div>
      <div class="card"><div class="accordionHead" data-toggle-id="adminBulkImportBody"><h2>📥 استيراد المواد والأسعار دفعة واحدة</h2><span>▾</span></div><div id="adminBulkImportBody" class="accordionBody hidden"><p class="muted">ارفع ملف CSV واحداً يحتوي على اسم المتجر واسم المادة والتصنيف والباركود والسعر. لا تحتاج إلى معرفة store_id؛ يكفي اسم المتجر المطابق لما هو مسجل في الموقع.</p><div class="actions"><button type="button" class="btn secondary" onclick="downloadBulkImportTemplate()">تحميل نموذج CSV</button><label class="btn primary" style="display:inline-block;margin:0;cursor:pointer">اختيار ملف CSV<input id="bulkImportFile" type="file" accept=".csv,text/csv" style="display:none" onchange="importMaterialsCsv(this)"></label></div><p id="bulkImportMsg" class="muted"></p><div id="bulkImportResult"></div></div></div>
      <div class="actions"><button class="btn secondary" onclick="show('home')">العودة للموقع</button><button class="btn secondary" onclick="logout()">تسجيل الخروج</button></div>`;
    bindAdminAccordions();
    $('adminPanel').querySelectorAll('[data-link-merchant]').forEach(btn=>btn.onclick=()=>{
      const box=$('merchantStores_'+btn.dataset.linkMerchant);
      box?.classList.toggle('hidden');
      if(box) btn.textContent=box.classList.contains('hidden')?'ربط التاجر بالمتجر':'إخفاء قائمة المتاجر';
    });
    if($('signupPhoneAdminToggle')){ $('signupPhoneAdminToggle').checked=window.__sareeSignupPhoneEnabled===true; loadSignupPhoneSetting().then(()=>{ $('signupPhoneAdminToggle').checked=window.__sareeSignupPhoneEnabled===true; }).catch(console.warn); }
    window.loadVisitorCount();
    window.loadAdminStoreVisitorCounts();
    window.ensureSareeAdminInstallPanel?.();
    setTimeout(buildAllQRCodes,30);
  };

  function bindAdminAccordions(){
    document.querySelectorAll('[data-toggle-id]').forEach(node=>node.onclick=()=>{
      const target=$(node.dataset.toggleId); if(target) target.classList.toggle('hidden');
    });
  }

  window.clearMerchantLink = async function(id){
    if(!isAdmin()) return;
    const {data,error}=await supabaseClient.from('profiles').update({role:'store',store_id:null,can_edit_prices:false}).eq('id',id).select('id,store_id').maybeSingle();
    if(error) return alert(error.message);
    if(!data) return alert('تعذر العثور على حساب التاجر.');
    if(data.store_id) return alert('تعذر فك ربط المتجر من الحساب.');
    await window.renderAdmin();
  };

  window.setAccountToUser = async function(id){
    if(!isAdmin()) return;
    if(!confirm('تحويل هذا الحساب إلى مستخدم وإزالة ربطه بالمتجر؟')) return;
    const {error}=await supabaseClient.from('profiles').update({role:'user',store_id:null,can_edit_prices:false}).eq('id',id);
    if(error) return alert(error.message);
    await window.renderAdmin();
  };

  window.adminAddStore = async function(){
    if(!isAdmin()) return alert('المدير فقط يستطيع إضافة متجر.');
    const name=$('sn')?.value.trim();
    if(!name) return alert('اكتب اسم المتجر.');
    let image=null;
    try{ image=await uploadImage($('simg')?.files?.[0]||null,'stores'); }catch(err){ return alert('فشل رفع صورة المتجر: '+err.message); }
    const payload={name,city:$('scity').value.trim(),area:$('sarea').value.trim(),address:$('saddr').value.trim(),phone:$('sphone').value.trim(),opening_hours:$('shours').value.trim(),working_days:$('sdays').value.trim(),image_url:image,whatsapp_url:$('swhatsapp').value.trim()||null,verified:true,active:true,company_id:$('scompany')?.value||null};
    const {error}=await supabaseClient.from('stores').insert(payload);
    if(error) return alert(error.message);
    alert('تمت إضافة المتجر ✅');
    await window.refreshAll();
    await window.renderAdmin();
  };

  async function uploadImage(file,folder){
    if(!file) return null;
    const {data:{user}}=await supabaseClient.auth.getUser();
    if(!user) throw new Error('يجب تسجيل الدخول');
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
    const path=`${folder}/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const {error}=await supabaseClient.storage.from('product-images').upload(path,file,{upsert:false,contentType:file.type});
    if(error) throw error;
    return supabaseClient.storage.from('product-images').getPublicUrl(path).data.publicUrl;
  }

  window.uploadImage = window.uploadImage || uploadImage;

  window.buildAllQRCodes = function(){
    if(typeof QRCode==='undefined') return;
    (stores||[]).forEach(s=>{ const box=$('qr_'+s.id); if(!box) return; box.innerHTML=''; new QRCode(box,{text:qrStoreUrl(s.id),width:160,height:160,correctLevel:QRCode.CorrectLevel.H}); });
  };

  window.printStoreQR = function(id){
    const st=(stores||[]).find(x=>String(x.id)===String(id)); if(!st) return;
    const url=qrStoreUrl(id); const w=window.open('','_blank'); if(!w) return alert('اسمح بفتح النوافذ المنبثقة لطباعة QR.');
    const safeName=esc(st.name), safeUrl=esc(url);
    const html='<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>QR - '+safeName+'</title></head><body style="font-family:Arial;text-align:center;padding:30px"><h2>'+safeName+'</h2><div id="qrprint"></div><p>'+safeUrl+'</p><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script><script>new QRCode(document.getElementById("qrprint"),{text:'+JSON.stringify(url)+',width:300,height:300,correctLevel:QRCode.CorrectLevel.H});setTimeout(function(){window.print();},800);<\/script></body></html>';
    w.document.open();w.document.write(html);w.document.close();
  };

})();
