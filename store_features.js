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
  const isAdmin = () => role() === 'admin';
  const canManageStore = storeId => isAdmin() || (
    role() === 'store' &&
    !!profileData?.store_id &&
    profileData?.can_edit_prices === true &&
    String(profileData.store_id) === String(storeId)
  );
  const userStoreId = () => profileData?.store_id || null;
  const storeImage = st => st?.image_url || st?.logo_url || '';
  const storeCompany = st => st?.companies?.name || st?.company_name || st?.company || '';
  const storeWhatsapp = st => st?.whatsapp_url || st?.whatsapp || '';
  const mapsUrl = st => {
    if(st?.latitude != null && st?.longitude != null){
      return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(st.latitude + ',' + st.longitude);
    }
    if(st?.address || st?.city || st?.area){
      return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([st.address,st.area,st.city].filter(Boolean).join(', '));
    }
    return '';
  };

  // تسجيل كل زيارة فعلية بدون upsert/منع التكرار.
  window.recordStoreVisit = async function(storeId){
    if(!storeId || typeof supabaseClient?.rpc !== 'function') return;
    try{
      let visitor = '';
      try{ visitor = typeof window.visitorId === 'function' ? window.visitorId() : (localStorage.getItem('visitor_id') || ''); }catch(_){}
      const {error} = await supabaseClient.rpc('record_store_visit',{p_store_id:storeId,p_visitor_id:visitor || null});
      if(error) throw error;
    }catch(err){ console.warn('record store visit:',err); }
  };

  window.recordCompanyVisit = async function(companyId){
    if(!companyId || typeof supabaseClient?.rpc !== 'function') return;
    try{
      let visitor = '';
      try{ visitor = typeof window.visitorId === 'function' ? window.visitorId() : (localStorage.getItem('visitor_id') || ''); }catch(_){}
      const {error} = await supabaseClient.rpc('record_company_visit',{p_company_id:companyId,p_visitor_id:visitor || null});
      if(error) throw error;
    }catch(err){ console.warn('record company visit:',err); }
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
    const companyId = list.map(st => st?.companies?.id || st?.company_id).find(Boolean) || null;
    if(companyId && typeof window.recordCompanyVisit==='function') window.recordCompanyVisit(companyId).catch(()=>{});
    $('companyDetailName').textContent = name || 'الشركة';
    $('companyDetailBody').innerHTML = `
      <div class="card">
        <span class="pill companyBadge">🏢 ${esc(name || 'متاجر مستقلة')}</span>
        <div class="name">${list.length} متاجر</div>
        <div class="muted" id="companyVisitorStats">جاري تحميل الزيارات...</div>
        <p class="muted">هذه الصفحة تجمع المتاجر التابعة للشركة وتعرض بياناتها الأساسية ووسائل التواصل المتاحة.</p>
      </div>
      <div class="grid">
        ${list.length ? list.map(renderStoreCard).join('') : '<div class="card muted">لا توجد متاجر مسجلة تحت هذه الشركة.</div>'}
      </div>`;
    window.show('companyDetail');
    window.scrollTo(0,0);
    if(companyId && typeof window.loadCompanyVisitorStats==='function') window.loadCompanyVisitorStats(companyId);
  }

  window.loadCompanyVisitorStats = async function(companyId){
    if(!companyId) return;
    const node = $('companyVisitorStats');
    try{
      const {data,error} = await supabaseClient.rpc('admin_company_visitor_stats',{p_company_id:companyId});
      if(error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if(node) node.textContent = `إجمالي الزيارات: ${fmt(row?.total_visits||0)} • الزوار الفريدون: ${fmt(row?.unique_visitors||0)}`;
    }catch(err){
      if(node) node.textContent = '';
      console.warn('company visitor stats:',err);
    }
  };

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
    window.requestSareeLocation();
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
      return `<article class="card">${p.image_url?`<img class="img" src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`:''}<span class="pill">${esc(p.category||'عام')}</span><div class="name">${esc(p.name||'مادة')}</div><div class="muted">${esc(p.unit||'')} ${p.brand?'• '+esc(p.brand):''}</div><div class="price">${fmt(priceNumber(c))} ل.س جديدة</div><div class="old">${priceOld(priceNumber(c))} ل.س قديمة</div><div class="meta"><span>الأرخص: ${esc(c.stores?.name||'')}</span><span>${esc(c.stores?.city||'')}</span></div><div class="meta"><span>${ps.length} متاجر</span><span>آخر تحديث: ${c.updated_at?esc(new Date(c.updated_at).toLocaleDateString('ar')):'—'}</span></div><div class="actions"><button class="btn secondary" onclick="toggleFav('${esc(p.id)}')">${fav?'★ إزالة من المفضلة':'☆ أضف للمفضلة'}</button><button class="btn primary" onclick="details('${esc(p.id)}')">تفاصيل الأسعار</button><button class="btn secondary" onclick="addBasket('${esc(p.id)}')">أضف للسلة</button></div></article>`;
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
    return Array.isArray(data) ? data : [];
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
        ${maps ? `<button type="button" class="btn secondary" id="storeDirectionsBtn">الاتجاهات في Google Maps</button>` : ''}
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

    $('storeCompanyBtn')?.addEventListener('click',()=>window.openCompany(company));
    $('storeDirectionsBtn')?.addEventListener('click',()=>window.open(maps,'_blank','noopener'));
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
      const rows = await loadApprovedStoreListings(storeId);
      const matches = rows.filter(row=>normBarcode((row.products||{}).barcode || row.barcode)===code);
      const unique = uniqueListings(matches);
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

  async function storeBarcodeExists(storeId,code,excludeProductId){
    const barcode = normBarcode(code);
    if(!barcode) return false;
    const rows = await loadApprovedStoreListings(storeId);
    return rows.some(r => String(r.product_id)!==String(excludeProductId||'') && normBarcode((r.products||{}).barcode || r.barcode)===barcode);
  }

  function resetMaterialForm(){
    window.__editingMaterial = null;
    ['pn','brand','unit','cat','pr','barcode','addMsg','barcodeMsg'].forEach(id=>{ if($(id)) $(id).value=''; if($(id)) $(id).textContent=''; });
    if($('pimg')) $('pimg').value='';
    if($('existingProduct')) $('existingProduct').value='';
    if($('addHeading')) $('addHeading').textContent='إضافة مادة أو سعر';
    if($('addSubmitBtn')) $('addSubmitBtn').textContent='إرسال للمراجعة';
    ['pn','brand','unit','cat'].forEach(id=>{ if($(id)) $(id).disabled=false; });
  }

  window.showAdd = function(){
    if(!profileData) return alert('هذه الميزة للحسابات المصرح لها فقط.');
    if(isAdmin()){
      window.__editingMaterial = null;
      window.show('add');
      const options = '<option value="">اختر المتجر</option>' + (stores||[]).map(st=>`<option value="${esc(st.id)}">${esc(st.name)}${st.city?' — '+esc(st.city):''}</option>`).join('');
      $('merchantStoreBox').innerHTML = `<label class="muted">المتجر المستهدف</label><select id="merchantStoreSelect">${options}</select>`;
      $('addHeading').textContent='إضافة مادة أو سعر';
      $('addSubmitBtn').textContent='إضافة ونشر';
      return;
    }
    if(role()!=='store' || !profileData.store_id || profileData.can_edit_prices!==true){
      return alert('حسابك غير مصرح له حالياً. يجب أن يربطك المدير بمتجر ويفعّل صلاحية الأسعار والمواد.');
    }
    const st=(stores||[]).find(s=>String(s.id)===String(profileData.store_id));
    window.__editingMaterial = null;
    window.show('add');
    $('merchantStoreBox').innerHTML=`<div class="notice">المتجر المرتبط: <b>${esc(st?.name||'غير ظاهر')}</b></div>`;
    $('addHeading').textContent='إضافة مادة أو سعر';
    $('addSubmitBtn').textContent='إرسال للمراجعة';
  };

  window.editStoreMaterial = async function(listingId,storeId){
    if(!canManageStore(storeId)) return alert('ليس لديك صلاحية تعديل مواد هذا المتجر.');
    try{
      const {data,error} = await supabaseClient.from('price_listings').select('id,store_id,product_id,price_new,price,products(*)').eq('id',listingId).eq('store_id',storeId).single();
      if(error) throw error;
      if(!data) throw new Error('لم يتم العثور على المادة.');
      const p=data.products||{};
      window.__editingMaterial={listingId,storeId,productId:data.product_id};
      window.show('add');
      $('existingProduct').value='';
      ['pn','brand','unit','cat'].forEach(id=>{ if($(id)) $(id).disabled=false; });
      $('pn').value=p.name||'';
      $('brand').value=p.brand||'';
      $('unit').value=p.unit||'';
      $('cat').value=p.category||'عام';
      $('barcode').value=normBarcode(p.barcode||data.barcode||'');
      $('pr').value=Number(data.price_new ?? data.price ?? 0);
      $('merchantStoreBox').innerHTML = `<div class="notice">تعديل مادة من متجر: <b>${esc((stores||[]).find(s=>String(s.id)===String(storeId))?.name||storeId)}</b>${p.image_url?'<br>الصورة الحالية محفوظة ما لم تختر صورة جديدة.':''}</div>`;
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
      const {error}=await supabaseClient.from('price_listings').delete().eq('id',listingId).eq('store_id',storeId);
      if(error) throw error;
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
    const selected=$('existingProduct').value;
    const n=$('pn').value.trim();
    const brand=$('brand').value.trim();
    const unit=$('unit').value.trim();
    const category=$('cat').value.trim()||'عام';
    const barcode=normBarcode($('barcode').value);
    const v=Number($('pr').value);
    const file=$('pimg').files?.[0] || null;
    if(!Number.isFinite(v)||v<0) return alert('اكتب السعر بشكل صحيح.');
    if(!profileData) return alert('يجب تسجيل الدخول.');
    const editing=window.__editingMaterial;

    if(editing){
      const storeId=String(editing.storeId);
      if(!canManageStore(storeId)) return alert('ليس لديك صلاحية تعديل هذه المادة.');
      try{
        const {data:row,error}=await supabaseClient.from('price_listings').select('id,store_id,product_id,price_new,price,products(*)').eq('id',editing.listingId).eq('store_id',storeId).single();
        if(error) throw error;
        const current=row.products||{};
        if(barcode && await storeBarcodeExists(storeId,barcode,row.product_id)) return alert('هذا الباركود مستخدم لمادة أخرى داخل هذا المتجر.');
        let imageUrl=current.image_url||null;
        if(file) imageUrl=await uploadImage(file,'materials');
        const productValues={name:n||current.name||'مادة',brand:brand||null,unit:unit||null,category,image_url:imageUrl,barcode:barcode||null};
        if(role()==='store'){
          const user=await ensureCurrentUser();
          const {data:clone,error:cloneError}=await supabaseClient.from('products').insert({...productValues,active:true,created_by:user.id}).select().single();
          if(cloneError) throw cloneError;
          const {error:updateListingError}=await supabaseClient.from('price_listings').update({product_id:clone.id,price_new:v,price:v,approved:true,updated_at:new Date().toISOString()}).eq('id',editing.listingId).eq('store_id',storeId);
          if(updateListingError) throw updateListingError;
        }else{
          const {error:productError}=await supabaseClient.from('products').update(productValues).eq('id',row.product_id);
          if(productError) throw productError;
          const {error:updateListingError}=await supabaseClient.from('price_listings').update({price_new:v,price:v,approved:true,updated_at:new Date().toISOString()}).eq('id',editing.listingId).eq('store_id',storeId);
          if(updateListingError) throw updateListingError;
        }
        alert('تم حفظ تعديلات المادة بنجاح ✅');
        window.__editingMaterial=null;
        await window.renderStoreDetail(storeId);
        return;
      }catch(err){ console.error(err); return alert('تعذر حفظ التعديلات: '+(err.message||'خطأ غير معروف')); }
    }

    let storeId=null;
    if(isAdmin()) storeId=$('merchantStoreSelect')?.value||null;
    else if(role()==='store' && profileData.store_id && profileData.can_edit_prices===true) storeId=profileData.store_id;
    if(!storeId) return alert('اختر المتجر أولاً.');
    if(!selected&&!n) return alert('اكتب اسم المادة الجديدة.');

    try{
      let imageUrl=null;
      if(file) imageUrl=await uploadImage(file,'materials');
      let productId=selected||null;
      if(productId){
        const {data:p,error}=await supabaseClient.from('products').select('*').eq('id',productId).single();
        if(error) throw error;
        if(!barcode && p.barcode) $('barcode').value=normBarcode(p.barcode);
        if(barcode && !p.barcode && isAdmin()){
          if(await storeBarcodeExists(storeId,barcode,p.id)) return alert('هذا الباركود مستخدم لمادة أخرى داخل هذا المتجر.');
          const {error:updateBarcodeError}=await supabaseClient.from('products').update({barcode}).eq('id',p.id);
          if(updateBarcodeError) throw updateBarcodeError;
        }
      }

      if(isAdmin()){
        if(!productId){
          if(barcode && await storeBarcodeExists(storeId,barcode,null)) return alert('هذا الباركود مستخدم بالفعل داخل هذا المتجر.');
          const {data:p,error}=await supabaseClient.from('products').insert({name:n,brand:brand||null,unit:unit||null,category,barcode:barcode||null,image_url:imageUrl,active:true,created_by:profileData.id}).select().single();
          if(error) throw error;
          productId=p.id;
        }else if(imageUrl){
          const {error}=await supabaseClient.from('products').update({image_url:imageUrl}).eq('id',productId);
          if(error) throw error;
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
        alert('تمت إضافة المادة والسعر للمتجر بنجاح ✅');
        resetMaterialForm();
        await window.refreshAll?.();
        await window.renderAdmin?.();
        return;
      }

      const user=await ensureCurrentUser();
      const payload={request_type:productId?'price':'product',product_id:productId,store_id:storeId,price_new:v,product_name:productId?null:n,product_description:null,product_category:category,product_unit:unit,product_image_url:imageUrl,submitted_by:user.id,status:'pending'};
      const reqError=await insertChangeRequest(payload,productId?null:barcode);
      if(reqError) throw reqError;
      $('addMsg').textContent='تم إرسال الطلب للمراجعة. لن يظهر للعامة قبل موافقة المدير.';
      ['pn','brand','unit','cat','pr','barcode'].forEach(id=>{ if($(id)) $(id).value=''; });
      if($('pimg')) $('pimg').value='';
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
    const can=!!profileData.store_id && profileData.can_edit_prices===true;
    let reqs=[],error=null;
    if(profileData.id){
      const q=await supabaseClient.from('change_requests').select('*').eq('submitted_by',profileData.id).order('created_at',{ascending:false});
      reqs=q.data||[]; error=q.error;
    }
    $('merchantRole').textContent = st ? `المتجر المرتبط: ${st.name}.` : 'الحساب غير مرتبط بمتجر بعد.';
    $('merchantPanel').innerHTML=`
      <div class="card">
        ${st?.image_url ? `<img class="img storeLogo" src="${esc(st.image_url)}" alt="${esc(st.name)}">` : ''}
        <div class="name">${esc(st?.name||'لا يوجد متجر مرتبط')}</div>
        <div class="notice ${can?'':'pending'}">${can?'الصلاحية مفعّلة لإدارة مواد وأسعار متجرك فقط.':'الصلاحية غير مفعّلة. المدير هو من يربط المتجر ويفعّل الصلاحية.'}</div>
        ${st ? `<div class="card" style="margin-top:10px"><div class="name" id="merchantVisitorTotal">—</div><div class="muted">إجمالي زيارات المتجر</div><div class="muted" id="merchantVisitorUnique">الزوار الفريدون: —</div></div>` : ''}
        <div class="actions">
          ${st ? `<button type="button" class="btn primary" onclick="openStore('${esc(st.id)}')">فتح متجري</button>` : ''}
          <button type="button" class="btn primary" ${can?'':'disabled'} onclick="showAdd()">إضافة مادة / سعر</button>
          <button type="button" class="btn secondary" onclick="logout()">تسجيل الخروج</button>
        </div>
      </div>
      <div class="card"><h2>طلباتك</h2>${error?`<p class="muted">${esc(error.message)}</p>`:reqs.length?reqs.map(r=>`<div class="priceRow"><b>${esc(r.product_name||'طلب تعديل سعر')}</b><div class="muted">${r.price_new!=null?fmt(r.price_new)+' ل.س جديدة':''} • ${r.created_at?esc(new Date(r.created_at).toLocaleString('ar')):''}</div><span class="pill">${r.status==='pending'?'قيد المراجعة':r.status==='approved'?'مقبول':'مرفوض'}</span>${r.reason?`<div class="muted">السبب: ${esc(r.reason)}</div>`:''}</div>`).join(''):'<p class="muted">لا توجد طلبات.</p>'}</div>`;
    if(typeof window.loadMerchantStoreVisitorCount==='function') window.loadMerchantStoreVisitorCount();
  };

  window.loadMerchantStoreVisitorCount = async function(){
    if(!profileData || role()!=='store' || !profileData.store_id) return;
    try{
      const {data,error}=await supabaseClient.rpc('merchant_store_visitor_stats',{p_store_id:profileData.store_id});
      if(error) throw error;
      const row=Array.isArray(data)?data[0]:data;
      if($('merchantVisitorTotal')) $('merchantVisitorTotal').textContent=fmt(row?.total_visits||0);
      if($('merchantVisitorUnique')) $('merchantVisitorUnique').textContent='الزوار الفريدون: '+fmt(row?.unique_visitors||0);
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
      if(error || !Array.isArray(data)) return;
      data.forEach(row=>{ const total=$('sv_total_'+row.store_id); const unique=$('sv_unique_'+row.store_id); if(total) total.textContent=fmt(row.total_visits ?? row.visitor_count ?? 0); if(unique) unique.textContent=fmt(row.unique_visitors||0); });
    }catch(err){ console.warn(err); }
  };

  window.saveSiteLinks = async function(){
    if(!isAdmin()) return alert('هذا الخيار للمدير فقط.');
    const payload={key:'site_contact_links',whatsapp_url:$('siteWhatsapp')?.value.trim()||null,telegram_url:$('siteTelegram')?.value.trim()||null,updated_by:profileData.id};
    const {data,error}=await supabaseClient.from('site_settings').update({key:'site_contact_links',whatsapp_url:payload.whatsapp_url,telegram_url:payload.telegram_url,updated_at:new Date().toISOString()}).eq('id',1).select();
    let saveError=error;
    if(!saveError && (!data || data.length===0)){const {error:insertError}=await supabaseClient.from('site_settings').insert({id:1,key:'site_contact_links',whatsapp_url:payload.whatsapp_url,telegram_url:payload.telegram_url,updated_at:new Date().toISOString()});saveError=insertError;}
    if($('siteLinksMsg')) $('siteLinksMsg').textContent=saveError?'تعذر حفظ الروابط: '+saveError.message:'تم حفظ روابط الموقع.';
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
    const checked=document.querySelector(`input[name="merchant-store-${CSS.escape(merchantId)}"]:checked`);
    const permission=$('merchantPermission_'+merchantId);
    const storeId=checked?.value||null;
    const canEdit=!!storeId && !!permission?.checked;
    try{
      const {error}=await supabaseClient.from('profiles').update({role:'store',store_id:storeId,can_edit_prices:canEdit}).eq('id',merchantId);
      if(error) throw error;
      alert(storeId ? (canEdit?'تم ربط التاجر وتفعيل صلاحية الأسعار والمواد ✅':'تم ربط التاجر مع إبقاء الصلاحية متوقفة.') : 'تم فك ربط التاجر وإيقاف الصلاحية.');
      await window.renderAdmin();
    }catch(err){ alert('تعذر حفظ الصلاحيات: '+(err.message||'خطأ غير معروف')); }
  };

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

  window.loadAdminCompanyVisitorCounts = async function(){
    if(!isAdmin()) return;
    try{
      const {data,error}=await supabaseClient.rpc('admin_company_visitor_counts');
      if(error || !Array.isArray(data)) return;
      data.forEach(row=>{
        const total=$('cv_total_'+row.company_id);
        const unique=$('cv_unique_'+row.company_id);
        if(total) total.textContent=fmt(row.total_visits ?? row.visitor_count ?? 0);
        if(unique) unique.textContent=fmt(row.unique_visitors||0);
      });
    }catch(err){ console.warn('admin company visitor counts:',err); }
  };

  window.renderAdmin = async function(){
    if(!isAdmin()) return;
    window.show('admin');
    $('role').textContent='لوحة تحكم المدير: إدارة الطلبات والمتاجر والتجار والصلاحيات والإحصاءات.';
    const [rq,pr,st,us,co]=await Promise.all([
      supabaseClient.from('change_requests').select('*').eq('status','pending').order('created_at',{ascending:false}),
      supabaseClient.from('products').select('*').order('name'),
      supabaseClient.from('stores').select('*,companies(id,name)').order('name'),
      supabaseClient.from('profiles').select('id,name,role,store_id,can_edit_prices,verified').order('created_at',{ascending:false}),
      supabaseClient.from('companies').select('*').order('name')
    ]);
    const error=rq.error||pr.error||st.error||us.error||co.error;
    if(error){ $('adminPanel').innerHTML=`<div class="card dangerbox">خطأ: ${esc(error.message)}</div>`; return; }
    requests=rq.data||[]; products=pr.data||products||[]; stores=st.data||stores||[];
    const users=us.data||[];
    const companies=co.data||[];
    const merchants=users.filter(u=>u.role==='store'&&u.id!==ADMIN_UID);
    const pending=requests.length ? requests.map(r=>`<div class="priceRow"><div class="accordionHead" data-toggle-id="req_${esc(r.id)}"><b>${esc(r.product_name||'طلب تعديل سعر')}</b><span>▾</span></div><div id="req_${esc(r.id)}" class="accordionBody hidden"><div class="muted">${r.price_new!=null?fmt(r.price_new)+' ل.س جديدة':''}<br>${r.created_at?esc(new Date(r.created_at).toLocaleString('ar')):''}</div><div class="actions"><button class="btn approve" onclick="approveRequest('${esc(r.id)}')">موافقة ونشر</button><button class="btn reject" onclick="rejectRequest('${esc(r.id)}')">رفض</button></div></div></div>`).join('') : '<p class="muted">لا توجد طلبات معلقة.</p>';
    const merchantHtml=merchants.length ? merchants.map(u=>{
      const current=(stores||[]).find(s=>String(s.id)===String(u.store_id));
      return `<div class="priceRow merchantAdminItem">
        <div class="accordionHead" data-toggle-id="merchant_${esc(u.id)}"><div><b>${esc(u.name||'تاجر')}</b><div class="muted">${current?`مرتبط بـ ${esc(current.name)}`:'غير مرتبط بمتجر'} • ${u.can_edit_prices?'الصلاحية مفعّلة':'الصلاحية متوقفة'}</div></div><span>▾</span></div>
        <div id="merchant_${esc(u.id)}" class="accordionBody hidden">
          <p class="muted">اضغط «ربط التاجر بالمتجر» لعرض قائمة المتاجر. يمكن اختيار متجر واحد فقط.</p>
          <div class="actions">
          <button type="button" class="btn secondary" data-link-merchant="${esc(u.id)}">ربط التاجر بالمتجر</button>
          <button type="button" class="btn secondary" onclick="toggleAdminMerchantVerification('${esc(u.id)}')">${u.verified?'إلغاء توثيق التاجر':'توثيق التاجر'}</button>
          <button type="button" class="btn danger" onclick="deleteAdminMerchant('${esc(u.id)}')">حذف التاجر</button>
        </div>
          <div id="merchantStores_${esc(u.id)}" class="hidden" style="margin-top:10px">
            <div class="card"><b>اختر متجرًا واحدًا</b>${(stores||[]).map(s=>`<label class="merchantStoreOption"><input type="radio" name="merchant-store-${esc(u.id)}" value="${esc(s.id)}" ${String(u.store_id)===String(s.id)?'checked':''}> ${esc(s.name)}${s.city?' — '+esc(s.city):''}</label>`).join('') || '<p class="muted">لا توجد متاجر.</p>'}
            <label class="rememberRow"><input id="merchantPermission_${esc(u.id)}" type="checkbox" ${u.can_edit_prices?'checked':''}> تفعيل صلاحيات إضافة وتعديل وحذف مواد وأسعار هذا المتجر</label>
            <div class="actions"><button type="button" class="btn primary" onclick="saveMerchantPermission('${esc(u.id)}')">حفظ الربط والصلاحية</button><button type="button" class="btn danger" onclick="clearMerchantLink('${esc(u.id)}')">فك الربط وتعطيل الصلاحية</button></div></div>
          </div>
        </div>
      </div>`;
    }).join('') : '<p class="muted">لا توجد حسابات تجار حالياً.</p>';
    const storesHtml=(stores||[]).length ? (stores||[]).map(s=>`<div class="priceRow"><div class="accordionHead" data-toggle-id="storeAdmin_${esc(s.id)}"><div><b>${esc(s.name)}</b><div class="muted">${esc([s.city,s.area].filter(Boolean).join(' — '))}</div></div><span>▾</span></div><div id="storeAdmin_${esc(s.id)}" class="accordionBody hidden">${storeImage(s)?`<img class="img storeLogo" src="${esc(storeImage(s))}" alt="${esc(s.name)}">`:''}<div class="muted">${esc(s.address||'')}</div>${s.phone?`<div class="muted">📞 ${esc(s.phone)}</div>`:''}${storeCompany(s)?`<div class="pill companyBadge">🏢 ${esc(storeCompany(s))}</div>`:''}${storeWhatsapp(s)?`<div class="muted">واتساب: ${esc(storeWhatsapp(s))}</div>`:''}<div class="muted">إجمالي زيارات المتجر: <b id="sv_total_${esc(s.id)}">—</b></div><div class="muted">الزوار الفريدون: <b id="sv_unique_${esc(s.id)}">—</b></div><div id="qr_${esc(s.id)}" class="qrbox"></div><div class="actions">
          <button type="button" class="btn secondary" onclick="openStore('${esc(s.id)}')">فتح صفحة المتجر</button>
          <button type="button" class="btn secondary" onclick="printStoreQR('${esc(s.id)}')">طباعة QR</button>
          <button type="button" class="btn primary" onclick="openAdminStoreEdit('${esc(s.id)}')">تعديل المتجر</button>
          <button type="button" class="btn secondary" onclick="toggleAdminStoreVerification('${esc(s.id)}')">${s.verified?'إلغاء توثيق المتجر':'توثيق المتجر'}</button>
          <button type="button" class="btn danger" onclick="deleteAdminStore('${esc(s.id)}')">حذف المتجر</button>
        </div></div></div>`).join('') : '<p class="muted">لا توجد متاجر.</p>';
    const usersHtml=users.filter(u=>u.id!==ADMIN_UID).length ? users.filter(u=>u.id!==ADMIN_UID).map(u=>`<div class="priceRow"><div class="accordionHead" data-toggle-id="user_${esc(u.id)}"><b>${esc(u.name||u.id)}</b><span>▾</span></div><div id="user_${esc(u.id)}" class="accordionBody hidden"><div class="muted">الدور: ${esc(u.role||'user')}${u.store_id?' • مرتبط بمتجر':''}</div><div class="actions"><button type="button" class="btn secondary" onclick="setAccountToUser('${esc(u.id)}')">تحويل إلى مستخدم وإزالة الربط</button></div></div></div>`).join('') : '<p class="muted">لا توجد حسابات.</p>';
    $('adminPanel').innerHTML=`
      <div class="grid"><div class="card"><div class="name">${requests.length}</div><div class="muted">طلبات معلقة</div></div><div class="card"><div class="name">${(stores||[]).length}</div><div class="muted">متاجر</div></div><div class="card"><div class="name">${(products||[]).length}</div><div class="muted">منتجات</div></div><div class="card"><div class="name">${users.length}</div><div class="muted">حسابات</div></div><div class="card"><div class="name" id="visitorCount">—</div><div class="muted">زوار الموقع الفريدون</div></div></div>
      <div class="card"><div class="accordionHead" data-toggle-id="adminRequestsBody"><h2>طلبات التجار</h2><span>▾</span></div><div id="adminRequestsBody" class="accordionBody hidden">${pending}</div></div>
      <div class="card"><h2>إضافة متجر</h2><div class="two"><input id="sn" placeholder="اسم المتجر"><input id="scity" placeholder="المدينة"><input id="sarea" placeholder="المنطقة"><input id="saddr" placeholder="العنوان"><input id="sphone" placeholder="الهاتف"><input id="swhatsapp" placeholder="رابط واتساب المتجر"><select id="scompany"><option value="">بدون شركة</option>${companies.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select><input id="shours" placeholder="ساعات الدوام"><input id="sdays" placeholder="أيام العمل"><input id="simg" type="file" accept="image/*"></div><button class="btn primary" onclick="adminAddStore()">إضافة المتجر</button></div>
      <div class="card"><h2>إدارة الشركات</h2>
        <p class="muted">إضافة وتعديل وتوثيق وحذف الشركات. ربط المتجر بالشركة يتم من شاشة تعديل المتجر.</p>
        <button type="button" class="btn primary" onclick="openAdminCompanyCreate()">إضافة الشركة</button>
        <div id="adminCompaniesList" style="margin-top:12px">${companies.length ? companies.map(c=>`<div class="priceRow" id="companyAdminRow_${esc(c.id)}"><div class="name">${esc(c.name)}</div><div class="muted">${esc(c.phone||'')} ${c.address?'• '+esc(c.address):''}</div><div class="muted">إجمالي الزيارات: <b id="cv_total_${esc(c.id)}">—</b> • الفريدون: <b id="cv_unique_${esc(c.id)}">—</b></div><div class="pill">${c.verified?'✓ موثقة':'غير موثقة'}</div><div class="actions"><button type="button" class="btn secondary" onclick="openAdminCompanyEdit('${esc(c.id)}')">تعديل الشركة</button><button type="button" class="btn secondary" onclick="toggleAdminCompanyVerification('${esc(c.id)}')">${c.verified?'إلغاء التوثيق':'توثيق الشركة'}</button><button type="button" class="btn danger" onclick="deleteAdminCompany('${esc(c.id)}')">حذف الشركة</button></div></div>`).join('') : '<p class="muted">لا توجد شركات.</p>'}</div>
      </div>
      <div id="adminMerchantPermissionsBox" class="card"><div class="accordionHead" data-toggle-id="adminMerchantsBody"><div><h2>إدارة وربط التجار</h2><div class="muted">كل تاجر يمكن ربطه بمتجر واحد، وتفعيل الصلاحية بشكل مستقل.</div></div><span>▾</span></div><div id="adminMerchantsBody" class="accordionBody">${merchantHtml}</div></div>
      <div class="card"><div class="accordionHead" data-toggle-id="adminStoresBody"><h2>إدارة المتاجر</h2><span>▾</span></div><div id="adminStoresBody" class="accordionBody hidden">${storesHtml}</div></div>
      <div class="card"><div class="accordionHead" data-toggle-id="adminUsersBody"><h2>الحسابات</h2><span>▾</span></div><div id="adminUsersBody" class="accordionBody hidden">${usersHtml}</div></div>
      <div class="card"><h2>روابط الموقع</h2><p class="muted">هذه الإعدادات للمدير فقط.</p><div class="two"><input id="siteWhatsapp" placeholder="رابط واتساب الموقع"><input id="siteTelegram" placeholder="رابط تلغرام الموقع"></div><button class="btn primary" onclick="saveSiteLinks()">حفظ روابط الموقع</button><p id="siteLinksMsg" class="muted"></p></div>
      <div class="actions"><button class="btn secondary" onclick="show('home')">العودة للموقع</button><button class="btn secondary" onclick="logout()">تسجيل الخروج</button></div>`;
    bindAdminAccordions();
    $('adminPanel').querySelectorAll('[data-link-merchant]').forEach(btn=>btn.onclick=()=>{
      const box=$('merchantStores_'+btn.dataset.linkMerchant);
      box?.classList.toggle('hidden');
      if(box) btn.textContent=box.classList.contains('hidden')?'ربط التاجر بالمتجر':'إخفاء قائمة المتاجر';
    });
    window.loadVisitorCount();
    window.loadAdminStoreVisitorCounts();
    window.loadAdminCompanyVisitorCounts();
    window.loadSiteLinks();
    setTimeout(buildAllQRCodes,30);
  };

  function bindAdminAccordions(){
    document.querySelectorAll('[data-toggle-id]').forEach(node=>node.onclick=()=>{
      const target=$(node.dataset.toggleId); if(target) target.classList.toggle('hidden');
    });
  }

  window.clearMerchantLink = async function(id){
    if(!isAdmin()) return;
    const {error}=await supabaseClient.from('profiles').update({role:'store',store_id:null,can_edit_prices:false}).eq('id',id);
    if(error) return alert(error.message);
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
    (stores||[]).forEach(s=>{ const box=$('qr_'+s.id); if(!box) return; box.innerHTML=''; new QRCode(box,{text:window.storeUrl(s.id),width:160,height:160,correctLevel:QRCode.CorrectLevel.H}); });
  };

  window.printStoreQR = function(id){
    const st=(stores||[]).find(x=>String(x.id)===String(id)); if(!st) return;
    const url=window.storeUrl(id); const w=window.open('','_blank'); if(!w) return alert('اسمح بفتح النوافذ المنبثقة لطباعة QR.');
    const safeName=esc(st.name), safeUrl=esc(url);
    const html='<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>QR - '+safeName+'</title></head><body style="font-family:Arial;text-align:center;padding:30px"><h2>'+safeName+'</h2><div id="qrprint"></div><p>'+safeUrl+'</p><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script><script>new QRCode(document.getElementById("qrprint"),{text:'+JSON.stringify(url)+',width:300,height:300,correctLevel:QRCode.CorrectLevel.H});setTimeout(function(){window.print();},800);<\/script></body></html>';
    w.document.open();w.document.write(html);w.document.close();
  };

})();
