/* سعرلي سوريا — الدمج الكامل لنظام الشركات */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const attr=v=>esc(v).replace(/`/g,'&#096;');
  const norm=v=>String(v??'').replace(/[^0-9A-Za-z\-]/g,'').trim();
  const money=v=>Number(v||0).toLocaleString('ar-SY',{maximumFractionDigits:2});
  const role=()=>window.__SAREE_ADMIN_STATUS__===true?'admin':String((typeof profileData!=='undefined'&&profileData?.role)||'').toLowerCase();
  let currentCompany=null;
  let companyProducts=[];
  let companyCategories=[];
  let companyUsers=[];

  function injectCss(){
    if($('companySystemCss'))return;
    const s=document.createElement('style');s.id='companySystemCss';s.textContent=`
      .company-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .company-card{display:flex;flex-direction:column;gap:9px;height:100%}
      .company-card .actions{margin-top:auto}
      .company-logo{width:100%;height:170px;object-fit:cover;border-radius:13px;background:#0d1418}
      .company-logo-empty{width:100%;height:170px;border-radius:13px;background:#0d1418;border:1px dashed #303b40;display:flex;align-items:center;justify-content:center;color:#718087}
      .company-price{font-size:22px;font-weight:900;color:#35d07f}
      .company-no-price{color:#f0cf71;background:#362d18;padding:7px 9px;border-radius:9px;font-size:12px}
      .company-toolbar{position:sticky;top:0;background:#080d11;padding:7px 0;z-index:4}
      .company-toolbar .two{margin-top:8px}
      .company-modal{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.78);padding:12px;overflow:auto}
      .company-modal-inner{width:min(980px,100%);margin:20px auto;background:#10191e;border:1px solid #303b40;border-radius:20px;padding:16px}
      .company-chip{display:inline-flex;align-items:center;gap:6px;background:#183b2b;color:#7ff0aa;border-radius:999px;padding:5px 10px;font-size:12px}
      .company-account-row{border:1px solid #263137;border-radius:13px;padding:11px;margin-top:9px}.company-account-row .accordionBody{margin-top:10px}
      .company-perms{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
      .company-perms label{margin:0;background:#0d1418;border:1px solid #263137;padding:9px;border-radius:10px}
      .company-barcode{display:flex;gap:8px}.company-barcode input{margin:0;flex:1}
      .company-qr-card{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-top:12px}
      .company-qr-box{width:180px;min-height:180px;padding:10px;background:#fff;border-radius:14px;display:flex;align-items:center;justify-content:center}
      .company-qr-box img,.company-qr-box canvas{max-width:160px;height:auto}
      .company-disabled{opacity:.55;pointer-events:none}
      .company-admin-product-row{border:1px solid #263137;border-radius:12px;padding:10px;margin-top:8px}
      .company-cart{margin-top:12px;border:1px solid #263137;border-radius:14px;padding:12px;background:#0d1418}
      .company-cart-line{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;border-bottom:1px solid #263137;padding:9px 0}
      .company-cart-qty{display:flex;align-items:center;gap:6px}.company-cart-qty button{width:34px;height:34px;border:1px solid #303b40;border-radius:9px;background:#1a2429;color:#fff}
      .company-cart-total{font-size:20px;font-weight:900;color:#35d07f;margin-top:10px}
      .company-manage-tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .company-admin-product-row .muted{font-size:13px}
      @media(max-width:650px){.company-grid,.company-perms{grid-template-columns:1fr}.company-qr-card{flex-direction:column;align-items:stretch}.company-qr-box{margin:auto}}
    `;document.head.appendChild(s);
  }

  function ensureCompanyPage(){
    if($('companies'))return;
    const stores=$('stores');
    const sec=document.createElement('section');sec.id='companies';sec.className='page';sec.innerHTML=`
      <div class="hero"><h1>🏢 الشركات</h1><p class="muted">قسم مستقل للشركات ومنتجاتها. يمكن للشركة عرض المواد حتى لو كان السعر غير محدد.</p></div>
      <div class="company-toolbar"><input id="publicCompanySearch" placeholder="ابحث عن شركة أو منتج أو باركود..."><div class="two"><select id="publicCompanyCategory"><option value="">كل التصنيفات</option></select><select id="publicCompanySort"><option value="name">ترتيب حسب الاسم</option><option value="products">الأكثر منتجات</option></select></div></div>
      <div id="publicCompaniesList" class="company-grid"></div>`;
    if(stores&&stores.parentNode)stores.parentNode.insertBefore(sec,stores);else document.querySelector('.app')?.appendChild(sec);
    $('publicCompanySearch').oninput=renderCompaniesPage;
    $('publicCompanyCategory').onchange=renderCompaniesPage;
    $('publicCompanySort').onchange=renderCompaniesPage;
  }

  function ensureCompanyDetailHooks(){
    const body=$('companyDetailBody'); if(!body)return;
  }

  function companyPublicUrl(id){
    try{
      const u=new URL(window.location.href);
      u.searchParams.delete('store');
      u.searchParams.delete('qr');
      u.searchParams.set('company',String(id));
      return u.toString();
    }catch(_){
      return window.location.origin+window.location.pathname+'?company='+encodeURIComponent(id);
    }
  }
  function companyQrUrl(id){
    const base=companyPublicUrl(id);
    return base+(base.includes('?')?'&':'?')+'qr=1';
  }
  function companyMapsUrl(c){
    if(c?.latitude!=null && c?.longitude!=null){
      return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(c.latitude+','+c.longitude);
    }
    if(c?.address) return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(c.address);
    return '';
  }
  function companyWhatsappOrdersEnabled(c){
    return Boolean(c?.whatsapp_orders_enabled && c?.whatsapp_url);
  }
  function companyCartStore(){
    try{return JSON.parse(localStorage.getItem('saree_company_carts_v1')||'{}')}catch(_){return {}}
  }
  function saveCompanyCarts(c){localStorage.setItem('saree_company_carts_v1',JSON.stringify(c));window.updateUniversalCartCount?.()}
  function companyCart(id){const all=companyCartStore();return all[String(id)]||{}}
  async function resolveCompanyEditContext(id){
    if(window.__SAREE_ADMIN_STATUS__===true) return {company_id:id,can_manage_settings:true,can_edit_products:true,can_manage_products:true};
    try{
      const user=(await supabaseClient.auth.getUser()).data?.user;
      if(!user)return null;
      const {data,error}=await supabaseClient.from('company_users').select('*').eq('user_id',user.id).eq('company_id',id).eq('active',true).maybeSingle();
      if(error)throw error;
      if(data) window.companyContext=data;
      return data||null;
    }catch(err){console.warn('company edit context:',err);return null}
  }
  function companyCanEditSettings(id,ctx){return Boolean(window.__SAREE_ADMIN_STATUS__===true || (ctx&&String(ctx.company_id)===String(id)))}
  function companyCanEditProducts(id,ctx){return Boolean(window.__SAREE_ADMIN_STATUS__===true || (ctx&&String(ctx.company_id)===String(id)))}
  function buildCompanyQR(id){
    const box=$('companyQrBox');
    if(!box || typeof QRCode==='undefined')return;
    try{
      box.innerHTML='';
      new QRCode(box,{text:companyQrUrl(id),width:160,height:160,correctLevel:QRCode.CorrectLevel?.H ?? 2});
    }catch(err){
      console.warn('company QR:',err);
      box.textContent='تعذر إنشاء QR حالياً.';
    }
  }

  window.printCompanyQR=function(id){
    const company=(window.__sareeCompanies||[]).find(x=>String(x.id)===String(id)) || (currentCompany&&String(currentCompany.id)===String(id)?currentCompany:null);
    const name=company?.name || 'الشركة';
    const url=companyQrUrl(id);
    const w=window.open('','_blank');
    if(!w)return alert('اسمح بفتح النوافذ المنبثقة لطباعة QR.');
    const html='<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>QR - '+esc(name)+'</title></head><body style="font-family:Arial;text-align:center;padding:30px"><h2>'+esc(name)+'</h2><div id="qrprint"></div><p style="word-break:break-all">'+esc(url)+'</p><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script><script>new QRCode(document.getElementById("qrprint"),{text:'+JSON.stringify(url)+',width:300,height:300,correctLevel:QRCode.CorrectLevel.H});setTimeout(function(){window.print();},800);<\/script></body></html>';
    w.document.open();w.document.write(html);w.document.close();
  };

  function wireSupportContactButton(){
    const buttons=[...document.querySelectorAll('button')].filter(b=>String(b.textContent||'').trim()==='الدعم والتواصل');
    buttons.forEach(b=>{
      b.disabled=false;
      b.removeAttribute('disabled');
      b.onclick=()=>{
        const api=window.sareeOwnerContactSponsors;
        if(api?.openContact)return api.openContact();
        const fallback=document.querySelector('#sareeOwnerContact a');
        if(fallback){fallback.click();return}
        alert('روابط التواصل غير متاحة حالياً.');
      };
    });
  }

  async function fetchCompanies(){
    const {data,error}=await supabaseClient.from('companies').select('*').eq('active',true).order('name');
    if(error)throw error;
    const [pr,st]=await Promise.all([
      supabaseClient.from('company_products').select('*').eq('active',true),
      supabaseClient.from('stores').select('id,name,company_id,city,area,address,phone,whatsapp_url,image_url,verified').eq('active',true)
    ]);
    return {companies:data||[],products:pr.data||[],stores:st.data||[]};
  }

  function companyCard(c, products, stores){
    const ps=products.filter(p=>String(p.company_id)===String(c.id));
    const ss=stores.filter(s=>String(s.company_id)===String(c.id));
    const image=c.image_url?`<img class="company-logo" src="${attr(c.image_url)}" alt="${attr(c.name)}" loading="lazy">`:`<div class="company-logo-empty">سعرلي سوريا</div>`;
    return `<article class="card company-card"><div onclick="window.openCompanyById('${attr(c.id)}')" style="cursor:pointer">${image}<div class="row" style="justify-content:space-between;align-items:center"><div class="name">${esc(c.name)}</div>${c.verified?'<span class="pill">✓ موثقة</span>':''}</div>${c.address?`<div class="muted">📍 ${esc(c.address)}</div>`:''}${c.phone?`<div class="muted">📞 ${esc(c.phone)}</div>`:''}<div class="meta"><span>${ps.length} منتجات</span><span>${ss.length} متاجر</span></div></div><div class="actions"><button type="button" class="btn primary" onclick="window.openCompanyById('${attr(c.id)}')">فتح الشركة</button>${c.whatsapp_url?`<a class="btn secondary" href="${attr(c.whatsapp_url)}" target="_blank" rel="noopener">💬 واتساب</a>`:''}</div></article>`;
  }

  async function renderCompaniesPage(){
    ensureCompanyPage(); injectCss();
    const box=$('publicCompaniesList'); if(!box)return;
    box.innerHTML='<div class="card muted">جاري تحميل الشركات...</div>';
    try{
      const {companies,products,stores}=await fetchCompanies();
      const q=String($('publicCompanySearch')?.value||'').trim().toLowerCase();
      const cat=String($('publicCompanyCategory')?.value||'');
      const cats=[...new Set(products.map(p=>p.category).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ar'));
      if($('publicCompanyCategory')) $('publicCompanyCategory').innerHTML='<option value="">كل التصنيفات</option>'+cats.map(c=>`<option value="${attr(c)}" ${c===cat?'selected':''}>${esc(c)}</option>`).join('');
      const filtered=companies.filter(c=>{
        const ps=products.filter(p=>String(p.company_id)===String(c.id));
        const txt=[c.name,c.address,c.phone].join(' ').toLowerCase();
        const pt=ps.some(p=>[p.name,p.brand,p.unit,p.barcode,p.category].join(' ').toLowerCase().includes(q));
        const pc=!cat||ps.some(p=>p.category===cat);
        return (!q||txt.includes(q)||pt)&&pc;
      });
      const sort=$('publicCompanySort')?.value||'name';
      filtered.sort((a,b)=>sort==='products'?products.filter(p=>String(p.company_id)===String(b.id)).length-products.filter(p=>String(p.company_id)===String(a.id)).length:String(a.name).localeCompare(String(b.name),'ar'));
      box.innerHTML=filtered.length?filtered.map(c=>companyCard(c,products,stores)).join(''):'<div class="card muted">لا توجد شركات مطابقة حالياً.</div>';
    }catch(err){box.innerHTML=`<div class="card dangerbox">تعذر تحميل الشركات: ${esc(err.message)}</div>`}
  }

  function companyDetailCardProduct(p){
    const hasPrice=p.price_new!==null && p.price_new!==undefined && p.price_new!=='';
    const canOrder=companyWhatsappOrdersEnabled(currentCompany) && hasPrice;
    const canEdit=companyCanEditProducts(currentCompany?.id,window.__companyEditContext);
    const favoriteIds=(()=>{try{return JSON.parse(localStorage.getItem('saree_favorites')||'[]')}catch(_){return []}})();
    const fav=favoriteIds.map(String).includes(String(p.id));
    return `<article class="card company-card" data-company-product-id="${attr(p.id)}"><div onclick="window.openCompanyProduct('${attr(p.id)}')" style="cursor:pointer">${p.image_url?`<img class="company-logo" style="height:145px;object-fit:contain" src="${attr(p.image_url)}" alt="${attr(p.name)}" loading="lazy">`:''}<span class="pill">${esc(p.category||'عام')}</span><div class="name">${esc(p.name)}</div>${p.brand?`<div class="muted">${esc(p.brand)}</div>`:''}${p.unit?`<div class="muted">${esc(p.unit)}</div>`:''}${p.barcode?`<div class="muted">باركود: ${esc(p.barcode)}</div>`:''}${hasPrice?`<div class="company-price">${money(p.price_new)} ل.س</div>`:'<div class="company-no-price">السعر غير محدد</div>'}</div><div class="actions"><button class="btn primary" onclick="window.openCompanyProduct('${attr(p.id)}')">تفاصيل</button>${canOrder?`<button class="btn primary" onclick="window.companyCartAdd('${attr(currentCompany.id)}','${attr(p.id)}')">أضف للسلة</button>`:''}<button class="btn secondary" onclick="window.toggleCompanyFavorite('${attr(p.id)}')">${fav?'★ من المفضلة':'☆ أضف للمفضلة'}</button>${canEdit?`<button class="btn secondary" onclick="window.companyEditProduct('${attr(p.id)}')">✏️ تعديل</button>`:''}</div></article>`;
  }

  async function loadCompanyById(id){
    const {data,error}=await supabaseClient.from('companies').select('*').eq('id',id).eq('active',true).maybeSingle();
    if(error)throw error;if(!data)throw new Error('الشركة غير موجودة');
    const [pr,st,cat]=await Promise.all([
      supabaseClient.from('company_products').select('*').eq('company_id',id).eq('active',true).order('name'),
      supabaseClient.from('stores').select('id,name,company_id,city,area,address,phone,whatsapp_url,image_url,verified').eq('company_id',id).eq('active',true).order('name'),
      supabaseClient.from('company_categories').select('*').eq('company_id',id).eq('active',true).order('name')
    ]);
    if(pr.error)throw pr.error;
    companyProducts=pr.data||[]; companyCategories=cat.data||[]; return {company:data,stores:st.data||[]};
  }

  window.openCompanyById=async function(id){
    window.__sareeTrackedStoreVisitId=null;
    try{
      const {company,stores:linkedStores}=await loadCompanyById(id); currentCompany=company;
      window.__companyEditContext=await resolveCompanyEditContext(id);
      const companyQuery=new URLSearchParams(window.location.search).get('company');
      const qrMode=new URLSearchParams(window.location.search).get('qr')==='1';
      if(String(companyQuery||'')!==String(id)||qrMode) history.pushState({},'',companyPublicUrl(id)+(qrMode?'&qr=1':''));
      try{sessionStorage.setItem('saree_current_view','companyDetail')}catch(_){}
      $('companyDetailName').textContent=company.name;
      const image=company.image_url?`<img class="img storeDetailLogo" src="${attr(company.image_url)}" alt="${attr(company.name)}">`:'';
      const canSettings=companyCanEditSettings(company.id,window.__companyEditContext);
      const canEditProducts=companyCanEditProducts(company.id,window.__companyEditContext);
      const maps=companyMapsUrl(company);
      const canOrder=companyWhatsappOrdersEnabled(company);
      $('companyDetailBody').innerHTML=`
        ${image}<div class="card"><div class="row" style="justify-content:space-between;align-items:center"><div><span class="company-chip">🏢 شركة</span><div class="name">${esc(company.name)} ${company.verified?'✓':''}</div></div><div class="actions">${canSettings?`<button type="button" class="btn secondary" id="companyEditBtn">✏️ تعديل بيانات الشركة</button>`:''}${company.whatsapp_url?`<a class="btn primary" target="_blank" rel="noopener" href="${attr(company.whatsapp_url)}">💬 واتساب</a>`:''}</div></div>${company.established_year?`<div class="muted">📅 سنة التأسيس: ${esc(company.established_year)}</div>`:''}${company.address?`<div class="muted">📍 ${esc(company.address)}</div>`:''}${company.phone?`<div class="muted">📞 ${esc(company.phone)}</div>`:''}${maps?`<div class="actions"><button type="button" class="btn secondary" id="companyDirectionsBtn">📍 موقع الشركة على Google Maps</button></div>`:''}${canOrder?`<div class="notice">🛒 الطلب عبر واتساب مفعّل للشركة. لا توجد أجرة توصيل.</div>`:''}${canSettings?`<div class="notice" style="margin-top:8px">إرسال سلة الطلب عبر واتساب: ${company.whatsapp_orders_enabled?'مفعّل':'موقوف'}</div>`:''}<div class="company-qr-card"><div><b>QR خاص بالشركة</b><div class="muted">امسح الرمز لفتح صفحة الشركة مباشرة.</div>${canSettings?`<div class="notice" style="margin-top:8px">👁️ إجمالي زوار الشركة: <b id="companySiteTotalVisitCount">—</b></div><div class="notice" style="margin-top:8px">📱 زوار QR: <b id="companyQrVisitCount">—</b></div>`:''}<div class="actions"><button class="btn secondary" type="button" onclick="window.printCompanyQR('${attr(company.id)}')">طباعة QR</button></div></div><div id="companyQrBox" class="company-qr-box"></div></div></div>
        ${canOrder?`<div id="companyCartBox" class="company-cart"></div>`:''}
        <div class="company-toolbar"><div class="company-barcode"><input id="companyProductSearch" inputmode="search" autocomplete="off" placeholder="ابحث عن اسم أو باركود..."><button class="btn secondary" type="button" id="companyBarcodeCamera">📷</button><button class="btn secondary" type="button" id="companyBarcodeSearchBtn">بحث</button></div><div class="two"><select id="companyProductCategory"><option value="">كل التصنيفات</option>${companyCategories.map(c=>`<option value="${attr(c.name)}">${esc(c.name)}</option>`).join('')}</select><select id="companyProductPriceFilter"><option value="all">كل المواد</option><option value="with">مواد بسعر</option><option value="without">مواد بدون سعر</option></select></div><p id="companyProductMsg" class="muted"></p></div>
        <h2 style="margin-top:15px">منتجات الشركة (${companyProducts.length})</h2><div id="companyProductsGrid" class="company-grid"></div>
        <h2 style="margin-top:20px">المتاجر المرتبطة بالشركة (${linkedStores.length})</h2><div class="grid">${linkedStores.length?linkedStores.map(renderLinkedStore).join(''):'<div class="card muted">لا توجد متاجر مرتبطة بهذه الشركة حالياً.</div>'}</div>`;
      showPage('companyDetail');
      buildCompanyQR(id);
      const render=()=>{
        const q=String($('companyProductSearch')?.value||'').trim().toLowerCase();
        const cat=String($('companyProductCategory')?.value||'');
        const pf=$('companyProductPriceFilter')?.value||'all';
        const rows=companyProducts.filter(p=>{const txt=[p.name,p.brand,p.unit,p.barcode,p.category].join(' ').toLowerCase();const has=p.price_new!==null&&p.price_new!==undefined&&p.price_new!=='';return (!q||txt.includes(q))&&(!cat||p.category===cat)&&(pf==='all'||(pf==='with'?has:!has))});
        $('companyProductsGrid').innerHTML=rows.length?rows.map(companyDetailCardProduct).join(''):'<div class="card muted">لا توجد مواد مطابقة.</div>';
        if(canOrder) renderCompanyCart(id);
      };
      $('companyProductSearch').oninput=render;$('companyProductCategory').onchange=render;$('companyProductPriceFilter').onchange=render;
      $('companyBarcodeSearchBtn').onclick=async()=>{const q=norm($('companyProductSearch').value);if(!q)return render();const exact=companyProducts.find(p=>norm(p.barcode)===q);if(exact){openCompanyProduct(exact.id);$('companyProductMsg').textContent='تم العثور على المادة بالباركود.'}else{$('companyProductMsg').textContent='لم يتم العثور على مادة بهذا الباركود.';render()}};
      $('companyProductSearch').onkeydown=ev=>{if(ev.key==='Enter')$('companyBarcodeSearchBtn').click()};
      $('companyBarcodeCamera').onclick=()=>window.openBarcodeScannerForCompany?.(id);
      $('companyDirectionsBtn')?.addEventListener('click',()=>window.open(maps,'_blank','noopener'));
      $('companyEditBtn')?.addEventListener('click',()=>window.openCompanyEdit?.(id));
      if(qrMode && typeof window.recordSareeQrVisit==='function') window.recordSareeQrVisit('company',id).catch(()=>{});
      if(canSettings){
        supabaseClient.rpc('company_owner_visitor_stats',{p_company_id:id}).then(r=>{
          if($('companySiteTotalVisitCount')){
            const n=Number(r?.data?.total_visits||0);
            $('companySiteTotalVisitCount').textContent=(!r?.error && Number.isFinite(n))?n.toLocaleString('ar-SY'):'—';
          }
        }).catch(()=>{});
      }
      if(canSettings && typeof window.getSareeQrVisitCount==='function') window.getSareeQrVisitCount('company',id).then(n=>{if($('companyQrVisitCount'))$('companyQrVisitCount').textContent=n==null?'—':Number(n).toLocaleString('ar-SY')});
      render();
      try{
        const visitId=(crypto.randomUUID?crypto.randomUUID():('visit_'+Date.now()+'_'+Math.random().toString(36).slice(2)));
        await supabaseClient.rpc('record_company_visit',{p_company_id:id,p_visitor_id:visitId});
      }catch(_){ }
    }catch(err){alert(err.message||'تعذر فتح الشركة')}
  };

  function renderLinkedStore(st){return `<article class="card"><div class="name">${esc(st.name)}</div>${st.image_url?`<img class="img storeLogo" src="${attr(st.image_url)}">`:''}<div class="muted">${esc([st.city,st.area].filter(Boolean).join(' — '))}</div>${st.address?`<div class="muted">📍 ${esc(st.address)}</div>`:''}<div class="actions"><button class="btn primary" onclick="openStore('${attr(st.id)}')">فتح المتجر</button>${st.whatsapp_url?`<a class="btn secondary" target="_blank" rel="noopener" href="${attr(st.whatsapp_url)}">واتساب</a>`:''}</div></article>`}

  function setCompanyCart(companyId,cart){const all=companyCartStore();all[String(companyId)]=cart;saveCompanyCarts(all);}
  window.companyCartAdd=function(companyId,productId){
    if(!currentCompany || String(currentCompany.id)!==String(companyId)) return;
    if(!companyWhatsappOrdersEnabled(currentCompany)) return alert('إرسال الطلب عبر واتساب غير مفعّل لهذه الشركة.');
    const p=companyProducts.find(x=>String(x.id)===String(productId));
    if(!p || p.price_new==null || p.price_new==='') return alert('هذه المادة لا تملك سعراً، ولا يمكن إضافتها إلى سلة الطلب.');
    const c=companyCart(companyId);
    if(!c[productId]) c[productId]={qty:0,price:Number(p.price_new),name:p.name,unit:p.unit||'',companyName:currentCompany.name||''};
    c[productId].qty++;
    setCompanyCart(companyId,c); renderCompanyCart(companyId);
  };
  window.companyCartChange=function(companyId,productId,delta){
    const c=companyCart(companyId);if(!c[productId])return;c[productId].qty+=delta;if(c[productId].qty<=0)delete c[productId];
    setCompanyCart(companyId,c);renderCompanyCart(companyId);
  };
  window.companyCartClear=function(companyId){setCompanyCart(companyId,{});renderCompanyCart(companyId);};
  function renderCompanyCart(companyId){
    const box=$('companyCartBox');if(!box)return;
    if(!companyWhatsappOrdersEnabled(currentCompany)){box.innerHTML='<div class="muted">إرسال الطلب عبر واتساب غير مفعّل لهذه الشركة.</div>';return}
    const c=companyCart(companyId),items=Object.entries(c);
    if(!items.length){box.innerHTML='<div class="muted">سلة الشركة فارغة. أضف المواد التي تريد طلبها.</div>';return}
    let subtotal=0;
    box.innerHTML=`<h3>🛒 سلة الشركة</h3>${items.map(([pid,x])=>{const line=Number(x.qty||0)*Number(x.price||0);subtotal+=line;return `<div class="company-cart-line"><div><b>${esc(x.name)}</b>${x.unit?`<div class="muted">${esc(x.unit)}</div>`:''}</div><div class="company-cart-qty"><button onclick="window.companyCartChange('${esc(companyId)}','${esc(pid)}',-1)">−</button><b>${x.qty}</b><button onclick="window.companyCartChange('${esc(companyId)}','${esc(pid)}',1)">+</button></div><div>${money(line)} ل.س</div></div>`}).join('')}<div class="muted" style="margin-top:8px">المجموع: ${money(subtotal)} ل.س</div><div class="notice" style="margin-top:8px">لا توجد أجرة توصيل.</div><div class="actions"><button class="btn primary" onclick="window.companySendWhatsappOrder('${esc(companyId)}')">إرسال الطلب عبر واتساب</button><button class="btn secondary" onclick="window.companyCartClear('${esc(companyId)}')">تفريغ السلة</button></div>`;
  }
  function companyPhoneFromTarget(target){
    let v=String(target||'').trim().replace(/[٠-٩۰-۹]/g,c=>({'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'}[c]));
    const m=v.match(/(?:wa\.me\/|phone=)([0-9]+)/i);let phone=m?m[1]:v.replace(/\D/g,'');
    if(phone.startsWith('00963'))phone=phone.slice(2);else if(phone.startsWith('09'))phone='963'+phone.slice(1);else if(phone.startsWith('9')&&phone.length>=9&&phone.length<=10)phone='963'+phone;
    return phone;
  }
  window.companySendWhatsappOrder=async function(companyId){
    if(!currentCompany || String(currentCompany.id)!==String(companyId))return;
    if(!companyWhatsappOrdersEnabled(currentCompany))return alert('إرسال الطلب عبر واتساب غير مفعّل لهذه الشركة.');
    const c=companyCart(companyId),items=Object.entries(c);if(!items.length)return alert('السلة فارغة.');
    const phone=companyPhoneFromTarget(currentCompany.whatsapp_url);if(!phone)return alert('رقم واتساب الشركة غير صالح.');
    let subtotal=0;
    const lines=items.map(([pid,x],i)=>{const line=Number(x.qty||0)*Number(x.price||0);subtotal+=line;return `${i+1}) ${x.name}${x.unit?' ('+x.unit+')':''} × ${x.qty} = ${money(line)} ل.س`});
    const name=prompt('اسم العميل (اختياري):','')??'';const customerPhone=prompt('رقم هاتف العميل (اختياري):','')??'';const notes=prompt('ملاحظات الطلب (اختياري):','')??'';
    const msg=`طلب من سعرلي سوريا\nالشركة: ${currentCompany.name||''}\n\n${lines.join('\n')}\n\nالمجموع: ${money(subtotal)} ل.س\nأجرة التوصيل: لا توجد\n\nاسم العميل: ${name||'—'}\nهاتف العميل: ${customerPhone||'—'}\nملاحظات: ${notes||'—'}`;
    window.location.href=`whatsapp://send?phone=${phone}&text=${encodeURIComponent(msg)}`;
    setCompanyCart(companyId,{});
    renderCompanyCart(companyId);
  };

  window.openCompanyProduct=function(id){
    const p=companyProducts.find(x=>String(x.id)===String(id));if(!p)return;
    const has=p.price_new!==null&&p.price_new!==undefined&&p.price_new!=='';
    const canOrder=companyWhatsappOrdersEnabled(currentCompany)&&has;
    const canEdit=companyCanEditProducts(currentCompany?.id,window.__companyEditContext);
    const old=$('companyProductModal');if(old)old.remove();
    const m=document.createElement('div');m.id='companyProductModal';m.className='company-modal';
    m.innerHTML=`<div class="company-modal-inner"><div class="row" style="justify-content:space-between;align-items:center"><h2>${esc(p.name)}</h2><button class="btn secondary" id="closeCompanyProduct">×</button></div>${p.image_url?`<img class="img" style="height:230px;object-fit:contain" src="${attr(p.image_url)}">`:''}<div class="muted">${esc(p.category||'عام')}${p.brand?' • '+esc(p.brand):''}${p.unit?' • '+esc(p.unit):''}</div>${p.barcode?`<div class="muted">الباركود: ${esc(p.barcode)}</div>`:''}${has?`<div class="company-price" style="margin-top:12px">${money(p.price_new)} ل.س</div>`:'<div class="company-no-price" style="margin-top:12px">السعر غير محدد حالياً</div>'}<p class="muted">${esc(p.description||'')}</p><div class="actions">${canOrder?`<button class="btn primary" onclick="window.companyCartAdd('${attr(currentCompany.id)}','${attr(p.id)}');document.getElementById('companyProductModal')?.remove()">أضف للسلة</button>`:''}${canEdit?`<button class="btn secondary" onclick="document.getElementById('companyProductModal')?.remove();window.companyEditProduct('${attr(p.id)}')">✏️ تعديل المادة</button>`:''}<button class="btn secondary" onclick="window.toggleCompanyFavorite('${attr(p.id)}');document.getElementById('companyProductModal')?.remove()">إدارة المفضلة</button></div></div>`;
    document.body.appendChild(m);$('closeCompanyProduct').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove()};
  };

  window.openCompanyEdit=async function(id){
    const ctx=await resolveCompanyEditContext(id);
    if(!companyCanEditSettings(id,ctx))return alert('ليس لديك صلاحية تعديل بيانات هذه الشركة.');
    let c=currentCompany;
    if(!c||String(c.id)!==String(id)){try{c=(await supabaseClient.from('companies').select('*').eq('id',id).maybeSingle()).data}catch(_){}}
    if(!c)return alert('الشركة غير موجودة.');
    const old=$('companyPublicEditModal');if(old)old.remove();
    const m=document.createElement('div');m.id='companyPublicEditModal';m.className='company-modal';
    m.innerHTML=`<div class="company-modal-inner"><div class="row" style="justify-content:space-between;align-items:center"><h2>تعديل بيانات الشركة</h2><button class="btn secondary" id="cpe_close">×</button></div><div class="two"><input id="cpe_name" value="${attr(c.name||'')}" placeholder="اسم الشركة"><input id="cpe_phone" value="${attr(c.phone||'')}" placeholder="الهاتف"><input id="cpe_address" value="${attr(c.address||'')}" placeholder="العنوان"><input id="cpe_whatsapp" value="${attr(c.whatsapp_url||'')}" placeholder="رابط/رقم واتساب"><input id="cpe_established_year" inputmode="numeric" maxlength="4" value="${attr(c.established_year||'')}" placeholder="سنة التأسيس"><input id="cpe_latitude" type="number" step="any" value="${attr(c.latitude??'')}" placeholder="خط العرض Latitude"><input id="cpe_longitude" type="number" step="any" value="${attr(c.longitude??'')}" placeholder="خط الطول Longitude"><input id="cpe_image" type="file" accept="image/*"></div><label class="rememberRow"><input id="cpe_whatsapp_orders_enabled" type="checkbox" ${c.whatsapp_orders_enabled?'checked':''}> تفعيل إرسال سلة الطلب عبر واتساب للشركة</label><div class="actions"><button type="button" class="btn secondary" id="cpe_locate">📍 استخدام موقعي الحالي</button><button type="button" class="btn primary" id="cpe_save">حفظ التعديلات</button></div><p id="cpe_msg" class="muted"></p></div>`;
    document.body.appendChild(m);
    $('cpe_close').onclick=()=>m.remove();
    $('cpe_locate').onclick=()=>{
      if(!navigator.geolocation)return $('cpe_msg').textContent='تحديد الموقع غير مدعوم في هذا الجهاز.';
      $('cpe_msg').textContent='جاري تحديد الموقع...';
      navigator.geolocation.getCurrentPosition(pos=>{$('cpe_latitude').value=pos.coords.latitude.toFixed(7);$('cpe_longitude').value=pos.coords.longitude.toFixed(7);$('cpe_msg').textContent='تم تحديد الموقع. احفظ التعديلات.';},err=>{$('cpe_msg').textContent='تعذر تحديد الموقع: '+(err.message||'رفض الإذن')});
    };
    $('cpe_save').onclick=async()=>{
      try{
        const name=$('cpe_name').value.trim();if(!name)return alert('اسم الشركة مطلوب.');
        let image_url=c.image_url||null;const f=$('cpe_image').files?.[0];if(f&&window.uploadImage)image_url=await window.uploadImage(f,'companies');
        const yr=String($('cpe_established_year').value||'').trim();const lat=$('cpe_latitude').value.trim(),lng=$('cpe_longitude').value.trim();
        const patch={name,phone:$('cpe_phone').value.trim()||null,address:$('cpe_address').value.trim()||null,whatsapp_url:$('cpe_whatsapp').value.trim()||null,established_year:/^\d{4}$/.test(yr)?Number(yr):null,latitude:lat===''?null:Number(lat),longitude:lng===''?null:Number(lng),whatsapp_orders_enabled:$('cpe_whatsapp_orders_enabled').checked,image_url};
        const {error}=await supabaseClient.from('companies').update(patch).eq('id',id);if(error)throw error;
        m.remove();await openCompanyById(id);
      }catch(err){alert(err.message||'تعذر حفظ بيانات الشركة')}
    };
  };

  window.toggleCompanyFavorite=function(id){
    let a=[];try{a=JSON.parse(localStorage.getItem('saree_favorites')||'[]')}catch(_){a=[]} const i=a.map(String).indexOf(String(id)); if(i>=0)a.splice(i,1); else a.push(id); localStorage.setItem('saree_favorites',JSON.stringify(a)); alert(i>=0?'تمت إزالة المادة من المفضلة.':'تمت إضافة المادة إلى المفضلة.'); if(currentCompany) window.openCompanyById(currentCompany.id);
  };

  function showPage(id){
    window.ensurePageCloseButton?.(id);
    document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
    $(id)?.classList.add('active');
    document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));
    const navName=id==='companyDetail'?'companies':id;
    const navBtn=document.querySelector(`.nav button[onclick="openNav('${navName}')"]`);
    if(navBtn)navBtn.classList.add('active');
    try{sessionStorage.setItem('saree_current_view',id)}catch(_){}
    window.scrollTo(0,0);
  }
  const oldShow=window.show;
  window.show=function(id){
    if(id==='companies'){ensureCompanyPage();showPage('companies');renderCompaniesPage();return}
    if(id==='companyDetail'){showPage(id);return}
    if((id==='merchant'||id==='admin') && role()==='company'){ensureCompanyContext();return}
    if(id==='company'){ensureCompanyContext();return}
    return oldShow(id);
  };

  function companyDashboardHost(){return $('companyPanel')}

  async function getCompanyContext(userId){
    const uid=userId||profileData?.id;
    if(!uid)return null;
    const {data,error}=await supabaseClient.from('company_users').select('*,companies(*)').eq('user_id',uid).eq('active',true).maybeSingle();
    if(error)throw error;return data||null;
  }

  function renderCompanyPending(){
    const host=companyDashboardHost();
    if(!host)return;
    showPage('company');
    if($('companyRole')) $('companyRole').textContent='هذا حساب شركة مستقل عن حسابات التجار.';
    host.innerHTML=`<div class="card"><h2>حساب شركة غير مرتبط بعد</h2><p class="muted">تم التعرف على هذا الحساب كحساب شركة، لكن لم يتم ربطه بشركة وتفعيل صلاحياته من المدير بعد.</p><div class="notice pending">لا يمكن استخدام صلاحيات المتاجر أو التاجر من هذا الحساب.</div><div class="actions"><button type="button" class="btn secondary" onclick="show('companies')">صفحة الشركات</button><button type="button" class="btn secondary" onclick="logout()">تسجيل الخروج</button></div></div>`;
  }

  async function ensureCompanyContext(){
    try{
      if(typeof profileData==='undefined'||!profileData||typeof supabaseClient==='undefined')return;
      const userRes=await supabaseClient.auth.getUser();const user=userRes.data?.user;if(!user)return;
      if(String(user.user_metadata?.account_type||'').toLowerCase()==='company'){
        try{await supabaseClient.rpc('request_company_account',{p_requested_name:user.user_metadata?.name||profileData?.name||null})}catch(_){ }
      }
      const ctx=await getCompanyContext(user.id);
      if(ctx){
        if(!window.__SAREE_ADMIN_STATUS__){
          profileData.role='company';
          profileData.company_id=ctx.company_id;
          profileData.store_id=null;
          profileData.can_edit_prices=false;
        }
        currentCompany=ctx.companies;window.companyContext=ctx;renderCompanyDashboard(ctx);
      }else if(role()==='company' && !window.__SAREE_ADMIN_STATUS__){
        window.companyContext=null;
        renderCompanyPending();
      }
    }catch(err){console.warn('company context:',err)}
  }

  window.openCompanyDashboard=async function(){
    try{
      if(window.companyContext){ renderCompanyDashboard(window.companyContext); return; }
      await ensureCompanyContext();
      if(window.companyContext) renderCompanyDashboard(window.companyContext);
    }catch(err){ alert(err.message||'تعذر فتح لوحة الشركة'); }
  };

  function permissionInputs(ctx,prefix='cp'){
    const id=k=>`${prefix}_${k}`;
    const edit = !!(ctx.can_edit_products || ctx.can_edit_prices);
    return `<div class="company-perms">
      <label><input id="${id('manage')}" data-perm="manage" type="checkbox" ${ctx.can_manage_products?'checked':''}> إضافة وإدارة المنتجات</label>
      <label><input id="${id('edit')}" data-perm="edit" type="checkbox" ${edit?'checked':''}> تعديل المنتجات والأسعار</label>
      <label><input id="${id('delete')}" data-perm="delete" type="checkbox" ${ctx.can_delete_products?'checked':''}> حذف المنتجات</label>
      <label><input id="${id('cat')}" data-perm="cat" type="checkbox" ${ctx.can_manage_categories?'checked':''}> إدارة التصنيفات</label>
      <label><input id="${id('settings')}" data-perm="settings" type="checkbox" ${ctx.can_manage_settings?'checked':''}> إعدادات الشركة</label>
      <label><input id="${id('orders')}" data-perm="orders" type="checkbox" ${ctx.can_view_orders?'checked':''}> مشاهدة الطلبات</label>
      <label><input id="${id('stats')}" data-perm="stats" type="checkbox" ${ctx.can_view_stats?'checked':''}> مشاهدة إجمالي الزيارات</label>
    </div>`;
  }

  function renderCompanyDashboard(ctx){
    if(!ctx||!ctx.companies)return;
    showPage('company');
    const host=companyDashboardHost();if(!host)return;
    if($('companyRole')) $('companyRole').textContent=`الشركة المرتبطة: ${ctx.companies.name||'شركة'}.`;
    const c=ctx.companies;
    host.innerHTML=`<div class="hero"><h1>لوحة شركة ${esc(c.name)}</h1><p class="muted">الصلاحيات التي منحها لك المدير هي التي تحدد ما يمكنك فعله.</p><div class="actions"><button class="btn secondary" onclick="window.openCompanyById('${attr(c.id)}')">فتح صفحة الشركة العامة</button><button class="btn secondary" onclick="window.printCompanyQR('${attr(c.id)}')">طباعة QR الشركة</button><button class="btn secondary" onclick="logout()">تسجيل الخروج</button></div><div class="company-qr-card"><div><b>QR خاص بالشركة</b><div class="muted">هذا الرمز يفتح صفحة الشركة العامة مباشرة.</div></div><div id="companyDashboardQrBox" class="company-qr-box"></div></div></div><div class="grid"><div class="stat"><b id="companyProductCount">0</b> منتجات</div><div class="stat"><b id="companyCategoryCount">0</b> تصنيفات</div><div class="stat"><b id="companyVisitorCount">—</b> إجمالي زيارات الشركة</div><div class="stat"><b id="companyQrVisitorCount">—</b> زوار QR الشركة</div><div class="stat"><b>${ctx.active?'مفعّل':'موقوف'}</b> الحساب</div></div><div class="card"><h2>صلاحيات الحساب</h2><div class="company-perms"><div class="stat">إضافة المنتجات: <b>${ctx.can_manage_products?'مفعلة':'موقوفة'}</b></div><div class="stat">تعديل المنتجات والأسعار: <b>${(ctx.can_edit_products||ctx.can_edit_prices)?'مفعلة':'موقوفة'}</b></div><div class="stat">حذف المنتجات: <b>${ctx.can_delete_products?'مفعلة':'موقوفة'}</b></div><div class="stat">التصنيفات: <b>${ctx.can_manage_categories?'مفعلة':'موقوفة'}</b></div><div class="stat">الإعدادات: <b>${ctx.can_manage_settings?'مفعلة':'موقوفة'}</b></div><div class="stat">الطلبات: <b>${ctx.can_view_orders?'مفعلة':'موقوفة'}</b></div><div class="stat">الإحصائيات: <b>${ctx.can_view_stats?'مفعلة':'موقوفة'}</b></div></div></div><div class="card"><h2>إدارة المنتجات</h2><p class="muted">السعر اختياري. يمكن حفظ المادة بباركود فقط ثم ستظهر للزوار داخل صفحة الشركة.</p><div class="actions"><button class="btn primary ${ctx.can_manage_products?'':'company-disabled'}" onclick="window.companyAddProduct()">إضافة مادة</button><button class="btn secondary" onclick="window.openCompanyById('${attr(c.id)}')">معاينة المنتجات</button></div><div id="companyDashboardProducts" style="margin-top:12px"></div></div><div class="card"><h2>تصنيفات الشركة</h2><div class="two"><input id="companyCategoryName" placeholder="اسم التصنيف"><button class="btn primary ${ctx.can_manage_categories?'':'company-disabled'}" id="companyAddCategoryBtn">إضافة تصنيف</button></div><div id="companyDashboardCategories" style="margin-top:12px"></div></div>`;
    if(typeof QRCode!=='undefined'){
      const box=$('companyDashboardQrBox');
      if(box){
        box.innerHTML='';
        try{new QRCode(box,{text:companyQrUrl(c.id),width:160,height:160,correctLevel:QRCode.CorrectLevel?.H ?? 2});}catch(e){console.warn('company dashboard QR:',e);}
      }
    }
    loadCompanyDashboardData(ctx);
    loadCompanyVisitorStats(ctx);
    if(typeof window.getSareeQrVisitCount==='function') window.getSareeQrVisitCount('company',c.id).then(n=>{if($('companyQrVisitorCount'))$('companyQrVisitorCount').textContent=n==null?'—':Number(n).toLocaleString('ar-SY')});
    $('companyAddCategoryBtn').onclick=async()=>{if(!ctx.can_manage_categories)return alert('لا توجد لديك صلاحية إدارة التصنيفات.');const n=$('companyCategoryName').value.trim();if(!n)return alert('اكتب اسم التصنيف.');const {error}=await supabaseClient.rpc('company_add_category',{p_name:n});if(error)return alert(error.message);$('companyCategoryName').value='';await loadCompanyDashboardData(ctx)};
  }

  async function loadCompanyVisitorStats(ctx){
    const node=$('companyVisitorCount');
    if(!node || !ctx?.company_id || !ctx.can_view_stats) { if(node) node.textContent='—'; return; }
    try{
      const {data,error}=await supabaseClient.rpc('company_owner_visitor_stats',{p_company_id:ctx.company_id});
      if(error) throw error;
      const total=Number(data?.total_visits||0);
      node.textContent=Number.isFinite(total)?total.toLocaleString('ar-SY'):'0';
    }catch(err){ console.warn('company visitor stats:',err); if(node) node.textContent='—'; }
  }

  async function loadCompanyDashboardData(ctx){
    const {data:ps,error:pe}=await supabaseClient.from('company_products').select('*').eq('company_id',ctx.company_id).order('created_at',{ascending:false});
    const {data:cs,error:ce}=await supabaseClient.from('company_categories').select('*').eq('company_id',ctx.company_id).order('name');
    if(pe)console.warn(pe); if(ce)console.warn(ce);
    const p=ps||[], c=cs||[]; if($('companyProductCount'))$('companyProductCount').textContent=p.filter(x=>x.active).length;if($('companyCategoryCount'))$('companyCategoryCount').textContent=c.filter(x=>x.active).length;
    if($('companyDashboardProducts'))$('companyDashboardProducts').innerHTML=p.length?p.map(x=>`<div class="company-account-row"><div class="row" style="justify-content:space-between"><div><b>${esc(x.name)}</b><div class="muted">${esc(x.barcode||'بدون باركود')} • ${x.price_new==null?'بدون سعر':money(x.price_new)+' ل.س'}</div></div><span class="pill">${x.active?'نشط':'مخفي'}</span></div><div class="actions"><button class="btn secondary ${ctx.can_edit_products||ctx.can_edit_prices||ctx.can_manage_products?'':'company-disabled'}" onclick="window.companyEditProduct('${attr(x.id)}')">تعديل</button><button class="btn danger ${ctx.can_delete_products||ctx.can_manage_products?'':'company-disabled'}" onclick="window.companyDeleteProduct('${attr(x.id)}')">حذف</button></div></div>`).join(''):'<div class="muted">لا توجد مواد بعد.</div>';
    if($('companyDashboardCategories'))$('companyDashboardCategories').innerHTML=c.length?c.map(x=>`<div class="company-account-row"><b>${esc(x.name)}</b><div class="muted">${x.active?'نشط':'مخفي'}</div><button class="btn secondary" onclick="window.companyToggleCategory('${attr(x.id)}',${!x.active})">${x.active?'إخفاء':'إظهار'}</button></div>`).join(''):'<div class="muted">لا توجد تصنيفات.</div>';
  }

  window.companyAddProduct=async function(){
    const ctx=window.companyContext;
    if(!ctx || !ctx.can_manage_products) return alert('لا توجد لديك صلاحية إضافة المنتجات.');
    companyProductEditor();
  };

  function companyProductEditor(existing, forcedContext){
    const p=existing||{};
    const editContext=forcedContext||window.companyContext||null;
    const editCompanyId=editContext?.company_id||p.company_id||currentCompany?.id||null;
    const modal=document.createElement('div');
    modal.id='companyEditorModal';
    modal.className='company-modal';
    modal.innerHTML=`<div class="company-modal-inner">
      <div class="row" style="justify-content:space-between;align-items:center">
        <h2>${existing?'تعديل مادة':'إضافة مادة للشركة'}</h2>
        <button class="btn secondary" id="closeCompanyEditor">×</button>
      </div>
      <div class="two">
        <input id="cep_name" value="${attr(p.name||'')}" placeholder="اسم المادة">
        <input id="cep_brand" value="${attr(p.brand||'')}" placeholder="العلامة التجارية (اختياري)">
        <input id="cep_unit" value="${attr(p.unit||'')}" placeholder="الوزن / الحجم">
        <input id="cep_category" value="${attr(p.category||'')}" placeholder="التصنيف">
        <div class="company-barcode" style="grid-column:1/-1"><input id="cep_barcode" value="${attr(p.barcode||'')}" placeholder="الباركود"><button type="button" class="btn secondary" id="cep_barcode_camera">📷</button></div>
        <input id="cep_price" value="${p.price_new==null?'':attr(p.price_new)}" type="number" min="0" step="0.01" placeholder="السعر — اختياري">
        <input id="cep_image" type="file" accept="image/*">
        <textarea id="cep_desc" style="width:100%;min-height:95px;grid-column:1/-1;background:#0d1418;color:#fff;border:1px solid #303b40;border-radius:10px;padding:12px" placeholder="وصف المادة (اختياري)">${esc(p.description||'')}</textarea>
      </div>
      <p id="cepBarcodeMsg" class="muted"></p><p class="muted">ترك السعر فارغاً مسموح، وسيظهر المنتج بدون سعر.</p>
      <div class="actions"><button class="btn primary" id="saveCompanyProduct">حفظ</button><button class="btn secondary" id="cancelCompanyProduct">إلغاء</button></div>
    </div>`;
    document.body.appendChild(modal);
    $('closeCompanyEditor').onclick=()=>modal.remove();
    $('cancelCompanyProduct').onclick=()=>modal.remove();
    $('cep_barcode_camera').onclick=()=>window.openBarcodeScannerForCompanyAdd?.(window.companyContext?.company_id||currentCompany?.id);
    $('cep_barcode').addEventListener('input',()=>{$('cep_barcode').value=norm($('cep_barcode').value)});
    $('saveCompanyProduct').onclick=async()=>{
      try{
        const name=$('cep_name').value.trim();
        if(!name) return alert('اسم المادة مطلوب.');
        let image=p.image_url||null;
        const f=$('cep_image').files?.[0];
        if(f&&window.uploadImage) image=await window.uploadImage(f,'company-products');
        const price=$('cep_price').value===''?null:Number($('cep_price').value);
        if(price!==null && (!Number.isFinite(price)||price<0)) return alert('السعر غير صالح.');
        const barcode=norm($('cep_barcode').value);
        if(!editCompanyId) return alert('تعذر تحديد الشركة المرتبطة بهذه المادة.');
        if(barcode){let q=supabaseClient.from('company_products').select('id').eq('company_id',editCompanyId).eq('barcode',barcode).limit(1);if(existing)q=q.neq('id',existing.id);const dup=await q.maybeSingle();if(dup.error)throw dup.error;if(dup.data)return alert('هذا الباركود مستخدم لمادة أخرى داخل هذه الشركة.');}
        let r;
        if(existing){
          r=await supabaseClient.rpc('company_update_product',{p_id:existing.id,p_name:name,p_brand:$('cep_brand').value.trim()||null,p_unit:$('cep_unit').value.trim()||null,p_category:$('cep_category').value.trim()||null,p_category_id:null,p_barcode:barcode||null,p_description:$('cep_desc').value.trim()||null,p_image_url:image,p_price_new:price,p_active:true});
        }else{
          r=await supabaseClient.rpc('company_add_product',{p_company_id:editCompanyId,p_name:name,p_brand:$('cep_brand').value.trim()||null,p_unit:$('cep_unit').value.trim()||null,p_category:$('cep_category').value.trim()||null,p_category_id:null,p_barcode:barcode||null,p_description:$('cep_desc').value.trim()||null,p_image_url:image,p_price_new:price,p_active:true});
        }
        if(r.error) throw r.error;
        modal.remove();
        if(editContext) await loadCompanyDashboardData(editContext);
        if(!existing && window.companyContext?.can_manage_products){companyProductEditor();return;}
        if(currentCompany) await window.openCompanyById(currentCompany.id);
      }catch(err){
        alert(err.message||'تعذر حفظ المادة');
      }
    };
  }

  window.companyEditProduct=async function(id){
    const p0=companyProducts.find(x=>String(x.id)===String(id));
    const companyId=p0?.company_id||window.companyContext?.company_id||currentCompany?.id;
    const ctx=await resolveCompanyEditContext(companyId);
    if(!ctx || !companyCanEditProducts(companyId,ctx)) return alert('ليس لديك صلاحية تعديل مواد هذه الشركة.');
    const {data,error}=await supabaseClient.from('company_products').select('*').eq('id',id).eq('company_id',companyId).maybeSingle();
    if(error) return alert(error.message);
    if(data){currentCompany=currentCompany&&String(currentCompany.id)===String(companyId)?currentCompany:(await supabaseClient.from('companies').select('*').eq('id',companyId).maybeSingle()).data;window.__companyEditContext=ctx;companyProductEditor(data,ctx);}
  };
  window.companyDeleteProduct=async function(id){
    const ctx=window.companyContext;
    if(!ctx||(!ctx.can_delete_products&&!ctx.can_manage_products)) return alert('لا توجد لديك صلاحية حذف المنتجات.');
    if(!confirm('إخفاء هذه المادة عن الزوار؟')) return;
    const {error}=await supabaseClient.rpc('company_delete_product',{p_id:id});
    if(error) return alert(error.message);
    await loadCompanyDashboardData(ctx);
  };
  window.companyToggleCategory=async function(id,active){
    const ctx=window.companyContext;
    if(!ctx||!ctx.can_manage_categories) return alert('لا توجد صلاحية.');
    const {error}=await supabaseClient.rpc('company_toggle_category',{p_id:id,p_active:active});
    if(error) return alert(error.message);
    await loadCompanyDashboardData(ctx);
  };

  function adminCompanyCardRequests(list){
    if(!list.length)return '<div class="muted">لا توجد طلبات حسابات شركات.</div>';
    return list.map(r=>`<div class="company-account-row"><div class="row" style="justify-content:space-between"><div><b>${esc(r.requested_name||'حساب شركة')}</b><div class="muted">${esc(r.email||'بدون بريد')} • ${r.status}</div></div>${r.company_name?`<span class="pill">${esc(r.company_name)}</span>`:''}</div>${r.status==='pending'?`<div class="actions"><button class="btn primary" onclick="window.adminLinkCompany('${attr(r.id)}','${attr(r.user_id)}','${attr(r.requested_name||'')}')">ربط بالحساب</button></div>`:''}${r.rejection_reason?`<div class="muted">سبب الرفض: ${esc(r.rejection_reason)}</div>`:''}</div>`).join('');
  }

  window.adminLinkCompany=async function(requestId,userId,requestedName){
    if(role()!=='admin')return;
    const comps=await supabaseClient.from('companies').select('id,name').eq('active',true).order('name');if(comps.error)return alert(comps.error.message);if(!comps.data?.length)return alert('أنشئ الشركة أولاً.');
    const modal=document.createElement('div');modal.id='companyLinkModal';modal.className='company-modal';modal.innerHTML=`<div class="company-modal-inner"><h2>ربط حساب الشركة</h2><p class="muted">الحساب: ${esc(requestedName||userId)}</p><select id="acl_company">${comps.data.map(c=>`<option value="${attr(c.id)}">${esc(c.name)}</option>`).join('')}</select>${permissionInputs({},'acl')}<div class="actions"><button class="btn primary" id="acl_save">حفظ وربط</button><button class="btn secondary" id="acl_close">إلغاء</button></div></div>`;document.body.appendChild(modal);$('acl_close').onclick=()=>modal.remove();$('acl_save').onclick=async()=>{const selectedCompanyId=$('acl_company').value;const availability=await ensureCompanyAccountAvailability(userId,selectedCompanyId,'');if(availability)return alert(availability);const payload={p_request_id:requestId,p_company_id:selectedCompanyId,p_can_manage_products:$('acl_manage').checked,p_can_edit_products:$('acl_edit').checked,p_can_delete_products:$('acl_delete').checked,p_can_manage_categories:$('acl_cat').checked,p_can_manage_settings:$('acl_settings').checked,p_can_view_orders:$('acl_orders').checked};const {error}=await supabaseClient.rpc('admin_link_company_account',payload);if(error)return alert(error.message);modal.remove();await renderAdminCompanyBox()};
  };

  async function getCompanyAccountsForAdmin(){
    const [profilesRes,linkedRes]=await Promise.all([
      supabaseClient.from('profiles').select('id,name,role,company_id,store_id,phone,verified').order('created_at',{ascending:false}),
      supabaseClient.rpc('admin_list_company_users_v2')
    ]);
    if(profilesRes.error)throw profilesRes.error;
    const linked=linkedRes.error?[]:(linkedRes.data||[]);
    const map=new Map();
    // الحساب المرتبط حالياً أو المصنف company في profiles.
    (profilesRes.data||[]).forEach(u=>{
      if(String(u.role||'').toLowerCase()==='company'||u.company_id){
        map.set(String(u.id),{...u,user_id:u.id});
      }
    });
    linked.forEach(u=>{const id=String(u.user_id||'');if(!id)return;map.set(id,{...(map.get(id)||{}),...u,user_id:id});});
    try{
      const dir=await supabaseClient.rpc('get_users_for_company_link');
      if(!dir.error)(dir.data||[]).forEach(u=>{
        const id=String(u.id||u.user_id||'');
        let meta=u.user_metadata||u.raw_user_meta_data||u.user_meta_data||{};
        if(typeof meta==='string'){try{meta=JSON.parse(meta)||{}}catch(_){meta={}}}
        const type=String(
          u.account_type||u.accountType||u.type||u.role||
          meta.account_type||meta.accountType||meta.type||meta.role||''
        ).trim().toLowerCase();
        if(id&&type==='company')map.set(id,{...(map.get(id)||{}),...u,user_id:id});
      });
    }catch(err){ console.warn('company account discovery:',err); }
    return [...map.values()].sort((a,b)=>String(a.name||a.email||'').localeCompare(String(b.name||b.email||''),'ar'));
  }

  function companyAccountAdminRows(accounts,companies){
    if(!accounts.length)return '<div class="muted">لا توجد حسابات شركات حالياً.</div>';
    return accounts.map(u=>{
      const uid=String(u.id||u.user_id||'');
      const linked=companyUsers.find(x=>String(x.user_id)===uid);
      const selected=String(linked?.company_id||u.company_id||'');
      const prefix='companyAccount_'+uid.replace(/[^A-Za-z0-9_]/g,'');
      const label=esc(u.name||u.requested_name||u.email||uid);
      const email=esc(u.email||'بدون بريد');
      const status=linked?.active===false?'موقوف':(selected?'مرتبط بشركة':'غير مرتبط');
      return `<div class="company-account-row">
        <div class="accordionHead" data-company-toggle="${prefix}_body"><div><b>${label}</b></div><span>▾</span></div>
        <div id="${prefix}_body" class="accordionBody hidden">
          <div class="muted">البريد الإلكتروني: ${email} ${u.phone?'• 📞 '+esc(u.phone):'• بدون رقم هاتف'} • الحالة: ${status}</div>
          <select id="${prefix}_company"><option value="">اختر الشركة</option>${companies.filter(c=>c.active!==false).map(c=>`<option value="${attr(c.id)}" ${String(c.id)===selected?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
          ${permissionInputs(linked||u,prefix)}
          <div class="actions"><button type="button" class="btn primary" onclick="window.adminSaveCompanyAccount('${attr(uid)}')">ربط وحفظ الحساب</button>${selected?`<button type="button" class="btn danger" onclick="window.adminUnlinkCompany('${attr(uid)}')">فك الربط</button>`:''}</div>
        </div>
      </div>`;
    }).join('');
  }

  async function ensureCompanyAccountAvailability(uid,companyId,existingId){
    const companyTaken=await supabaseClient.from('company_users').select('id,user_id').eq('company_id',companyId).eq('active',true).neq('user_id',uid).limit(1).maybeSingle();
    if(companyTaken.error)throw companyTaken.error;
    if(companyTaken.data)return 'هذه الشركة مرتبطة مسبقاً بحساب شركة آخر. كل شركة يمكن ربطها بحساب شركة واحد فقط.';
    const userLinks=await supabaseClient.from('company_users').select('id,company_id').eq('user_id',uid).eq('active',true);
    if(userLinks.error)throw userLinks.error;
    const other=userLinks.data?.find(x=>String(x.company_id)!==String(companyId) && String(x.id)!==String(existingId||''));
    if(other)return 'هذا الحساب مرتبط مسبقاً بشركة أخرى. كل حساب شركة يمكن ربطه بشركة واحدة فقط.';
    return '';
  }

  window.adminSaveCompanyAccount=async function(uid){
    if(role()!=='admin')return alert('المدير فقط.');
    const prefix='companyAccount_'+String(uid).replace(/[^A-Za-z0-9_]/g,'');
    const companyId=$(`${prefix}_company`)?.value;
    if(!companyId)return alert('اختر الشركة أولاً.');
    const host=$(`${prefix}_body`);const val=k=>!!host?.querySelector(`input[data-perm="${k}"]`)?.checked;
    const existing=companyUsers.find(x=>String(x.user_id)===String(uid));
    const payload={user_id:uid,company_id:companyId,active:true,can_manage_products:val('manage'),can_manage_categories:val('cat'),can_edit_prices:val('edit'),can_delete_products:val('delete'),can_manage_settings:val('settings'),can_view_orders:val('orders'),can_view_stats:val('stats'),updated_at:new Date().toISOString()};
    try{
      const availability=await ensureCompanyAccountAvailability(uid,companyId,existing?.id);
      if(availability)return alert(availability);
      const save=existing?.id?await supabaseClient.from('company_users').update(payload).eq('id',existing.id).select('id').maybeSingle():await supabaseClient.from('company_users').insert(payload).select('id').single();
      if(save.error)throw save.error;
      const pr=await supabaseClient.from('profiles').update({role:'company',company_id:companyId,store_id:null,verified:true}).eq('id',uid);
      if(pr.error)throw pr.error;
      alert('تم ربط حساب الشركة وحفظ الصلاحيات ✅');await renderAdminCompanyBox();
    }catch(err){alert('تعذر ربط حساب الشركة: '+(err.message||err));}
  };

  window.adminCompanyAccounts=async function(){
    if(role()!=='admin')return alert('هذه الصفحة للمدير فقط.');
    await window.renderAdmin?.();
    const box=$('companyFullAdminBox');
    if(!box)return;
    $('companyFullAdminBody')?.classList.remove('hidden');
    $('companyAccountsListBody')?.classList.remove('hidden');
    box.scrollIntoView({behavior:'smooth',block:'start'});
  };

  function bindCompanyAccordions(){
    document.querySelectorAll('[data-company-toggle]').forEach(head=>head.onclick=()=>{
      const target=$(head.dataset.companyToggle);if(target)target.classList.toggle('hidden');
    });
  }

  async function renderAdminCompanyBox(){
    if(role()!=='admin')return;
    const panel=$('adminPanel'); if(!panel)return;
    let box=$('companyFullAdminBox');
    if(!box){ box=document.createElement('div'); box.id='companyFullAdminBox'; box.className='card'; panel.insertBefore(box,panel.firstChild); }

    const cr=await supabaseClient.from('companies').select('*').order('name');
    const companies=cr.data||[];
    window.__sareeCompanies=companies;

    let linked=[];
    try{
      const ur=await supabaseClient.rpc('admin_list_company_users_v2');
      if(ur.error) throw ur.error;
      linked=ur.data||[];
    }catch(err){
      console.warn('admin company users:',err);
    }
    companyUsers=linked;

    let allCompanyAccounts=[];try{allCompanyAccounts=await getCompanyAccountsForAdmin()}catch(err){console.warn('company account list:',err)}
    const companyAccountsHtml=companyAccountAdminRows(allCompanyAccounts,companies);
    const companyOptions=companies.filter(c=>c.active!==false).map(c=>`<option value="${attr(c.id)}">${esc(c.name)}</option>`).join('');
    const linkedHtml=linked.length?linked.map(u=>{
      const uid=String(u.user_id||'');
      const prefix='acct_'+uid.replace(/[^A-Za-z0-9_]/g,'');
      const account=allCompanyAccounts.find(x=>String(x.id||x.user_id||'')===uid);
      const accountName=account?.name||u.name||u.requested_name||u.email||u.user_id;
      const accountPhone=u.phone||account?.phone;
      const accountEmail=u.email||account?.email;
      return `<div class="company-account-row">
        <div class="accordionHead" data-company-toggle="${prefix}_linked_body"><div><b>${esc(accountName)}</b></div><span>▾</span></div>
        <div id="${prefix}_linked_body" class="accordionBody hidden">
          <div class="muted">البريد الإلكتروني: ${esc(accountEmail||'بدون بريد')} ${accountPhone?'• 📞 '+esc(accountPhone):'• بدون رقم هاتف'} • الحالة: ${u.active?'مفعّل':'متوقف'}</div>
          ${permissionInputs(u,prefix)}
          <div class="actions">
            <button class="btn primary" onclick="window.adminSaveCompanyPermissions('${attr(uid)}')">حفظ الصلاحيات</button>
            <button class="btn danger" onclick="window.adminUnlinkCompany('${attr(uid)}')">فك الربط</button>
          </div>
        </div>
      </div>`;
    }).join(''):'<div class="muted">لا توجد حسابات شركات مرتبطة حالياً.</div>';

    box.innerHTML=`
      <div class="accordionHead" data-company-toggle="companyFullAdminBody"><div><h2>🏢 الشركات وربط أصحاب الشركات</h2><div class="muted">حسابات الشركات وربطها بالشركات وإدارتها.</div></div><span>▾</span></div>
      <div id="companyFullAdminBody" class="accordionBody hidden">
      <div class="company-account-row">
        <div class="accordionHead" data-company-toggle="companyAccountsListBody"><div><h3 style="margin:0">👥 حسابات الشركات</h3><div class="muted">كل حساب من نوع «حساب شركة» يظهر هنا ويمكن ربطه بشركة.</div></div><span>▾</span></div>
        <div id="companyAccountsListBody" class="accordionBody hidden">${companyAccountsHtml}</div>
      </div>

      <div class="company-account-row">
        <div class="accordionHead" data-company-toggle="directCompanyBody"><div><h3 style="margin:0">🔗 ربط حساب بشركة</h3><div class="muted">ربط حساب شركة موجود بالشركة وتحديد صلاحياته.</div></div><span>▾</span></div>
        <div id="directCompanyBody" class="accordionBody hidden">
          <input id="directCompanyEmail" type="text" placeholder="اسم حساب صاحب الشركة أو بريده">
          <select id="directCompanyId"><option value="">اختر الشركة</option>${companyOptions}</select>
          ${permissionInputs({},'direct')}
          <div class="actions">
            <button type="button" class="btn primary" id="directCompanySave">ربط وحفظ الصلاحيات</button>
          </div>
          <p id="directCompanyMsg" class="muted"></p>
        </div>
      </div>

      <div class="company-account-row">
        <div class="accordionHead" data-company-toggle="linkedCompanyAccountsBody"><div><h3 style="margin:0">👥 الحسابات المرتبطة حالياً</h3><div class="muted">الحسابات المرتبطة بشركات مع صلاحياتها.</div></div><span>▾</span></div>
        <div id="linkedCompanyAccountsBody" class="accordionBody hidden"><div>${linkedHtml}</div></div>
      </div>

      <div class="company-account-row">
        <div class="accordionHead" data-company-toggle="companyManageBody"><div><h3 style="margin:0">🏢 إدارة الشركات</h3><div class="muted">إضافة وتعديل وحذف الشركات وموادها.</div></div><span>▾</span></div>
        <div id="companyManageBody" class="accordionBody hidden">
          <div class="actions"><button type="button" class="btn primary" onclick="window.openAdminCompanyCreate?.()">إضافة شركة</button></div>
          <div id="companyPublicAdminList" style="margin-top:12px">${companies.length?companies.map(c=>`<div class="company-account-row"><div class="row" style="justify-content:space-between;align-items:center"><div><b>${esc(c.name||'شركة')}</b> ${c.verified?'<span class="pill">✓ موثقة</span>':'<span class="pill">غير موثقة</span>'}<div class="muted">${esc(c.phone||'')} ${c.address?'• '+esc(c.address):''}</div></div><div><div id="companyQrAdmin_${attr(c.id)}" class="company-qr-box"></div><div class="notice" style="margin-top:8px">📱 زوار QR: <b id="companyQrAdminCount_${attr(c.id)}">—</b></div></div></div><div class="actions"><button class="btn secondary" type="button" onclick="window.openCompanyById('${attr(c.id)}')">فتح الشركة</button><button class="btn primary" type="button" onclick="window.adminManageCompanyProducts?.('${attr(c.id)}')">إدارة مواد الشركة</button><button class="btn secondary" type="button" onclick="window.printCompanyQR('${attr(c.id)}')">طباعة QR</button><button class="btn primary" type="button" onclick="window.openAdminCompanyEdit?.('${attr(c.id)}')">تعديل الشركة</button><button class="btn secondary" type="button" onclick="window.toggleAdminCompanyVerification?.('${attr(c.id)}')">${c.verified?'إلغاء التوثيق':'توثيق الشركة'}</button><button class="btn danger" type="button" onclick="window.deleteAdminCompany?.('${attr(c.id)}')">حذف الشركة</button></div><div class="muted" id="companyVisit_${attr(c.id)}">إجمالي زيارات الشركة: —</div></div>`).join(''):'<div class="muted">لا توجد شركات مسجلة.</div>'}</div>
        </div>
      </div>
      </div>`;
    bindCompanyAccordions();

    $('directCompanySave').onclick=async()=>{
      const accountName=$('directCompanyEmail').value.trim();
      const companyId=$('directCompanyId').value;
      if(!accountName||!companyId)return alert('أدخل اسم الحساب واختر الشركة.');
      const msg=$('directCompanyMsg'); msg.textContent='جاري الحفظ...';
      try{
        // لا نعتمد هنا على اسم/توقيع دالة RPC القديمة؛ يتم الربط مباشرة من لوحة المدير.
        const { data: users, error: userError } = await supabaseClient
          .rpc('get_users_for_company_link');

        if (userError) {
          throw userError;
        }

        const selectedUser = (users || []).find(
          u => String(u.email || '').toLowerCase() === String(accountName || '').toLowerCase()
        );

        if (!selectedUser) {
          throw new Error('لم يتم العثور على الحساب.');
        }

        const uid = selectedUser.id;
        const existingForUser=await supabaseClient.from('company_users').select('id,company_id').eq('user_id',uid).eq('active',true).limit(1).maybeSingle();
        if(existingForUser.error)throw existingForUser.error;
        const availability=await ensureCompanyAccountAvailability(uid,companyId,existingForUser.data?.id);
        if(availability)throw new Error(availability);
        const payload={
          user_id:uid,
          company_id:companyId,
          active:true,
          can_manage_products:!!$('direct_manage').checked,
          can_manage_categories:!!$('direct_cat').checked,
          can_edit_prices:!!$('direct_edit').checked,
          can_delete_products:!!$('direct_delete').checked,
          can_manage_settings:!!$('direct_settings').checked,
          can_view_orders:!!$('direct_orders').checked,
          can_view_stats:!!$('direct_stats').checked,
          updated_at:new Date().toISOString()
        };
        const cu=await supabaseClient.from('company_users').select('id').eq('user_id',uid).limit(1).maybeSingle();
        if(cu.error)throw cu.error;
        let save;
        if(cu.data?.id){
          save=await supabaseClient.from('company_users').update(payload).eq('id',cu.data.id).select('id').maybeSingle();
        }else{
          save=await supabaseClient.from('company_users').insert(payload).select('id').single();
        }
        if(save.error)throw save.error;
        const profileUpdate=await supabaseClient.from('profiles').update({role:'company',company_id:companyId,store_id:null,verified:true}).eq('id',uid);
        if(profileUpdate.error)throw profileUpdate.error;
        msg.textContent='تم ربط الحساب بالشركة وتفعيل الصلاحيات المحددة ✅';
        await renderAdminCompanyBox();
      }catch(err){ msg.textContent='تعذر الربط: '+(err.message||err); }
    };

    if(typeof QRCode!=='undefined') companies.forEach(c=>{ const q=$('companyQrAdmin_'+c.id); if(q){q.innerHTML=''; try{new QRCode(q,{text:companyQrUrl(c.id),width:160,height:160,correctLevel:QRCode.CorrectLevel?.H ?? 2});}catch(_){} } });

    // إجمالي زيارات الشركات للمدير
    for(const c of companies){
      const el=$('companyVisit_'+c.id); if(el) try{
        const r=await supabaseClient.rpc('company_owner_visitor_stats',{p_company_id:c.id});
        const total=Number(r.data?.total_visits||0);
        el.textContent='إجمالي زيارات الشركة: '+(Number.isFinite(total)?total.toLocaleString('ar-SY'):'0');
      }catch(_){}
      if(typeof window.getSareeQrVisitCount==='function'){
        try{const n=await window.getSareeQrVisitCount('company',c.id);const q=$('companyQrAdminCount_'+c.id);if(q)q.textContent=n==null?'—':Number(n).toLocaleString('ar-SY');}catch(_){}
      }
    }
  }

  function adminCompanyProductModalHtml(company,products){
    const rows=products.length?products.map(p=>`<div class="company-admin-product-row" data-admin-company-product="${attr(p.id)}"><div class="row" style="justify-content:space-between;gap:10px"><div><b>${esc(p.name||'مادة')}</b><div class="muted">${esc(p.barcode||'بدون باركود')} • ${p.price_new==null?'بدون سعر':money(p.price_new)+' ل.س'}${p.category?` • ${esc(p.category)}`:''}</div></div><span class="pill">${p.active===false?'مخفي':'نشط'}</span></div><div class="actions"><button class="btn secondary" type="button" onclick="window.adminEditCompanyProduct?.('${attr(company.id)}','${attr(p.id)}')">تعديل</button><button class="btn danger" type="button" onclick="window.adminDeleteCompanyProduct?.('${attr(company.id)}','${attr(p.id)}')">حذف</button></div></div>`).join(''):'<div class="muted">لا توجد مواد لهذه الشركة.</div>';
    return `<div id="adminCompanyProductList">${rows}</div>`;
  }

  async function adminGetCompanyProducts(companyId){
    const r=await supabaseClient.from('company_products').select('*').eq('company_id',companyId).order('created_at',{ascending:false});
    if(r.error)throw r.error;
    return r.data||[];
  }

  async function adminReloadCompanyProducts(companyId,company){
    const host=$('adminCompanyProductListWrap'); if(!host)return;
    try{
      const products=await adminGetCompanyProducts(companyId);
      host.innerHTML=adminCompanyProductModalHtml(company,products);
    }catch(err){host.innerHTML=`<div class="muted">تعذر تحميل المواد: ${esc(err.message||err)}</div>`;}
  }

  window.adminManageCompanyProducts=async function(companyId){
    if(role()!=='admin')return alert('المدير فقط يستطيع إدارة مواد الشركات.');
    const cr=await supabaseClient.from('companies').select('*').eq('id',companyId).maybeSingle();
    if(cr.error)return alert(cr.error.message);
    const company=cr.data;if(!company)return alert('الشركة غير موجودة.');
    const modal=document.createElement('div');
    modal.id='adminCompanyProductModal';modal.className='company-modal';
    modal.innerHTML=`<div class="company-modal-inner">
      <div class="row" style="justify-content:space-between;align-items:center;gap:10px"><div><h2 style="margin:0">إدارة مواد الشركة</h2><div class="muted">${esc(company.name||'شركة')}</div></div><button type="button" class="btn secondary" id="adminCompanyProductClose">×</button></div>
      <div class="actions" style="margin-top:12px"><button type="button" class="btn primary" id="adminCompanyProductAdd">+ إضافة مادة</button></div>
      <div id="adminCompanyProductListWrap" style="margin-top:10px"></div>
    </div>`;
    document.body.appendChild(modal);
    $('adminCompanyProductClose').onclick=()=>modal.remove();
    $('adminCompanyProductAdd').onclick=()=>window.adminEditCompanyProduct(companyId,null,company);
    await adminReloadCompanyProducts(companyId,company);
  };

  window.adminEditCompanyProduct=async function(companyId,productId,companyArg){
    if(role()!=='admin')return alert('المدير فقط يستطيع إضافة أو تعديل مواد الشركات.');
    let company=companyArg;
    if(!company){
      const cr=await supabaseClient.from('companies').select('*').eq('id',companyId).maybeSingle();
      if(cr.error)return alert(cr.error.message); company=cr.data;
    }
    if(!company)return alert('الشركة غير موجودة.');
    let existing=null;
    if(productId){
      const r=await supabaseClient.from('company_products').select('*').eq('id',productId).eq('company_id',companyId).maybeSingle();
      if(r.error)return alert(r.error.message); existing=r.data;
      if(!existing)return alert('المادة غير موجودة.');
    }
    const modal=document.createElement('div');modal.id='adminCompanyProductEditor';modal.className='company-modal';
    const p=existing||{};
    modal.innerHTML=`<div class="company-modal-inner">
      <div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">${existing?'تعديل مادة':'إضافة مادة'} — ${esc(company.name||'شركة')}</h2><button type="button" class="btn secondary" id="adminCepClose">×</button></div>
      <div class="two" style="margin-top:12px"><input id="admin_cep_name" value="${attr(p.name||'')}" placeholder="اسم المادة"><input id="admin_cep_brand" value="${attr(p.brand||'')}" placeholder="العلامة التجارية (اختياري)"><input id="admin_cep_unit" value="${attr(p.unit||'')}" placeholder="الوزن / الحجم"><input id="admin_cep_category" value="${attr(p.category||'')}" placeholder="التصنيف"><div class="company-barcode"><input id="admin_cep_barcode" value="${attr(p.barcode||'')}" placeholder="الباركود"><button type="button" class="btn secondary" id="admin_cep_barcode_camera">📷</button></div><input id="admin_cep_price" value="${p.price_new==null?'':attr(p.price_new)}" type="number" min="0" step="0.01" placeholder="السعر — اختياري"><input id="admin_cep_image" type="file" accept="image/*"></div>
      <textarea id="admin_cep_desc" style="width:100%;min-height:95px;margin-top:10px;background:#0d1418;color:#fff;border:1px solid #303b40;border-radius:10px;padding:12px" placeholder="وصف المادة (اختياري)">${esc(p.description||'')}</textarea>
      <label class="muted" style="display:block;margin-top:10px"><input id="admin_cep_active" type="checkbox" ${p.active!==false?'checked':''}> المادة نشطة</label>
      <p id="admin_cep_msg" class="muted"></p><div class="actions"><button type="button" class="btn primary" id="admin_cep_save">حفظ</button><button type="button" class="btn secondary" id="admin_cep_cancel">إلغاء</button></div>
    </div>`;
    document.body.appendChild(modal);
    $('adminCepClose').onclick=()=>modal.remove();$('admin_cep_cancel').onclick=()=>modal.remove();$('admin_cep_barcode_camera').onclick=()=>window.openBarcodeScannerForCompanyAdd?.(companyId);$('admin_cep_barcode').addEventListener('input',()=>{$('admin_cep_barcode').value=norm($('admin_cep_barcode').value)});
    $('admin_cep_save').onclick=async()=>{
      const msg=$('admin_cep_msg');msg.textContent='جاري الحفظ...';
      try{
        const name=$('admin_cep_name').value.trim();if(!name)throw new Error('اسم المادة مطلوب.');
        const rawPrice=$('admin_cep_price').value.trim();const price=rawPrice===''?null:Number(rawPrice);if(price!==null&&(!Number.isFinite(price)||price<0))throw new Error('السعر غير صالح.');
        let imageUrl=p.image_url||null;const f=$('admin_cep_image').files?.[0];if(f&&window.uploadImage)imageUrl=await window.uploadImage(f,'company-products');
        const barcode=norm($('admin_cep_barcode').value);if(barcode){let dup=supabaseClient.from('company_products').select('id').eq('company_id',companyId).eq('barcode',barcode).limit(1);if(existing)dup=dup.neq('id',existing.id);const q=await dup.maybeSingle();if(q.error)throw q.error;if(q.data)throw new Error('هذا الباركود مستخدم لمادة أخرى داخل هذه الشركة.');}
        const payload={name,brand:$('admin_cep_brand').value.trim()||null,unit:$('admin_cep_unit').value.trim()||null,category:$('admin_cep_category').value.trim()||null,category_id:null,barcode:barcode||null,description:$('admin_cep_desc').value.trim()||null,image_url:imageUrl,price_new:price,active:!!$('admin_cep_active').checked};
        let r;
        if(existing) r=await supabaseClient.from('company_products').update(payload).eq('id',existing.id).eq('company_id',companyId).select('id').maybeSingle();
        else r=await supabaseClient.from('company_products').insert({...payload,company_id:companyId}).select('id').single();
        if(r.error)throw r.error;
        modal.remove();
        const manager=$('adminCompanyProductModal');
        if(manager){const cc=await supabaseClient.from('companies').select('*').eq('id',companyId).maybeSingle();await adminReloadCompanyProducts(companyId,cc.data||company);}
        alert(existing?'تم تعديل مادة الشركة بنجاح ✅':'تمت إضافة مادة للشركة بنجاح ✅');
      }catch(err){msg.textContent='تعذر الحفظ: '+(err.message||err);}
    };
  };

  window.adminDeleteCompanyProduct=async function(companyId,productId){
    if(role()!=='admin')return alert('المدير فقط يستطيع حذف مواد الشركات.');
    if(!confirm('حذف هذه المادة من الشركة؟'))return;
    const r=await supabaseClient.from('company_products').delete().eq('id',productId).eq('company_id',companyId);
    if(r.error)return alert('تعذر حذف المادة: '+r.error.message);
    const manager=$('adminCompanyProductModal');
    if(manager){const c=await supabaseClient.from('companies').select('*').eq('id',companyId).maybeSingle();await adminReloadCompanyProducts(companyId,c.data);}
    alert('تم حذف المادة ✅');
  };

  window.adminSaveCompanyPermissions=async function(companyUserId){
    if(role()!=='admin')return alert('المدير فقط.');
    const find=companyUsers.find(x=>String(x.user_id)===String(companyUserId));
    if(!find)return alert('الحساب غير موجود في قائمة الربط.');
    const buttons=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('onclick')||'').includes(`adminSaveCompanyPermissions('${companyUserId}')`));
    const row=buttons[0]?.closest('.company-account-row');
    if(!row)return alert('تعذر العثور على بطاقة الحساب.');
    const val=k=>!!row.querySelector(`input[data-perm="${k}"]`)?.checked;
    const {error}=await supabaseClient.rpc('admin_set_company_permissions_v2',{
      p_company_user_id:find.id || find.company_user_id,
      p_can_manage_products:val('manage'),
      p_can_manage_categories:val('cat'),
      p_can_edit_prices:val('edit'),
      p_can_delete_products:val('delete'),
      p_can_manage_settings:val('settings'),
      p_can_view_orders:val('orders'),
      p_can_view_stats:val('stats')
    });
    if(error)return alert('تعذر حفظ الصلاحيات: '+error.message);
    alert('تم حفظ صلاحيات الشركة ✅');
    await renderAdminCompanyBox();
  };

  window.sareeOpenSupportManagement=function(){
    const api=window.sareeOwnerContactSponsors;
    if(api?.openAdmin)return api.openAdmin();
    const support=document.getElementById('sareeSupportersAdmin');
    const whatsapp=document.getElementById('siteWhatsapp');
    if(support){support.scrollIntoView({behavior:'smooth',block:'start'});return}
    if(whatsapp){whatsapp.closest('.card')?.scrollIntoView({behavior:'smooth',block:'start'});return}
    alert('قسم الروابط والداعمين غير ظاهر حالياً في لوحة التحكم.');
  };

  window.adminUnlinkCompany=async function(companyUserId){
    if(role()!=='admin')return;
    const linked=companyUsers.find(x=>String(x.user_id)===String(companyUserId)||String(x.id)===String(companyUserId));
    const rowId=linked?.id || linked?.company_user_id || companyUserId;
    const userId=linked?.user_id || companyUserId;
    if(!confirm('فك ربط حساب الشركة وإعادته لمستخدم عادي؟'))return;
    const {error}=await supabaseClient.rpc('admin_unlink_company_user',{p_company_user_id:rowId});
    if(error)return alert(error.message);
    const pr=await supabaseClient.from('profiles').update({role:'user',company_id:null,store_id:null,can_edit_prices:false}).eq('id',userId);
    if(pr.error) return alert('تم فك الربط من الشركة لكن تعذر تحديث دور الحساب: '+pr.error.message);
    alert('تم فك الربط ✅');
    await renderAdminCompanyBox();
  };

  async function bootstrap(){
    ensureCompanyPage();injectCss();
    const nav=document.querySelector('.navin');
    if(nav&&!document.getElementById('navCompanies')){
      const b=document.createElement('button');b.id='navCompanies';b.textContent='الشركات';b.onclick=()=>show('companies');const fav=[...nav.querySelectorAll('button')].find(x=>String(x.textContent).trim()==='المفضلة');if(fav)fav.after(b);else nav.appendChild(b);
    }
    // حساب شركة بعد الدخول
    if(typeof profileData!=='undefined'&&profileData?.role==='company')await ensureCompanyContext();
  }

  const oldRenderAdmin=window.renderAdmin;
  if(typeof oldRenderAdmin==='function')window.renderAdmin=async function(){await oldRenderAdmin();await renderAdminCompanyBox()};
  const oldLoadProfile=window.loadProfile;
  if(typeof oldLoadProfile==='function')window.loadProfile=async function(){const ok=await oldLoadProfile();if(ok)await ensureCompanyContext();return ok};

  if(typeof supabaseClient!=='undefined'&&supabaseClient?.auth)supabaseClient.auth.onAuthStateChange(()=>setTimeout(()=>ensureCompanyContext(),150));
  window.addEventListener('popstate',()=>{const q=new URLSearchParams(location.search);const cid=q.get('company');if(cid)window.openCompanyById(cid)});
  setTimeout(()=>{wireSupportContactButton();bootstrap();},0);
  window.addEventListener('load',()=>setTimeout(wireSupportContactButton,100));
  const supportObserver=new MutationObserver(()=>wireSupportContactButton());
  supportObserver.observe(document.body,{childList:true,subtree:true});
})();
