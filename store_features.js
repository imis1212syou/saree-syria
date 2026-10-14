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
  const storeMaterialDetails = new Map();

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

  const SAREE_LOCATION_KEY = 'saree_visitor_location_v1';
  const HOME_NEARBY_BATCH_SIZE = 3;
  let homeNearbyVisibleCount = HOME_NEARBY_BATCH_SIZE;
  let homeLocationLeafletPromise = null;
  let homeLocationMap = null;
  let homeLocationMarker = null;
  let homeLocationPickedCoords = null;

  function validCoordinates(lat,lng){
    return Number.isFinite(Number(lat))&&Number.isFinite(Number(lng))&&Number(lat)>=-90&&Number(lat)<=90&&Number(lng)>=-180&&Number(lng)<=180;
  }
  function locationHasCoordinates(loc=window.__sareeLocation){
    return !!loc&&(loc.source==='gps'||loc.source==='map')&&loc.lat!=null&&loc.lng!=null&&validCoordinates(loc.lat,loc.lng);
  }
  function readSavedLocation(){
    try{
      const v=JSON.parse(localStorage.getItem(SAREE_LOCATION_KEY)||'null');
      if(!v||typeof v!=='object')return null;
      const lat=v.lat==null?null:Number(v.lat),lng=v.lng==null?null:Number(v.lng);
      if(validCoordinates(lat,lng))return {...v,lat,lng,ready:true,source:v.source==='map'?'map':'gps'};
      if(v.city)return {...v,lat:null,lng:null,ready:true,source:'area'};
    }catch(_){}
    return null;
  }
  const savedLocation=readSavedLocation();
  window.__sareeLocation=Object.assign({lat:null,lng:null,city:'',area:'',requested:false,ready:false,source:null},savedLocation||{},window.__sareeLocation||{});
  function saveLocation(){
    const l=window.__sareeLocation;
    try{localStorage.setItem(SAREE_LOCATION_KEY,JSON.stringify({lat:l.lat??null,lng:l.lng??null,city:l.city||'',area:l.area||'',source:l.source||'area',updated_at:new Date().toISOString()}));}
    catch(err){console.warn('save visitor location:',err);}
  }
  function hasCoords(v){return v?.latitude!==null&&v?.latitude!==undefined&&v?.longitude!==null&&v?.longitude!==undefined&&validCoordinates(v.latitude,v.longitude);}
  function haversine(lat1,lon1,lat2,lon2){
    const rad=n=>Number(n)*Math.PI/180;
    const R=6371;
    const dLat=rad(lat2-lat1),dLon=rad(lon2-lon1);
    const a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(Math.min(1,a)));
  }
  function storeDistanceKm(st){
    const loc=window.__sareeLocation;
    if(!locationHasCoordinates(loc)||!hasCoords(st))return null;
    return haversine(Number(loc.lat),Number(loc.lng),Number(st.latitude),Number(st.longitude));
  }
  function distanceText(st){const km=storeDistanceKm(st);if(km===null)return '';return km<1?Math.round(km*1000)+' م':km.toFixed(1)+' كم';}
  function localityRank(st){
    const loc=window.__sareeLocation,city=String(loc?.city||'').trim(),area=String(loc?.area||'').trim();
    if(!city)return 5;
    if(area&&String(st?.area||'').trim()===area&&String(st?.city||'').trim()===city)return 0;
    if(String(st?.city||'').trim()===city)return 1;
    return 2;
  }
  function sortStoresByProximity(list){
    const loc=window.__sareeLocation;
    return [...(list||[])].sort((a,b)=>{
      if(locationHasCoordinates(loc)){
        const da=storeDistanceKm(a),db=storeDistanceKm(b);
        if(da!==null&&db!==null&&da!==db)return da-db;
        if((da!==null)!==(db!==null))return da!==null?-1:1;
      }else if(loc?.city){
        const ra=localityRank(a),rb=localityRank(b);if(ra!==rb)return ra-rb;
      }
      return String(a?.name||'').localeCompare(String(b?.name||''),'ar');
    });
  }
  function updateLocationStatus(){
    const node=$('homeLocationStatus');
    const loc=window.__sareeLocation;
    if(node){
      if(loc?.source==='gps'&&locationHasCoordinates(loc))node.textContent='تم حفظ موقعك على هذا الجهاز. المتاجر ذات المواقع المسجلة مرتبة حسب المسافة الفعلية.';
      else if(loc?.source==='map'&&locationHasCoordinates(loc))node.textContent='تم اختيار موقعك على الخريطة. المتاجر ذات المواقع المسجلة مرتبة حسب المسافة الفعلية.';
      else if(loc?.city)node.textContent='الموقع المختار: '+[loc.city,loc.area].filter(Boolean).join(' — ')+'. الترتيب حسب المنطقة، والمسافة الدقيقة تحتاج تحديد الموقع الجغرافي.';
      else node.textContent='حدّد موقعك الحالي أو اختر نقطة من الخريطة لعرض المتاجر الأقرب.';
    }
    const btn=$('homeLocationBtn');if(btn)btn.textContent=loc?.source==='gps'?'تحديث موقعي':'تحديد موقعي';
    const clearBtn=$('homeLocationClearBtn');
    if(clearBtn)clearBtn.classList.toggle('hidden',!(loc?.source==='map'||loc?.source==='area'));
  }
  function updateDistancesInPlace(){
    document.querySelectorAll('[data-store-distance]').forEach(node=>{
      const st=(stores||[]).find(s=>String(s.id)===String(node.dataset.storeDistance));if(!st)return;
      const txt=distanceText(st);node.textContent=txt?'📏 '+txt:'';node.classList.toggle('hidden',!txt);
    });
  }
  window.sareeLocateIntoFields=function(latId,lngId,msgId){
    const msg=$(msgId);
    if(!navigator.geolocation){if(msg)msg.textContent='تحديد الموقع غير مدعوم في هذا الجهاز.';return;}
    if(msg)msg.textContent='جارٍ تحديد الموقع...';
    navigator.geolocation.getCurrentPosition(pos=>{
      if($(latId))$(latId).value=pos.coords.latitude.toFixed(7);
      if($(lngId))$(lngId).value=pos.coords.longitude.toFixed(7);
      if(msg)msg.textContent='تم تحديد الإحداثيات. اضغط حفظ لتسجيل الموقع.';
    },err=>{if(msg)msg.textContent=err.code===1?'لم تسمح بالوصول إلى الموقع. يمكنك إدخال الإحداثيات يدويًا.':'تعذر تحديد الموقع. تحقق من إعدادات الموقع والاتصال.';},{enableHighAccuracy:true,timeout:15000,maximumAge:60000});
  };
  function closeLocationActivationDialog(){
    const modal=$('sareeLocationActivationDialog');
    if(modal)modal.remove();
  }
  function setLocationActivationMessage(message){
    const modal=$('sareeLocationActivationDialog');
    const help=modal?.querySelector('[data-location-help="1"]');
    if(help)help.textContent=message;
  }
  function showLocationActivationDialog(errorCode=0){
    if($('sareeLocationActivationDialog'))return;
    const modal=document.createElement('div');
    modal.id='sareeLocationActivationDialog';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-labelledby','sareeLocationActivationTitle');
    modal.dir='rtl';
    modal.style.cssText='position:fixed;inset:0;z-index:200000;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.56);padding:0;';
    const initialHelp = errorCode===1
      ? 'لم يتم منح إذن الوصول إلى موقعك. يمكنك المحاولة مجددًا ومنح الإذن من نافذة المتصفح إذا ظهرت.'
      : errorCode===2
        ? 'تعذر الحصول على موقعك في المحاولة السابقة. اضغط «تفعيل موقعي» للمحاولة مجددًا.'
        : 'اضغط «تفعيل موقعي» ليطلب المتصفح إذن الوصول إلى موقعك. يمكنك اختيار السماح أو عدم السماح.';
    modal.innerHTML=`
      <div style="box-sizing:border-box;width:100%;max-width:560px;background:var(--card-bg,#fff);color:var(--text-color,#152d35);border-radius:22px 22px 0 0;padding:25px 22px calc(24px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 30px rgba(0,0,0,.22);font-family:inherit">
        <h2 id="sareeLocationActivationTitle" style="margin:0 0 14px;font-size:25px;line-height:1.4">السماح بالوصول إلى موقعك</h2>
        <p data-location-help="1" style="margin:0 0 16px;font-size:17px;line-height:1.9">${initialHelp}</p>
        <p style="margin:0 0 22px;font-size:14px;line-height:1.8;opacity:.8">لن يصل الموقع إلى موقعك إلا بعد موافقتك من نافذة المتصفح، ويمكنك رفض الطلب.</p>
        <button type="button" data-location-activate="1" style="width:100%;border:0;border-radius:14px;padding:15px 16px;margin:0 0 10px;background:linear-gradient(115deg,#2999cb,#20a68e);color:white;font:inherit;font-weight:700;font-size:17px;cursor:pointer">تفعيل موقعي</button>
        <button type="button" data-location-cancel="1" style="width:100%;border:1px solid #d7e4e8;border-radius:14px;padding:13px 16px;background:transparent;color:inherit;font:inherit;font-size:16px;cursor:pointer">إلغاء</button>
      </div>`;
    modal.addEventListener('click',ev=>{if(ev.target===modal)closeLocationActivationDialog();});
    modal.querySelector('[data-location-cancel]')?.addEventListener('click',closeLocationActivationDialog);
    const activateBtn=modal.querySelector('[data-location-activate]');
    activateBtn?.addEventListener('click',()=>{
      // طلب الموقع مباشرة من نقرة المستخدم حتى يتمكن المتصفح من إظهار نافذة السماح/الرفض.
      // تبقى نافذة الموقع ظاهرة إذا تعذر الطلب، ولا يُفتح إعداد النظام أو رابط intent.
      setLocationActivationMessage('جارٍ طلب إذن الوصول إلى موقعك من المتصفح. اختر «السماح» أو «عدم السماح» في نافذة المتصفح.');
      const status=$('homeLocationStatus');
      if(status)status.textContent='جارٍ طلب إذن الوصول إلى موقعك من المتصفح...';
      window.requestSareeLocation(true, true);
    });
    document.body.appendChild(modal);
    activateBtn?.focus({preventScroll:true});
  }

  window.requestSareeLocation=function(force=true,fromActivationDialog=false){
    const state=window.__sareeLocation;
    if(!force&&state?.source==='gps'&&locationHasCoordinates(state)){updateLocationStatus();renderHomeNearbyStores();updateDistancesInPlace();return Promise.resolve(true);}
    if(state.requested)return Promise.resolve(false);
    if(!navigator.geolocation){
      const message='هذا المتصفح لا يدعم طلب إذن الموقع. يمكنك اختيار موقعك على الخريطة.';
      const node=$('homeLocationStatus');if(node)node.textContent=message;
      if(fromActivationDialog)setLocationActivationMessage(message);
      return Promise.resolve(false);
    }
    if(window.isSecureContext===false&&location.hostname!=='localhost'&&location.hostname!=='127.0.0.1'){
      const message='يجب فتح الموقع عبر HTTPS حتى يتمكن المتصفح من طلب إذن الوصول إلى موقعك.';
      const node=$('homeLocationStatus');if(node)node.textContent=message;
      if(fromActivationDialog)setLocationActivationMessage(message);
      return Promise.resolve(false);
    }
    state.requested=true;
    const status=$('homeLocationStatus'),btn=$('homeLocationBtn'),iconBtn=$('homeNearbyLocateIcon');
    if(status)status.textContent='جارٍ تحديد موقعك من الهاتف...';
    [btn,iconBtn].filter(Boolean).forEach(x=>{x.disabled=true;x.setAttribute('aria-busy','true');});
    const finish=()=>[btn,iconBtn].filter(Boolean).forEach(x=>{x.disabled=false;x.removeAttribute('aria-busy');});
    return new Promise(resolve=>{
      try{
        navigator.geolocation.getCurrentPosition(pos=>{
          state.lat=Number(pos.coords.latitude);state.lng=Number(pos.coords.longitude);state.city='';state.area='';state.ready=true;state.source='gps';state.requested=false;
          closeLocationActivationDialog();
          if($('homeLocationCity'))$('homeLocationCity').value='';if($('homeLocationArea'))$('homeLocationArea').value='';
          homeNearbyVisibleCount=HOME_NEARBY_BATCH_SIZE;saveLocation();finish();updateLocationStatus();renderHomeNearbyStores();updateDistancesInPlace();
          if(typeof window.renderStores==='function'&&$('stores')?.classList.contains('active'))window.renderStores();
          resolve(true);
        },err=>{
          state.requested=false;finish();
          let locationErrorMessage='تعذر الحصول على موقعك. يمكنك المحاولة مجددًا أو اختيار موقعك على الخريطة.';
          if(err?.code===1)locationErrorMessage='لم يتم منح إذن الوصول إلى موقعك. يمكنك المحاولة مجددًا.';
          else if(err?.code===2)locationErrorMessage='لم يتمكن المتصفح من الحصول على موقعك هذه المرة. يمكنك المحاولة مجددًا.';
          else if(err?.code===3)locationErrorMessage='استغرق تحديد الموقع وقتًا طويلًا. يمكنك المحاولة مجددًا.';
          if(status)status.textContent=locationErrorMessage;
          // لا نحفظ الرفض ولا نعرض نافذة مخصصة بعد رفض نافذة النظام.
          // عند ضغط المستخدم على «تحديد موقعي» مجددًا نطلب الموقع مباشرة من النظام/المتصفح.
          if(fromActivationDialog)setLocationActivationMessage(locationErrorMessage);
          resolve(false);
        },{enableHighAccuracy:true,timeout:20000,maximumAge:force?0:300000});
      }catch(err){
        state.requested=false;finish();
        const message='تعذر بدء طلب الموقع. يمكنك المحاولة مجددًا أو اختيار موقعك على الخريطة.';
        if(status)status.textContent=message;
        if(fromActivationDialog)setLocationActivationMessage(message);
        console.warn('geolocation:',err);resolve(false);
      }
    });
  };

  function mapDefaultView(){
    const loc=window.__sareeLocation;
    if(locationHasCoordinates(loc))return {center:[Number(loc.lat),Number(loc.lng)],zoom:14};
    if(loc?.city){
      const matching=(stores||[]).filter(st=>hasCoords(st)&&String(st.city||'').trim()===String(loc.city).trim()&&(!loc.area||String(st.area||'').trim()===String(loc.area).trim()));
      if(matching.length){return {center:[matching.reduce((n,s)=>n+Number(s.latitude),0)/matching.length,matching.reduce((n,s)=>n+Number(s.longitude),0)/matching.length],zoom:13};}
    }
    return {center:[35,38.5],zoom:6};
  }
  function loadHomeLocationLeaflet(){
    if(window.L)return Promise.resolve(window.L);
    if(homeLocationLeafletPromise)return homeLocationLeafletPromise;
    homeLocationLeafletPromise=new Promise((resolve,reject)=>{
      if(!document.getElementById('saree-leaflet-css')){
        const css=document.createElement('link');css.id='saree-leaflet-css';css.rel='stylesheet';css.href='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(css);
      }
      const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';script.async=true;
      script.onload=()=>window.L?resolve(window.L):reject(new Error('Leaflet library did not initialize'));
      script.onerror=()=>reject(new Error('Could not load map library'));
      document.head.appendChild(script);
    }).catch(err=>{homeLocationLeafletPromise=null;throw err;});
    return homeLocationLeafletPromise;
  }
  function ensureHomeLocationMapDialog(){
    let modal=$('homeLocationMapModal');if(modal)return modal;
    modal=document.createElement('div');modal.id='homeLocationMapModal';modal.className='homeLocationMapModal hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','homeLocationMapTitle');
    modal.innerHTML=`<div class="homeLocationMapDialog"><div class="homeLocationMapHeader"><div><h3 id="homeLocationMapTitle">اختر موقعك على الخريطة</h3><p>قرّب الخريطة ثم اضغط على النقطة التي تريد اعتمادها.</p></div><button type="button" id="homeLocationMapClose" class="homeLocationMapClose" aria-label="إغلاق">×</button></div><p id="homeLocationMapStatus" class="homeLocationMapStatus" aria-live="polite">جارٍ تحميل الخريطة...</p><div id="homeLocationMapCanvas" class="homeLocationMapCanvas"></div><div id="homeLocationMapFallback" class="homeLocationMapFallback hidden"><p>تعذر تحميل الخريطة. يمكنك إدخال إحداثيات الموقع يدويًا مؤقتًا.</p><div class="homeLocationMapCoordsInputs"><input id="homeMapLatitude" type="number" step="any" min="-90" max="90" placeholder="خط العرض Latitude" aria-label="خط العرض"><input id="homeMapLongitude" type="number" step="any" min="-180" max="180" placeholder="خط الطول Longitude" aria-label="خط الطول"></div></div><p id="homeLocationMapCoords" class="homeLocationMapCoords">لم يتم اختيار نقطة بعد.</p><div class="homeLocationMapActions"><button type="button" id="homeLocationMapClearPoint" class="btn secondary">مسح النقطة</button><button type="button" id="homeLocationMapCancel" class="btn secondary">إلغاء</button><button type="button" id="homeLocationMapApply" class="btn primary" disabled>اعتماد هذا الموقع</button></div><div class="homeLocationMapAttribution">الخرائط © OpenStreetMap</div></div>`;
    document.body.appendChild(modal);
    const close=()=>{modal.classList.add('hidden');};
    $('homeLocationMapClose')?.addEventListener('click',close);$('homeLocationMapCancel')?.addEventListener('click',close);
    modal.addEventListener('click',e=>{if(e.target===modal)close();});
    const validateFallbackCoords=()=>{
      const lat=String($('homeMapLatitude')?.value??'').trim(),lng=String($('homeMapLongitude')?.value??'').trim();
      const valid=lat!==''&&lng!==''&&validCoordinates(lat,lng);
      const applyBtn=$('homeLocationMapApply');if(applyBtn&&fallbackVisible())applyBtn.disabled=!valid;
      if(valid){const coords=$('homeLocationMapCoords');if(coords)coords.textContent=`الموقع المدخل: ${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;}
    };
    const fallbackVisible=()=>!!($('homeLocationMapFallback')&&!$('homeLocationMapFallback').classList.contains('hidden'));
    $('homeMapLatitude')?.addEventListener('input',validateFallbackCoords);$('homeMapLongitude')?.addEventListener('input',validateFallbackCoords);
    $('homeLocationMapClearPoint')?.addEventListener('click',()=>{
      homeLocationPickedCoords=null;if(homeLocationMarker&&homeLocationMap){homeLocationMap.removeLayer(homeLocationMarker);homeLocationMarker=null;}
      const coords=$('homeLocationMapCoords');if(coords)coords.textContent='لم يتم اختيار نقطة بعد.';
      if($('homeLocationMapApply'))$('homeLocationMapApply').disabled=true;
      if($('homeMapLatitude'))$('homeMapLatitude').value='';if($('homeMapLongitude'))$('homeMapLongitude').value='';
    });
    $('homeLocationMapApply')?.addEventListener('click',()=>{
      let point=homeLocationPickedCoords;
      if($('homeLocationMapFallback')&&!$('homeLocationMapFallback').classList.contains('hidden')){
        const lat=String($('homeMapLatitude')?.value??'').trim(),lng=String($('homeMapLongitude')?.value??'').trim();
        if(lat===''||lng===''||!validCoordinates(lat,lng)){const s=$('homeLocationMapStatus');if(s)s.textContent='أدخل خط العرض وخط الطول بشكل صحيح.';return;}
        point={lat:Number(lat),lng:Number(lng)};
      }
      if(!point||!validCoordinates(point.lat,point.lng)){const s=$('homeLocationMapStatus');if(s)s.textContent='اضغط على الخريطة لاختيار موقع أولًا.';return;}
      const state=window.__sareeLocation;state.lat=Number(point.lat);state.lng=Number(point.lng);state.city='';state.area='';state.ready=true;state.source='map';state.requested=false;
      try{saveLocation();}catch(_){}
      homeNearbyVisibleCount=HOME_NEARBY_BATCH_SIZE;
      const citySel=$('homeLocationCity'),areaSel=$('homeLocationArea');if(citySel)citySel.value='';if(areaSel)areaSel.value='';
      modal.classList.add('hidden');updateLocationStatus();renderHomeNearbyStores();updateDistancesInPlace();
      if(typeof window.renderStores==='function'&&$('stores')?.classList.contains('active'))window.renderStores();
    });
    return modal;
  }
  async function openHomeLocationMap(){
    const modal=ensureHomeLocationMapDialog();modal.classList.remove('hidden');
    const status=$('homeLocationMapStatus'),canvas=$('homeLocationMapCanvas'),fallback=$('homeLocationMapFallback'),apply=$('homeLocationMapApply');
    if(status)status.textContent='جارٍ تحميل الخريطة...';if(canvas)canvas.classList.remove('hidden');if(fallback)fallback.classList.add('hidden');if(apply)apply.disabled=!locationHasCoordinates(window.__sareeLocation);
    if($('homeMapLatitude'))$('homeMapLatitude').value='';if($('homeMapLongitude'))$('homeMapLongitude').value='';
    const initial=mapDefaultView();
    homeLocationPickedCoords=locationHasCoordinates(window.__sareeLocation)?{lat:Number(window.__sareeLocation.lat),lng:Number(window.__sareeLocation.lng)}:null;
    if(homeLocationPickedCoords){const c=$('homeLocationMapCoords');if(c)c.textContent=`الموقع المحدد: ${homeLocationPickedCoords.lat.toFixed(6)}, ${homeLocationPickedCoords.lng.toFixed(6)}`;}
    else{const c=$('homeLocationMapCoords');if(c)c.textContent='لم يتم اختيار نقطة بعد.';}
    try{
      const L=await loadHomeLocationLeaflet();
      if(modal.classList.contains('hidden'))return;
      if(!homeLocationMap){
        homeLocationMap=L.map('homeLocationMapCanvas',{zoomControl:true,scrollWheelZoom:true}).setView(initial.center,initial.zoom);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(homeLocationMap);
        homeLocationMap.on('click',event=>{
          homeLocationPickedCoords={lat:Number(event.latlng.lat),lng:Number(event.latlng.lng)};
          if(homeLocationMarker)homeLocationMarker.setLatLng(event.latlng);else homeLocationMarker=L.marker(event.latlng).addTo(homeLocationMap);
          const coords=$('homeLocationMapCoords');if(coords)coords.textContent=`الموقع المحدد: ${homeLocationPickedCoords.lat.toFixed(6)}, ${homeLocationPickedCoords.lng.toFixed(6)}`;
          const confirmBtn=$('homeLocationMapApply');if(confirmBtn)confirmBtn.disabled=false;
          const msg=$('homeLocationMapStatus');if(msg)msg.textContent='اضغط «اعتماد هذا الموقع» لحفظ النقطة المحددة.';
        });
      }
      homeLocationMap.setView(initial.center,initial.zoom);
      if(homeLocationMarker){homeLocationMap.removeLayer(homeLocationMarker);homeLocationMarker=null;}
      if(homeLocationPickedCoords){homeLocationMarker=L.marker([homeLocationPickedCoords.lat,homeLocationPickedCoords.lng]).addTo(homeLocationMap);if(apply)apply.disabled=false;}else if(apply)apply.disabled=true;
      if(status)status.textContent='قرّب الخريطة واضغط على أي مكان لاختيار نقطة جديدة.';
      setTimeout(()=>{try{homeLocationMap?.invalidateSize();}catch(_){}},100);
    }catch(err){
      console.warn('map load:',err);if(canvas)canvas.classList.add('hidden');if(fallback)fallback.classList.remove('hidden');
      const msg=$('homeLocationMapStatus');if(msg)msg.textContent='لم نتمكن من تحميل الخريطة. تحقق من الاتصال أو أدخل الإحداثيات يدويًا.';
      if(homeLocationPickedCoords){if($('homeMapLatitude'))$('homeMapLatitude').value=homeLocationPickedCoords.lat;if($('homeMapLongitude'))$('homeMapLongitude').value=homeLocationPickedCoords.lng;if(apply)apply.disabled=false;}else if(apply)apply.disabled=true;
    }
  }
  function clearManualLocation(){
    const state=window.__sareeLocation;state.lat=null;state.lng=null;state.city='';state.area='';state.ready=false;state.source=null;state.requested=false;
    try{localStorage.removeItem(SAREE_LOCATION_KEY);}catch(err){console.warn('clear saved visitor location:',err);}
    homeNearbyVisibleCount=HOME_NEARBY_BATCH_SIZE;
    const citySel=$('homeLocationCity'),areaSel=$('homeLocationArea');if(citySel)citySel.value='';if(areaSel)areaSel.value='';
    updateLocationStatus();renderHomeNearbyStores();updateDistancesInPlace();
  }
  function setupHomeLocationControls(){
    const citySel=$('homeLocationCity'),areaSel=$('homeLocationArea');if(!citySel||!areaSel)return;
    const rows=Array.isArray(stores)?stores:[],cities=[...new Set(rows.map(st=>String(st.city||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const oldCity=citySel.value||window.__sareeLocation.city||'';
    citySel.innerHTML='<option value="">اختر المدينة يدويًا</option>'+cities.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    citySel.value=cities.includes(oldCity)?oldCity:'';
    function syncAreas(){
      const city=citySel.value,areas=[...new Set(rows.filter(st=>!city||String(st.city||'').trim()===city).map(st=>String(st.area||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
      const oldArea=areaSel.value||window.__sareeLocation.area||'';
      areaSel.innerHTML='<option value="">كل مناطق المدينة</option>'+areas.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('');
      areaSel.value=areas.includes(oldArea)?oldArea:'';
    }
    citySel.onchange=()=>syncAreas();syncAreas();
    const savedCity=window.__sareeLocation.city||'',savedArea=window.__sareeLocation.area||'';
    if(savedCity&&cities.includes(savedCity)){citySel.value=savedCity;syncAreas();if(savedArea)areaSel.value=savedArea;}
    if($('homeLocationBtn')&&!$('homeLocationBtn').dataset.locationBound){$('homeLocationBtn').dataset.locationBound='1';$('homeLocationBtn').addEventListener('click',()=>window.requestSareeLocation(true));}
    if($('homeNearbyLocateIcon')&&!$('homeNearbyLocateIcon').dataset.locationBound){$('homeNearbyLocateIcon').dataset.locationBound='1';$('homeNearbyLocateIcon').addEventListener('click',()=>window.requestSareeLocation(true));}
    if($('homeLocationMapBtn')&&!$('homeLocationMapBtn').dataset.locationBound){$('homeLocationMapBtn').dataset.locationBound='1';$('homeLocationMapBtn').addEventListener('click',openHomeLocationMap);}
    if($('homeLocationClearBtn')&&!$('homeLocationClearBtn').dataset.locationBound){$('homeLocationClearBtn').dataset.locationBound='1';$('homeLocationClearBtn').addEventListener('click',clearManualLocation);}
    if($('homeLocationSaveBtn')&&!$('homeLocationSaveBtn').dataset.locationBound){$('homeLocationSaveBtn').dataset.locationBound='1';$('homeLocationSaveBtn').addEventListener('click',()=>{
      const city=citySel.value,area=areaSel.value;if(!city){alert('اختر المدينة أولاً.');return;}
      const state=window.__sareeLocation;state.lat=null;state.lng=null;state.city=city;state.area=area;state.ready=true;state.source='area';state.requested=false;
      homeNearbyVisibleCount=HOME_NEARBY_BATCH_SIZE;saveLocation();updateLocationStatus();renderHomeNearbyStores();updateDistancesInPlace();
      if(typeof window.renderStores==='function'&&$('stores')?.classList.contains('active'))window.renderStores();
    });}
    if($('homeNearbyMoreBtn')&&!$('homeNearbyMoreBtn').dataset.locationBound){$('homeNearbyMoreBtn').dataset.locationBound='1';$('homeNearbyMoreBtn').addEventListener('click',()=>{
      const sorted=sortStoresByProximity(Array.isArray(stores)?stores:[]);
      if(homeNearbyVisibleCount<sorted.length){
        homeNearbyVisibleCount=Math.min(sorted.length,homeNearbyVisibleCount+HOME_NEARBY_BATCH_SIZE);
        renderHomeNearbyStores();
      }else{
        const status=$('homeLocationStatus');
        if(status)status.textContent='لا توجد متاجر قريبة إضافية للعرض حاليًا.';
      }
    });}
    if($('homeAllStoresBtn')&&!$('homeAllStoresBtn').dataset.locationBound){$('homeAllStoresBtn').dataset.locationBound='1';$('homeAllStoresBtn').addEventListener('click',()=>window.openNav?window.openNav('stores'):window.show('stores'));}
    updateLocationStatus();
  }
  function renderHomeNearbyStores(){
    const box=$('homeNearbyStores');if(!box)return;
    const all=Array.isArray(stores)?stores:[],sorted=sortStoresByProximity(all),loc=window.__sareeLocation;
    const footer=document.querySelector('#home .homeNearbyFooter'),moreBtn=$('homeNearbyMoreBtn');
    if(!all.length){box.innerHTML='<div class="homeNearbyEmpty">ستظهر المتاجر هنا عند توفرها.</div>';if(moreBtn)moreBtn.classList.add('hidden');if(footer)footer.classList.add('hidden');return;}
    if(!loc?.ready||(!locationHasCoordinates(loc)&&!loc.city)){
      box.innerHTML='<div class="homeNearbyEmpty homeNearbyEmptyCompact"><p>حدّد موقعك الحالي أو اختر نقطة على الخريطة لعرض المتاجر الأقرب إليك.</p></div>';
      if(moreBtn)moreBtn.classList.add('hidden');if(footer)footer.classList.remove('hidden');return;
    }
    const visible=sorted.slice(0,Math.max(HOME_NEARBY_BATCH_SIZE,homeNearbyVisibleCount));
    box.innerHTML=visible.map(st=>{
      const img=storeImage(st),dist=distanceText(st),company=storeCompany(st);
      const local=!dist&&loc.source==='area'&&localityRank(st)<2?`<span class="homeNearDistance">${localityRank(st)===0?'في منطقتك':'في مدينتك'}</span>`:'';
      return `<article class="homeNearCard"><button type="button" class="homeNearMain" data-home-store-open="${esc(st.id)}">${img?`<img class="homeNearImage" src="${esc(img)}" alt="${esc(st.name||'المتجر')}" loading="lazy">`:'<span class="homeNearImage homeNearPlaceholder" aria-hidden="true">🏪</span>'}<span class="homeNearInfo"><b>${esc(st.name||'متجر')}</b>${company?`<small>${esc(company)}</small>`:''}<small>${esc([st.city,st.area].filter(Boolean).join(' — ')||'الموقع غير مضاف')}</small>${dist?`<span class="homeNearDistance">📍 يبعد ${esc(dist)}</span>`:local}</span></button></article>`;
    }).join('');
    box.querySelectorAll('[data-home-store-open]').forEach(btn=>btn.addEventListener('click',()=>window.openStore?.(btn.dataset.homeStoreOpen)));
    if(footer)footer.classList.remove('hidden');
    if(moreBtn){
      // Keep the More button visible after a location has been selected.
      // Each click loads the next batch; if there are no more records, the click handler explains that.
      moreBtn.classList.remove('hidden');
      moreBtn.textContent='المزيد';
      moreBtn.setAttribute('aria-label','عرض المزيد من المتاجر القريبة');
    }
  }
  window.renderHomeNearbyStores=renderHomeNearbyStores;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupHomeLocationControls);else setupHomeLocationControls();

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
    const list = sortStoresByProximity(Array.isArray(stores) ? stores : []);
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
    setupHomeLocationControls();
    renderHomeNearbyStores();
    updateLocationStatus();
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
    }).sort((a,b)=>priceNumber(a.c)-priceNumber(b.c));
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
    const st = (stores || []).find(x=>String(x.id)===String(storeId)) || null;
    if(!rows.length) return '<div class="card muted">لا توجد أسعار معتمدة لهذا المتجر حالياً.</div>';
    return rows.map(row=>{
      const p = row.products || {};
      const productId = p.id || row.product_id || '';
      const barcode = normBarcode(p.barcode || row.barcode || '');
      const category = p.category || 'عام';
      const searchText = [p.name,p.description,p.brand,p.unit,p.category,barcode].filter(Boolean).join(' ').toLocaleLowerCase();
      const canCart = Boolean(st && productId && window.sareeStoreWhatsappOrdersEnabled?.(st) && typeof window.sareeCartAdd==='function');
      const key = `${String(storeId)}:${String(productId)}`;
      storeMaterialDetails.set(key,{row,storeId,store:st});
      return `<article class="card storeProductCard" data-product-id="${esc(productId)}" data-material-search="${esc(searchText)}" data-material-category="${esc(category)}">
        ${p.image_url ? `<img class="img materialImage" src="${esc(p.image_url)}" alt="${esc(p.name || 'مادة')}" loading="lazy">` : ''}
        <span class="pill">${esc(category)}</span>
        <div class="name">${esc(p.name || 'مادة')}</div>
        ${p.brand ? `<div class="muted">${esc(p.brand)}</div>` : ''}
        ${p.unit ? `<div class="muted">${esc(p.unit)}</div>` : ''}
        ${barcode ? `<div class="muted">باركود: ${esc(barcode)}</div>` : ''}
        <div class="price">${fmt(priceNumber(row))} ل.س جديدة</div>
        <div class="old">${priceOld(priceNumber(row))} ل.س قديمة</div>
        ${p.description ? `<div class="muted storeProductDescription">${esc(p.description)}</div>` : ''}
        <div class="muted">آخر تحديث: ${row.updated_at ? esc(new Date(row.updated_at).toLocaleString('ar')) : '—'}</div>
        <div class="actions">
          <button type="button" class="btn primary" data-material-detail="${esc(productId)}" data-store-id="${esc(storeId)}">تفاصيل المادة</button>
          ${canCart ? `<button type="button" class="btn primary" data-saree-add="1" data-store-cart-add="${esc(productId)}" data-store-id="${esc(storeId)}">إضافة للسلة</button>` : ''}
          ${canEdit ? `<button type="button" class="btn secondary" data-edit-listing="${esc(row.id)}" data-store-id="${esc(storeId)}">تعديل المادة</button><button type="button" class="btn danger" data-delete-listing="${esc(row.id)}" data-store-id="${esc(storeId)}">حذف</button>` : ''}
        </div>
      </article>`;
    }).join('');
  }

  function ensureStoreMaterialDetailsCss(){
    if($('storeMaterialDetailsCss'))return;
    const style=document.createElement('style');style.id='storeMaterialDetailsCss';
    style.textContent=`.store-material-modal{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.78);padding:12px;overflow:auto;display:block}.store-material-modal-inner{width:min(760px,100%);margin:20px auto;background:var(--card-bg,#10191e);border:1px solid var(--border-color,#303b40);border-radius:20px;padding:16px;color:inherit;box-shadow:0 18px 55px rgba(0,0,0,.35)}.store-material-modal-inner .actions{display:flex;gap:8px;flex-wrap:wrap}`;
    document.head.appendChild(style);
  }

  window.openStoreMaterialDetails = function(storeId,productId){
    const item=storeMaterialDetails.get(`${String(storeId)}:${String(productId)}`);
    if(!item)return alert('تعذر العثور على تفاصيل هذه المادة. أعد فتح صفحة المتجر.');
    const {row,store}=item;const p=row.products||{};const canEdit=canManageStore(storeId);
    const hasCart=Boolean(store && window.sareeStoreWhatsappOrdersEnabled?.(store) && typeof window.sareeCartAdd==='function' && p.id);
    ensureStoreMaterialDetailsCss();
    const existing=document.getElementById('storeMaterialDetailsModal');existing?.remove();
    const modal=document.createElement('div');modal.id='storeMaterialDetailsModal';modal.className='store-material-modal';
    modal.innerHTML=`<div class="store-material-modal-inner"><div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">${esc(p.name||'تفاصيل المادة')}</h2><button type="button" class="btn secondary" id="storeMaterialDetailsClose">إغلاق</button></div>${p.image_url?`<img class="img" style="height:220px;object-fit:contain" src="${esc(p.image_url)}" alt="${esc(p.name||'مادة')}">`:''}<span class="pill">${esc(p.category||'عام')}</span><div class="muted">${esc(p.brand||'')}${p.brand&&p.unit?' • ':''}${esc(p.unit||'')}</div>${normBarcode(p.barcode||row.barcode||'')?`<div class="muted">الباركود: ${esc(normBarcode(p.barcode||row.barcode||''))}</div>`:''}<div class="price">${fmt(priceNumber(row))} ل.س جديدة</div><div class="old">${priceOld(priceNumber(row))} ل.س قديمة</div>${p.description?`<p class="muted">${esc(p.description)}</p>`:''}<div class="muted">آخر تحديث: ${row.updated_at?esc(new Date(row.updated_at).toLocaleString('ar')):'—'}</div><div class="actions">${hasCart?`<button type="button" class="btn primary" id="storeMaterialDetailCart">إضافة إلى السلة</button>`:''}${canEdit?`<button type="button" class="btn secondary" id="storeMaterialDetailEdit">تعديل المادة</button><button type="button" class="btn danger" id="storeMaterialDetailDelete">حذف المادة</button>`:''}</div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('#storeMaterialDetailsClose').onclick=()=>modal.remove();
    modal.onclick=ev=>{if(ev.target===modal)modal.remove()};
    modal.querySelector('#storeMaterialDetailCart')?.addEventListener('click',()=>window.sareeCartAdd(storeId,p.id));
    modal.querySelector('#storeMaterialDetailEdit')?.addEventListener('click',()=>{modal.remove();window.editStoreMaterial?.(row.id,storeId)});
    modal.querySelector('#storeMaterialDetailDelete')?.addEventListener('click',()=>{modal.remove();window.deleteStoreMaterial?.(row.id,storeId)});
  };

  function filterStoreMaterials(){
    const input=$('storeMaterialSearch');
    const category=$('storeMaterialCategory');
    const msg=$('storeMaterialSearchMsg');
    const grid=$('storeProductsGrid');
    if(!grid)return;
    const q=String(input?.value||'').trim().toLocaleLowerCase();
    const cat=String(category?.value||'');
    let shown=0;const cards=[...grid.querySelectorAll('.storeProductCard')];
    cards.forEach(card=>{
      const txt=String(card.dataset.materialSearch||'').toLocaleLowerCase();
      const categoryMatch=!cat||String(card.dataset.materialCategory||'')===cat;
      const queryMatch=!q||txt.includes(q);
      const visible=queryMatch&&categoryMatch;
      card.classList.toggle('hidden',!visible);if(visible)shown++;
    });
    if(msg)msg.textContent=(q||cat)?`النتائج داخل هذا المتجر: ${shown}`:'';
    let empty=grid.querySelector('[data-store-search-empty]');
    if((q||cat)&&shown===0){if(!empty){empty=document.createElement('div');empty.className='card muted';empty.dataset.storeSearchEmpty='1';empty.textContent='لا توجد مواد مطابقة في هذا المتجر.';grid.appendChild(empty)}}else empty?.remove();
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
        <h3>البحث عن مادة في هذا المتجر</h3>
        <div class="storeMaterialSearchRow">
          <input id="storeMaterialSearch" inputmode="search" autocomplete="off" placeholder="ابحث باسم المادة أو التصنيف أو العلامة التجارية">
          <button type="button" class="btn primary" id="storeMaterialSearchBtn">بحث</button>
        </div>
        <select id="storeMaterialCategory" aria-label="تصفية مواد المتجر حسب التصنيف"><option value="">كل التصنيفات</option>${[...new Set(uniqueListings(listings).map(r=>r.products?.category||'عام'))].sort((a,b)=>String(a).localeCompare(String(b),'ar')).map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>
        <p id="storeMaterialSearchMsg" class="muted" aria-live="polite"></p>
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
    $('storeMaterialSearch')?.addEventListener('input',filterStoreMaterials);
    $('storeMaterialSearch')?.addEventListener('keydown',ev=>{ if(ev.key==='Enter'){ev.preventDefault();filterStoreMaterials();} });
    $('storeMaterialSearchBtn')?.addEventListener('click',filterStoreMaterials);
    $('storeMaterialCategory')?.addEventListener('change',filterStoreMaterials);
    $('storeBarcodeSearchBtn')?.addEventListener('click',()=>window.searchStoreBarcode(st.id));
    $('storeBarcodeSearch')?.addEventListener('keydown',ev=>{ if(ev.key==='Enter') window.searchStoreBarcode(st.id); });
    $('storeBarcodeCamera')?.addEventListener('click',()=>window.openBarcodeScannerForStore ? window.openBarcodeScannerForStore(st.id) : alert('ماسح الباركود غير محمّل.'));
    bindMaterialActions(body);
  };

  function bindMaterialActions(root){
    root.querySelectorAll('[data-edit-listing]').forEach(btn=>btn.onclick=()=>window.editStoreMaterial(btn.dataset.editListing,btn.dataset.storeId));
    root.querySelectorAll('[data-delete-listing]').forEach(btn=>btn.onclick=()=>window.deleteStoreMaterial(btn.dataset.deleteListing,btn.dataset.storeId));
    root.querySelectorAll('[data-material-detail]').forEach(btn=>btn.onclick=()=>window.openStoreMaterialDetails(btn.dataset.storeId,btn.dataset.materialDetail));
    root.querySelectorAll('[data-store-cart-add]').forEach(btn=>btn.onclick=()=>window.sareeCartAdd?.(btn.dataset.storeId,btn.dataset.storeCartAdd));
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
      // Keep the shared product active while any store still lists it; otherwise hide it from the home count/catalog.
      const {data:remainingListings,error:remainingError}=await supabaseClient.from('price_listings').select('id').eq('product_id',listing.product_id).limit(1);
      if(remainingError) throw remainingError;
      if(!remainingListings?.length){
        const {error:productError}=await supabaseClient.from('products').update({active:false}).eq('id',listing.product_id);
        if(productError) throw productError;
      }
      alert('تم حذف المادة من المتجر ✅');
      await window.refreshAll?.();
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
      <div class="card"><div class="accordionHead" data-toggle-id="adminAddStoreBody"><h2>إضافة متجر</h2><span>▾</span></div><div id="adminAddStoreBody" class="accordionBody hidden"><div class="two"><input id="sn" placeholder="اسم المتجر"><input id="scity" placeholder="المدينة"><input id="sarea" placeholder="المنطقة"><input id="saddr" placeholder="العنوان"><input id="sphone" placeholder="الهاتف"><input id="swhatsapp" placeholder="رابط واتساب المتجر"><select id="scompany"><option value="">بدون شركة</option>${companies.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select><input id="shours" placeholder="ساعات الدوام"><input id="sdays" placeholder="أيام العمل"><input id="s_latitude" type="number" step="any" placeholder="خط العرض Latitude"><input id="s_longitude" type="number" step="any" placeholder="خط الطول Longitude"><input id="simg" type="file" accept="image/*"></div><div class="actions"><button type="button" class="btn secondary" onclick="window.sareeLocateIntoFields('s_latitude','s_longitude','s_location_msg')">📍 تحديد موقع المتجر</button><button class="btn primary" onclick="adminAddStore()">إضافة المتجر</button></div><p id="s_location_msg" class="muted"></p></div></div>
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
    const lat=String($('s_latitude')?.value||'').trim(),lng=String($('s_longitude')?.value||'').trim();if((lat==='')!==(lng===''))return alert('أدخل خط العرض وخط الطول معاً لتحديد موقع المتجر.');if(lat!==''&&(!Number.isFinite(Number(lat))||Number(lat)<-90||Number(lat)>90||!Number.isFinite(Number(lng))||Number(lng)<-180||Number(lng)>180))return alert('إحداثيات موقع المتجر غير صحيحة.');
    let image=null;
    try{ image=await uploadImage($('simg')?.files?.[0]||null,'stores'); }catch(err){ return alert('فشل رفع صورة المتجر: '+err.message); }
    const payload={name,city:$('scity').value.trim()||null,area:$('sarea').value.trim()||null,address:$('saddr').value.trim()||null,phone:$('sphone').value.trim()||null,opening_hours:$('shours').value.trim()||null,working_days:$('sdays').value.trim()||null,latitude:lat===''?null:Number(lat),longitude:lng===''?null:Number(lng),image_url:image,whatsapp_url:$('swhatsapp').value.trim()||null,verified:true,active:true,company_id:$('scompany')?.value||null};
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
