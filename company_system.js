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
      .company-account-row{border:1px solid #263137;border-radius:13px;padding:11px;margin-top:9px}
      .company-perms{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
      .company-perms label{margin:0;background:#0d1418;border:1px solid #263137;padding:9px;border-radius:10px}
      .company-barcode{display:flex;gap:8px}.company-barcode input{margin:0;flex:1}
      .company-qr-card{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-top:12px}
      .company-qr-box{width:180px;min-height:180px;padding:10px;background:#fff;border-radius:14px;display:flex;align-items:center;justify-content:center}
      .company-qr-box img,.company-qr-box canvas{max-width:160px;height:auto}
      .company-disabled{opacity:.55;pointer-events:none}
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
      u.searchParams.set('company',String(id));
      return u.toString();
    }catch(_){
      return window.location.origin+window.location.pathname+'?company='+encodeURIComponent(id);
    }
  }

  function buildCompanyQR(id){
    const box=$('companyQrBox');
    if(!box || typeof QRCode==='undefined')return;
    try{
      box.innerHTML='';
      new QRCode(box,{text:companyPublicUrl(id),width:160,height:160,correctLevel:QRCode.CorrectLevel?.H ?? 2});
    }catch(err){
      console.warn('company QR:',err);
      box.textContent='تعذر إنشاء QR حالياً.';
    }
  }

  window.printCompanyQR=function(id){
    const company=(window.__sareeCompanies||[]).find(x=>String(x.id)===String(id)) || (currentCompany&&String(currentCompany.id)===String(id)?currentCompany:null);
    const name=company?.name || 'الشركة';
    const url=companyPublicUrl(id);
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
    const favoriteIds=(()=>{try{return JSON.parse(localStorage.getItem('saree_favorites')||'[]')}catch(_){return []}})();
    const fav=favoriteIds.map(String).includes(String(p.id));
    return `<article class="card company-card"><div onclick="window.openCompanyProduct('${attr(p.id)}')" style="cursor:pointer">${p.image_url?`<img class="company-logo" style="height:145px;object-fit:contain" src="${attr(p.image_url)}" alt="${attr(p.name)}" loading="lazy">`:''}<span class="pill">${esc(p.category||'عام')}</span><div class="name">${esc(p.name)}</div>${p.brand?`<div class="muted">${esc(p.brand)}</div>`:''}${p.unit?`<div class="muted">${esc(p.unit)}</div>`:''}${p.barcode?`<div class="muted">باركود: ${esc(p.barcode)}</div>`:''}${hasPrice?`<div class="company-price">${money(p.price_new)} ل.س</div>`:'<div class="company-no-price">السعر غير محدد</div>'}</div><div class="actions"><button class="btn primary" onclick="window.openCompanyProduct('${attr(p.id)}')">تفاصيل</button><button class="btn secondary" onclick="window.toggleCompanyFavorite('${attr(p.id)}')">${fav?'★ من المفضلة':'☆ أضف للمفضلة'}</button></div></article>`;
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
    try{
      const {company,stores:linkedStores}=await loadCompanyById(id); currentCompany=company;
      history.pushState({},'',window.location.pathname+'?company='+encodeURIComponent(id));
      $('companyDetailName').textContent=company.name;
      const image=company.image_url?`<img class="img storeDetailLogo" src="${attr(company.image_url)}" alt="${attr(company.name)}">`:'';
      $('companyDetailBody').innerHTML=`
        ${image}<div class="card"><div class="row" style="justify-content:space-between;align-items:center"><div><span class="company-chip">🏢 شركة</span><div class="name">${esc(company.name)} ${company.verified?'✓':''}</div></div>${company.whatsapp_url?`<a class="btn primary" target="_blank" rel="noopener" href="${attr(company.whatsapp_url)}">💬 واتساب</a>`:''}</div><div class="muted">${esc(company.address||'')}</div>${company.phone?`<div class="muted">📞 ${esc(company.phone)}</div>`:''}<div class="company-qr-card"><div><b>QR خاص بالشركة</b><div class="muted">امسح الرمز لفتح صفحة الشركة مباشرة.</div><div class="actions"><button class="btn secondary" type="button" onclick="window.printCompanyQR('${attr(company.id)}')">طباعة QR</button></div></div><div id="companyQrBox" class="company-qr-box"></div></div></div>
        <div class="company-toolbar"><div class="company-barcode"><input id="companyProductSearch" placeholder="ابحث عن اسم أو باركود..."><button class="btn secondary" type="button" id="companyBarcodeSearchBtn">بحث</button></div><div class="two"><select id="companyProductCategory"><option value="">كل التصنيفات</option>${companyCategories.map(c=>`<option value="${attr(c.name)}">${esc(c.name)}</option>`).join('')}</select><select id="companyProductPriceFilter"><option value="all">كل المواد</option><option value="with">مواد بسعر</option><option value="without">مواد بدون سعر</option></select></div><p id="companyProductMsg" class="muted"></p></div>
        <h2 style="margin-top:15px">منتجات الشركة (${companyProducts.length})</h2><div id="companyProductsGrid" class="company-grid"></div>
        <h2 style="margin-top:20px">المتاجر المرتبطة بالشركة (${linkedStores.length})</h2><div class="grid">${linkedStores.length?linkedStores.map(renderLinkedStore).join(''):'<div class="card muted">لا توجد متاجر مرتبطة بهذه الشركة حالياً.</div>'}</div>`;
      showPage('companyDetail');
      buildCompanyQR(id);
      const render=()=>{const q=String($('companyProductSearch')?.value||'').trim().toLowerCase();const cat=String($('companyProductCategory')?.value||'');const pf=$('companyProductPriceFilter')?.value||'all';const rows=companyProducts.filter(p=>{const txt=[p.name,p.brand,p.unit,p.barcode,p.category].join(' ').toLowerCase();const has=p.price_new!==null&&p.price_new!==undefined&&p.price_new!=='';return (!q||txt.includes(q))&&(!cat||p.category===cat)&&(pf==='all'||(pf==='with'?has:!has))});$('companyProductsGrid').innerHTML=rows.length?rows.map(companyDetailCardProduct).join(''):'<div class="card muted">لا توجد مواد مطابقة.</div>';};
      $('companyProductSearch').oninput=render;$('companyProductCategory').onchange=render;$('companyProductPriceFilter').onchange=render;$('companyBarcodeSearchBtn').onclick=async()=>{const q=norm($('companyProductSearch').value);if(!q)return render();const exact=companyProducts.find(p=>norm(p.barcode)===q);if(exact){openCompanyProduct(exact.id);$('companyProductMsg').textContent='تم العثور على المادة بالباركود.'}else{$('companyProductMsg').textContent='لم يتم العثور على مادة بهذا الباركود.';render()}};render();
      try{
        const visitId=(crypto.randomUUID?crypto.randomUUID():('company_visit_'+Date.now()+'_'+Math.random().toString(36).slice(2)));
        await supabaseClient.rpc('record_company_visit',{p_company_id:id,p_visitor_id:visitId});
      }catch(_){ }
    }catch(err){alert(err.message||'تعذر فتح الشركة')}
  };

  function renderLinkedStore(st){return `<article class="card"><div class="name">${esc(st.name)}</div>${st.image_url?`<img class="img storeLogo" src="${attr(st.image_url)}">`:''}<div class="muted">${esc([st.city,st.area].filter(Boolean).join(' — '))}</div>${st.address?`<div class="muted">📍 ${esc(st.address)}</div>`:''}<div class="actions"><button class="btn primary" onclick="openStore('${attr(st.id)}')">فتح المتجر</button>${st.whatsapp_url?`<a class="btn secondary" target="_blank" rel="noopener" href="${attr(st.whatsapp_url)}">واتساب</a>`:''}</div></article>`}

  window.openCompanyProduct=function(id){
    const p=companyProducts.find(x=>String(x.id)===String(id));if(!p)return;
    const has=p.price_new!==null&&p.price_new!==undefined&&p.price_new!=='';
    const old=$('companyProductModal');if(old)old.remove();
    const m=document.createElement('div');m.id='companyProductModal';m.className='company-modal';m.innerHTML=`<div class="company-modal-inner"><div class="row" style="justify-content:space-between;align-items:center"><h2>${esc(p.name)}</h2><button class="btn secondary" id="closeCompanyProduct">×</button></div>${p.image_url?`<img class="img" style="height:230px;object-fit:contain" src="${attr(p.image_url)}">`:''}<div class="muted">${esc(p.category||'عام')}${p.brand?' • '+esc(p.brand):''}${p.unit?' • '+esc(p.unit):''}</div>${p.barcode?`<div class="muted">الباركود: ${esc(p.barcode)}</div>`:''}${has?`<div class="company-price" style="margin-top:12px">${money(p.price_new)} ل.س</div>`:'<div class="company-no-price" style="margin-top:12px">السعر غير محدد حالياً</div>'}<p class="muted">${esc(p.description||'')}</p><div class="actions"><button class="btn secondary" onclick="window.toggleCompanyFavorite('${attr(p.id)}');document.getElementById('companyProductModal')?.remove()">إدارة المفضلة</button></div></div>`;document.body.appendChild(m);$('closeCompanyProduct').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove()};
  };

  window.toggleCompanyFavorite=function(id){
    let a=[];try{a=JSON.parse(localStorage.getItem('saree_favorites')||'[]')}catch(_){a=[]} const i=a.map(String).indexOf(String(id)); if(i>=0)a.splice(i,1); else a.push(id); localStorage.setItem('saree_favorites',JSON.stringify(a)); alert(i>=0?'تمت إزالة المادة من المفضلة.':'تمت إضافة المادة إلى المفضلة.'); if(currentCompany) window.openCompanyById(currentCompany.id);
  };

  function showPage(id){
    document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
    $(id)?.classList.add('active');
    document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));
    const navName=id==='companyDetail'?'companies':id;
    const navBtn=document.querySelector(`.nav button[onclick="openNav('${navName}')"]`);
    if(navBtn)navBtn.classList.add('active');
    window.scrollTo(0,0);
  }
  const oldShow=window.show;
  window.show=function(id){
    if(id==='companies'){ensureCompanyPage();showPage('companies');renderCompaniesPage();return}
    if(id==='companyDetail'){showPage(id);return}
    return oldShow(id);
  };

  function companyDashboardHost(){return $('adminPanel')}
  async function getCompanyContext(){
    if(role()!=='company')return null;
    const {data,error}=await supabaseClient.from('company_users').select('*,companies(*)').eq('user_id',profileData.id).eq('active',true).maybeSingle();
    if(error)throw error;return data;
  }

  async function ensureCompanyContext(){
    try{
      if(typeof profileData==='undefined'||!profileData||typeof supabaseClient==='undefined')return;
      const userRes=await supabaseClient.auth.getUser();const user=userRes.data?.user;if(!user)return;
      if(String(user.user_metadata?.account_type||'').toLowerCase()==='company'){
        try{await supabaseClient.rpc('request_company_account',{p_requested_name:user.user_metadata?.name||profileData?.name||null})}catch(_){ }
      }
      const ctx=await getCompanyContext();if(ctx){currentCompany=ctx.companies;window.companyContext=ctx;renderCompanyDashboard(ctx);}
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
    showPage('admin');
    const host=companyDashboardHost();if(!host)return;
    const c=ctx.companies;
    host.innerHTML=`<div class="hero"><h1>لوحة شركة ${esc(c.name)}</h1><p class="muted">الصلاحيات التي منحها لك المدير هي التي تحدد ما يمكنك فعله.</p><div class="actions"><button class="btn secondary" onclick="window.openCompanyById('${attr(c.id)}')">فتح صفحة الشركة العامة</button><button class="btn secondary" onclick="window.printCompanyQR('${attr(c.id)}')">طباعة QR الشركة</button><button class="btn secondary" onclick="logout()">تسجيل الخروج</button></div><div class="company-qr-card"><div><b>QR خاص بالشركة</b><div class="muted">هذا الرمز يفتح صفحة الشركة العامة مباشرة.</div></div><div id="companyDashboardQrBox" class="company-qr-box"></div></div></div><div class="grid"><div class="stat"><b id="companyProductCount">0</b> منتجات</div><div class="stat"><b id="companyCategoryCount">0</b> تصنيفات</div><div class="stat"><b id="companyVisitorCount">—</b> إجمالي زيارات الشركة</div><div class="stat"><b>${ctx.active?'مفعّل':'موقوف'}</b> الحساب</div></div><div class="card"><h2>صلاحيات الحساب</h2><div class="company-perms"><div class="stat">إضافة المنتجات: <b>${ctx.can_manage_products?'مفعلة':'موقوفة'}</b></div><div class="stat">تعديل المنتجات والأسعار: <b>${(ctx.can_edit_products||ctx.can_edit_prices)?'مفعلة':'موقوفة'}</b></div><div class="stat">حذف المنتجات: <b>${ctx.can_delete_products?'مفعلة':'موقوفة'}</b></div><div class="stat">التصنيفات: <b>${ctx.can_manage_categories?'مفعلة':'موقوفة'}</b></div><div class="stat">الإعدادات: <b>${ctx.can_manage_settings?'مفعلة':'موقوفة'}</b></div><div class="stat">الطلبات: <b>${ctx.can_view_orders?'مفعلة':'موقوفة'}</b></div><div class="stat">الإحصائيات: <b>${ctx.can_view_stats?'مفعلة':'موقوفة'}</b></div></div></div><div class="card"><h2>إدارة المنتجات</h2><p class="muted">السعر اختياري. يمكن حفظ المادة بباركود فقط ثم ستظهر للزوار داخل صفحة الشركة.</p><div class="actions"><button class="btn primary ${ctx.can_manage_products?'':'company-disabled'}" onclick="window.companyAddProduct()">إضافة مادة</button><button class="btn secondary" onclick="window.openCompanyById('${attr(c.id)}')">معاينة المنتجات</button></div><div id="companyDashboardProducts" style="margin-top:12px"></div></div><div class="card"><h2>تصنيفات الشركة</h2><div class="two"><input id="companyCategoryName" placeholder="اسم التصنيف"><button class="btn primary ${ctx.can_manage_categories?'':'company-disabled'}" id="companyAddCategoryBtn">إضافة تصنيف</button></div><div id="companyDashboardCategories" style="margin-top:12px"></div></div>`;
    if(typeof QRCode!=='undefined'){
      const box=$('companyDashboardQrBox');
      if(box){
        box.innerHTML='';
        try{new QRCode(box,{text:companyPublicUrl(c.id),width:160,height:160,correctLevel:QRCode.CorrectLevel?.H ?? 2});}catch(e){console.warn('company dashboard QR:',e);}
      }
    }
    loadCompanyDashboardData(ctx);
    loadCompanyVisitorStats(ctx);
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

  function companyProductEditor(existing){
    const p=existing||{};
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
        <input id="cep_barcode" value="${attr(p.barcode||'')}" placeholder="الباركود">
        <input id="cep_price" value="${p.price_new==null?'':attr(p.price_new)}" type="number" min="0" step="0.01" placeholder="السعر — اختياري">
        <input id="cep_image" type="file" accept="image/*">
        <textarea id="cep_desc" style="width:100%;min-height:95px;grid-column:1/-1;background:#0d1418;color:#fff;border:1px solid #303b40;border-radius:10px;padding:12px" placeholder="وصف المادة (اختياري)">${esc(p.description||'')}</textarea>
      </div>
      <p class="muted">ترك السعر فارغاً مسموح، وسيظهر المنتج بدون سعر.</p>
      <div class="actions"><button class="btn primary" id="saveCompanyProduct">حفظ</button><button class="btn secondary" id="cancelCompanyProduct">إلغاء</button></div>
    </div>`;
    document.body.appendChild(modal);
    $('closeCompanyEditor').onclick=()=>modal.remove();
    $('cancelCompanyProduct').onclick=()=>modal.remove();
    $('saveCompanyProduct').onclick=async()=>{
      try{
        const name=$('cep_name').value.trim();
        if(!name) return alert('اسم المادة مطلوب.');
        let image=p.image_url||null;
        const f=$('cep_image').files?.[0];
        if(f&&window.uploadImage) image=await window.uploadImage(f,'company-products');
        const price=$('cep_price').value===''?null:Number($('cep_price').value);
        if(price!==null && (!Number.isFinite(price)||price<0)) return alert('السعر غير صالح.');
        let r;
        if(existing){
          r=await supabaseClient.rpc('company_update_product',{p_id:existing.id,p_name:name,p_brand:$('cep_brand').value.trim()||null,p_unit:$('cep_unit').value.trim()||null,p_category:$('cep_category').value.trim()||null,p_category_id:null,p_barcode:$('cep_barcode').value.trim()||null,p_description:$('cep_desc').value.trim()||null,p_image_url:image,p_price_new:price,p_active:true});
        }else{
          r=await supabaseClient.rpc('company_add_product',{p_name:name,p_brand:$('cep_brand').value.trim()||null,p_unit:$('cep_unit').value.trim()||null,p_category:$('cep_category').value.trim()||null,p_category_id:null,p_barcode:$('cep_barcode').value.trim()||null,p_description:$('cep_desc').value.trim()||null,p_image_url:image,p_price_new:price});
        }
        if(r.error) throw r.error;
        modal.remove();
        await loadCompanyDashboardData(window.companyContext);
        if(currentCompany) await window.openCompanyById(currentCompany.id);
      }catch(err){
        alert(err.message||'تعذر حفظ المادة');
      }
    };
  }

  window.companyEditProduct=async function(id){
    const ctx=window.companyContext;
    if(!ctx) return;
    const {data,error}=await supabaseClient.from('company_products').select('*').eq('id',id).maybeSingle();
    if(error) return alert(error.message);
    if(data) companyProductEditor(data);
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
    const modal=document.createElement('div');modal.id='companyLinkModal';modal.className='company-modal';modal.innerHTML=`<div class="company-modal-inner"><h2>ربط حساب الشركة</h2><p class="muted">الحساب: ${esc(requestedName||userId)}</p><select id="acl_company">${comps.data.map(c=>`<option value="${attr(c.id)}">${esc(c.name)}</option>`).join('')}</select>${permissionInputs({},'acl')}<div class="actions"><button class="btn primary" id="acl_save">حفظ وربط</button><button class="btn secondary" id="acl_close">إلغاء</button></div></div>`;document.body.appendChild(modal);$('acl_close').onclick=()=>modal.remove();$('acl_save').onclick=async()=>{const payload={p_request_id:requestId,p_company_id:$('acl_company').value,p_can_manage_products:$('acl_manage').checked,p_can_edit_products:$('acl_edit').checked,p_can_delete_products:$('acl_delete').checked,p_can_manage_categories:$('acl_cat').checked,p_can_manage_settings:$('acl_settings').checked,p_can_view_orders:$('acl_orders').checked};const {error}=await supabaseClient.rpc('admin_link_company_account',payload);if(error)return alert(error.message);modal.remove();await renderAdminCompanyBox()};
  };

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

    const companyOptions=companies.filter(c=>c.active!==false).map(c=>`<option value="${attr(c.id)}">${esc(c.name)}</option>`).join('');
    const linkedHtml=linked.length?linked.map(u=>{
      const uid=String(u.user_id||'');
      const prefix='acct_'+uid.replace(/[^A-Za-z0-9_]/g,'');
      return `<div class="company-account-row">
        <div><b>${esc(u.email||u.user_id)}</b> <span class="pill">${esc(u.company_name||'شركة')}</span></div>
        <div class="muted">الحالة: ${u.active?'مفعّل':'متوقف'}</div>
        ${permissionInputs(u,prefix)}
        <div class="actions">
          <button class="btn primary" onclick="window.adminSaveCompanyPermissions('${attr(uid)}')">حفظ الصلاحيات</button>
          <button class="btn danger" onclick="window.adminUnlinkCompany('${attr(uid)}')">فك الربط</button>
        </div>
      </div>`;
    }).join(''):'<div class="muted">لا توجد حسابات شركات مرتبطة حالياً.</div>';

    box.innerHTML=`
      <h2>🏢 الشركات وربط أصحاب الشركات</h2>
      <p class="muted">المدير يحدد الحساب والشركة والصلاحيات. صاحب الشركة يرى ويدير الشركة المرتبطة به فقط.</p>

      <div class="company-account-row">
        <h3 style="margin-top:0">🔗 ربط حساب بشركة</h3>
        <input id="directCompanyEmail" type="email" placeholder="بريد صاحب الشركة">
        <select id="directCompanyId"><option value="">اختر الشركة</option>${companyOptions}</select>
        ${permissionInputs({},'direct')}
        <div class="actions">
          <button type="button" class="btn primary" id="directCompanySave">ربط وحفظ الصلاحيات</button>
        </div>
        <p id="directCompanyMsg" class="muted"></p>
      </div>

      <div class="company-account-row">
        <h3 style="margin-top:0">👥 الحسابات المرتبطة حالياً</h3>
        <div>${linkedHtml}</div>
      </div>

      <div class="company-account-row">
        <h3 style="margin-top:0">🏢 إدارة الشركات</h3>
        <div class="actions"><button type="button" class="btn primary" onclick="window.openAdminCompanyCreate?.()">إضافة شركة</button></div>
        <div id="companyPublicAdminList" style="margin-top:12px">${companies.length?companies.map(c=>`<div class="company-account-row"><div class="row" style="justify-content:space-between;align-items:center"><div><b>${esc(c.name||'شركة')}</b> ${c.verified?'<span class="pill">✓ موثقة</span>':'<span class="pill">غير موثقة</span>'}<div class="muted">${esc(c.phone||'')} ${c.address?'• '+esc(c.address):''}</div></div><div id="companyQrAdmin_${attr(c.id)}" class="company-qr-box"></div></div><div class="actions"><button class="btn secondary" type="button" onclick="window.openCompanyById('${attr(c.id)}')">فتح الشركة</button><button class="btn secondary" type="button" onclick="window.printCompanyQR('${attr(c.id)}')">طباعة QR</button><button class="btn primary" type="button" onclick="window.openAdminCompanyEdit?.('${attr(c.id)}')">تعديل الشركة</button><button class="btn secondary" type="button" onclick="window.toggleAdminCompanyVerification?.('${attr(c.id)}')">${c.verified?'إلغاء التوثيق':'توثيق الشركة'}</button><button class="btn danger" type="button" onclick="window.deleteAdminCompany?.('${attr(c.id)}')">حذف الشركة</button></div><div class="muted" id="companyVisit_${attr(c.id)}">إجمالي زيارات الشركة: —</div></div>`).join(''):'<div class="muted">لا توجد شركات مسجلة.</div>'}</div>
      </div>`;

    $('directCompanySave').onclick=async()=>{
      const email=$('directCompanyEmail').value.trim().toLowerCase();
      const companyId=$('directCompanyId').value;
      if(!email||!companyId)return alert('أدخل بريد صاحب الشركة واختر الشركة.');
      const msg=$('directCompanyMsg'); msg.textContent='جاري الحفظ...';
      try{
        const r=await supabaseClient.rpc('admin_link_company_user_by_email',{
          p_email:email,
          p_company_id:companyId,
          p_can_manage_products:!!$('direct_manage').checked,
          p_can_manage_categories:!!$('direct_cat').checked,
          p_can_edit_prices:!!$('direct_edit').checked,
          p_can_delete_products:!!$('direct_delete').checked,
          p_can_manage_settings:!!$('direct_settings').checked,
          p_can_view_orders:!!$('direct_orders').checked,
          p_can_view_stats:!!$('direct_stats').checked
        });
        if(r.error)throw r.error;
        const uid=r.data?.user_id;
        if(uid){
          const pr=await supabaseClient.from('profiles').update({role:'company',company_id:companyId,store_id:null,can_edit_prices:false,verified:true}).eq('id',uid);
          if(pr.error) throw pr.error;
        }
        msg.textContent='تم ربط الحساب بالشركة وتفعيل الصلاحيات المحددة ✅';
        await renderAdminCompanyBox();
      }catch(err){ msg.textContent='تعذر الربط: '+(err.message||err); }
    };

    if(typeof QRCode!=='undefined') companies.forEach(c=>{ const q=$('companyQrAdmin_'+c.id); if(q){q.innerHTML=''; try{new QRCode(q,{text:companyPublicUrl(c.id),width:160,height:160,correctLevel:QRCode.CorrectLevel?.H ?? 2});}catch(_){} } });

    // إجمالي زيارات الشركات للمدير
    for(const c of companies){
      const el=$('companyVisit_'+c.id); if(!el)continue;
      try{
        const r=await supabaseClient.rpc('company_owner_visitor_stats',{p_company_id:c.id});
        const total=Number(r.data?.total_visits||0);
        el.textContent='إجمالي زيارات الشركة: '+(Number.isFinite(total)?total.toLocaleString('ar-SY'):'0');
      }catch(_){}
    }
  }

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
