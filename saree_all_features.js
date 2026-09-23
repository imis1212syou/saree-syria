
/* ================= saree_category_products.js ================= */
/* سعرلي سوريا - التصنيفات والمتجر والمنتجات بحجم متوسط */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const money=v=>Number(v||0).toLocaleString('ar-SY',{maximumFractionDigits:2});
  const getProducts=()=>{try{return products||[]}catch(_){return []}};
  const getStores=()=>{try{return stores||[]}catch(_){return []}};
  const getPrices=()=>{try{return prices||[]}catch(_){return []}};

  function installCss(){
    if($('sareeFinalUiCss')) return;
    const s=document.createElement('style');s.id='sareeFinalUiCss';
    s.textContent=`
      #products.grid,#storesList.grid,#cats.grid,#storeProductsGrid.grid{grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch}
      .saree-medium-card{height:100%;display:flex;flex-direction:column;overflow:hidden}
      .saree-medium-card .img{height:155px;object-fit:contain;background:#0d1418}
      .saree-medium-card .actions{margin-top:auto}
      .saree-category-card{cursor:pointer;transition:transform .15s,border-color .15s}.saree-category-card:active{transform:scale(.98)}
      .saree-modal{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.78);padding:12px;overflow:auto}
      .saree-modal-inner{width:min(960px,100%);margin:25px auto;background:#10191e;border:1px solid #303b40;border-radius:20px;padding:16px}
      .saree-modal-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
      .saree-product-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}
      .saree-store-cart{margin-top:12px;border:1px solid #263137;border-radius:14px;padding:12px;background:#0d1418}
      .saree-cart-line{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;border-bottom:1px solid #263137;padding:9px 0}
      .saree-qty{display:flex;align-items:center;gap:6px}.saree-qty button{width:34px;height:34px;border:1px solid #303b40;border-radius:9px;background:#1a2429;color:#fff}
      .saree-cart-total{font-size:20px;font-weight:800;color:#35d07f;margin-top:10px}
      @media(max-width:650px){#products.grid,#storesList.grid,#cats.grid,#storeProductsGrid.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.saree-product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.saree-medium-card{padding:11px}.saree-medium-card .img{height:135px}.saree-cart-line{grid-template-columns:1fr auto}.saree-cart-line>.saree-line-price{grid-column:1/-1}}
      @media(min-width:900px){#products.grid,#storesList.grid,#cats.grid,#storeProductsGrid.grid{grid-template-columns:repeat(3,minmax(0,1fr))}.saree-product-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    `;
    document.head.appendChild(s);
  }

  function categoryProducts(category){return getProducts().filter(p=>(p.category||'عام')===category)}

  function openCategory(category){
    const list=categoryProducts(category);
    const old=$('sareeCategoryModal');if(old)old.remove();
    const modal=document.createElement('div');modal.id='sareeCategoryModal';modal.className='saree-modal';
    modal.innerHTML=`<div class="saree-modal-inner"><div class="saree-modal-head"><div><h2>منتجات تصنيف: ${esc(category)}</h2><div class="muted">${list.length} منتجات ضمن تصنيف «${esc(category)}»</div></div><button class="btn secondary" id="sareeCloseCat">× إغلاق</button></div><input id="sareeCatSearch" placeholder="ابحث داخل هذا التصنيف..."><div id="sareeCatProducts" class="saree-product-grid"></div></div>`;
    document.body.appendChild(modal);
    const render=()=>{const q=($('sareeCatSearch')?.value||'').trim().toLowerCase();const rows=list.filter(p=>[p.name,p.brand,p.unit,p.barcode].join(' ').toLowerCase().includes(q));$('sareeCatProducts').innerHTML=rows.length?rows.map(productCard).join(''):`<div class="card muted">لا توجد منتجات مطابقة داخل هذا التصنيف.</div>`};
    $('sareeCloseCat').onclick=()=>modal.remove();modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});$('sareeCatSearch').oninput=render;render();
  }

  function productCard(p){
    const rows=getPrices().filter(x=>String(x.product_id)===String(p.id));
    rows.sort((a,b)=>Number(a.price_new)-Number(b.price_new));
    const c=rows[0];
    return `<article class="card saree-medium-card"><div onclick="window.sareeOpenProductInfo('${esc(p.id)}')" style="cursor:pointer">${p.image_url?`<img class="img" src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`:''}<span class="pill">${esc(p.category||'عام')}</span><div class="name">${esc(p.name||'مادة')}</div>${p.brand?`<div class="muted">${esc(p.brand)}</div>`:''}${p.unit?`<div class="muted">${esc(p.unit)}</div>`:''}${c?`<div class="price">${money(c.price_new)} ل.س</div><div class="muted">${esc(c.stores?.name||'')}</div>`:`<div class="notice pending">لا يوجد سعر معتمد حالياً</div>`}</div><div class="actions"><button class="btn primary" onclick="window.sareeOpenProductInfo('${esc(p.id)}')">تفاصيل</button></div></article>`;
  }

  window.sareeOpenProductInfo=function(productId){
    const p=getProducts().find(x=>String(x.id)===String(productId));if(!p)return;
    const rows=getPrices().filter(x=>String(x.product_id)===String(productId));
    const storesBy=[];rows.forEach(r=>{if(r.stores&&!storesBy.some(s=>String(s.id)===String(r.stores.id)))storesBy.push(r.stores)});
    const companyStores=storesBy.filter(s=>s.company_id);
    const companyName=companyStores[0]?.company_name||'';
    const old=$('sareeProductModal');if(old)old.remove();
    const m=document.createElement('div');m.id='sareeProductModal';m.className='saree-modal';
    m.innerHTML=`<div class="saree-modal-inner"><div class="saree-modal-head"><h2>${esc(p.name)}</h2><button class="btn secondary" id="sareeCloseProduct">×</button></div>${p.image_url?`<img class="img" style="height:210px;object-fit:contain" src="${esc(p.image_url)}">`:''}<div class="muted">${esc(p.unit||'')} ${p.brand?'• '+esc(p.brand):''}</div>${companyName?`<div class="notice">🏢 تصفح الشركة المنتجة: ${esc(companyName)}</div>`:''}<h3 style="margin-top:15px">الأسعار والمتاجر</h3><div class="saree-product-grid">${rows.length?rows.map(r=>`<div class="card"><div class="name">${esc(r.stores?.name||'المتجر')}</div><div class="price">${money(r.price_new)} ل.س</div>${r.stores?.city?`<div class="muted">${esc(r.stores.city)}</div>`:''}<button class="btn primary" style="margin-top:10px" onclick="window.openStore('${esc(r.store_id)}');document.getElementById('sareeProductModal')?.remove()">فتح المتجر</button></div>`).join(''):'<div class="card muted">لا توجد أسعار معتمدة.</div>'}</div></div>`;
    document.body.appendChild(m);$('sareeCloseProduct').onclick=()=>m.remove();m.addEventListener('click',e=>{if(e.target===m)m.remove()});
  };

  // التصنيفات: مشروعك الأساسي يعيد رسم البطاقات بدالة داخلية، لذلك نعتمد تفويض النقر من الحاوية نفسها.
  document.addEventListener('click',function(ev){
    const card=ev.target.closest('#cats .card');
    if(!card) return;
    const pill=card.querySelector('.pill');
    const category=(pill?.textContent||'').trim();
    if(!category) return;
    ev.preventDefault();
    openCategory(category);
  });

  window.renderCategories=function(){
    const map={};getProducts().forEach(p=>(map[p.category||'عام']??=[]).push(p));
    const box=$('cats');if(!box)return;
    box.innerHTML=Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0],'ar')).map(([name,list])=>`<article class="card saree-category-card" onclick="window.sareeOpenCategory(${JSON.stringify(name)})"><span class="pill">${esc(name)}</span><div class="name">${list.length} منتجات</div><div class="muted">اضغط لعرض جميع منتجات التصنيف</div></article>`).join('')||'<div class="card muted">لا توجد تصنيفات.</div>';
  };
  window.sareeOpenCategory=openCategory;

  const oldRenderProducts=window.renderProducts;
  window.renderProducts=function(){if(typeof oldRenderProducts==='function')oldRenderProducts();installCss();};
  const oldRenderStores=window.renderStores;
  window.renderStores=function(){if(typeof oldRenderStores==='function')oldRenderStores();setTimeout(()=>{document.querySelectorAll('#storesList .card').forEach(c=>c.classList.add('saree-medium-card'))},0);installCss();};

  installCss();
  setTimeout(()=>{try{window.renderCategories()}catch(_){}} ,300);
})();


/* ================= saree_whatsapp_orders.js ================= */
/* سعرلي سوريا - سلة مستقلة لكل متجر وطلبات واتساب */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const money=v=>Number(v||0).toLocaleString('ar-SY',{maximumFractionDigits:2});
  const cartsKey='saree_store_carts_v1';
  let settings={enabled:false,fee:50};
  const carts=()=>{try{return JSON.parse(localStorage.getItem(cartsKey)||'{}')}catch(_){return {}}};
  function saveCarts(c){localStorage.setItem(cartsKey,JSON.stringify(c));updateNavCount()}
  function storeCart(storeId){const c=carts();return c[storeId]||{}};
  function setStoreCart(storeId,cart){const c=carts();c[storeId]=cart;saveCarts(c)}
  function updateNavCount(){const total=Object.values(carts()).reduce((n,c)=>n+Object.values(c).reduce((a,x)=>a+Number(x.qty||0),0),0);if($('basketCount'))$('basketCount').textContent=total}
  async function loadSettings(){
    try{const {data,error}=await supabaseClient.from('saree_feature_settings').select('key,value').in('key',['whatsapp_orders_enabled','whatsapp_order_fee']);if(error)throw error;(data||[]).forEach(x=>{if(x.key==='whatsapp_orders_enabled')settings.enabled=String(x.value).toLowerCase()==='true';if(x.key==='whatsapp_order_fee')settings.fee=Number(x.value||0)});}catch(e){console.warn('whatsapp settings',e)}
    window.sareeWhatsappOrdersEnabled=settings.enabled;window.sareeWhatsappOrderFee=settings.fee;
  }
  function rowsForStore(storeId){
    let rows=[];try{rows=(prices||[]).filter(x=>String(x.store_id)===String(storeId))}catch(_){rows=[]}
    return rows.map(r=>({row:r,p:(products||[]).find(p=>String(p.id)===String(r.product_id))})).filter(x=>x.p);
  }
  function add(storeId,productId){if(!settings.enabled)return alert('طلبات واتساب غير مفعلة حالياً.');const row=rowsForStore(storeId).find(x=>String(x.p.id)===String(productId));if(!row)return alert('لم يتم العثور على سعر المنتج في هذا المتجر.');const c=storeCart(storeId);c[productId]=c[productId]||{qty:0,price:Number(row.row.price_new||0),name:row.p.name,unit:row.p.unit||''};c[productId].qty++;setStoreCart(storeId,c);renderStoreCart(storeId)}
  function change(storeId,pid,delta){const c=storeCart(storeId);if(!c[pid])return;c[pid].qty+=delta;if(c[pid].qty<=0)delete c[pid];setStoreCart(storeId,c);renderStoreCart(storeId)}
  function clear(storeId){setStoreCart(storeId,{});renderStoreCart(storeId)}
  function renderStoreCart(storeId){const box=$('sareeStoreCart');if(!box)return;const c=storeCart(storeId),items=Object.entries(c);if(!settings.enabled){box.innerHTML='';box.classList.add('hidden');return}box.classList.remove('hidden');if(!items.length){box.innerHTML='<div class="muted">السلة فارغة. أضف المنتجات من القائمة.</div>';return}let subtotal=0;box.innerHTML=`<h3>سلة هذا المتجر</h3>${items.map(([pid,x])=>{const line=x.qty*x.price;subtotal+=line;return `<div class="saree-cart-line"><div><b>${esc(x.name)}</b>${x.unit?`<div class="muted">${esc(x.unit)}</div>`:''}</div><div class="saree-qty"><button onclick="window.sareeCartChange('${esc(storeId)}','${esc(pid)}',-1)">−</button><b>${x.qty}</b><button onclick="window.sareeCartChange('${esc(storeId)}','${esc(pid)}',1)">+</button></div><div class="saree-line-price">${money(line)} ل.س</div></div>`}).join('')}<div class="muted">المجموع الفرعي: ${money(subtotal)} ل.س</div><div class="muted">رسم الطلب: ${money(settings.fee)} ل.س</div><div class="saree-cart-total">الإجمالي: ${money(subtotal+settings.fee)} ل.س</div><div class="actions"><button class="btn primary" onclick="window.sareeSendWhatsappOrder('${esc(storeId)}')">إرسال الطلب عبر واتساب</button><button class="btn secondary" onclick="window.sareeClearStoreCart('${esc(storeId)}')">تفريغ السلة</button></div>`}
  async function getStore(storeId){let st=(stores||[]).find(s=>String(s.id)===String(storeId));if(st)return st;const {data}=await supabaseClient.from('stores').select('*,companies(id,name,whatsapp_url,verified,active)').eq('id',storeId).maybeSingle();return data}
  function waTarget(st){return st?.whatsapp_url||st?.whatsapp||st?.companies?.whatsapp_url||''}
  function waLink(target,text){
    if(!target) return '';
    let v=String(target).trim();
    // نحول wa.me / api.whatsapp.com / الرقم المحلي إلى مخطط التطبيق مباشرة.
    let phone='';
    const m=v.match(/(?:wa\.me\/|phone=)([0-9]+)/i);
    if(m) phone=m[1];
    if(!phone) phone=v.replace(/\D/g,'');
    if(phone.startsWith('00963')) phone=phone.slice(2);
    else if(phone.startsWith('09')) phone='963'+phone.slice(1);
    else if(phone.startsWith('9') && phone.length>=9 && phone.length<=10) phone='963'+phone;
    if(!phone) return '';
    return 'whatsapp://send?phone='+phone+'&text='+encodeURIComponent(text);
  }
  async function send(storeId){if(!settings.enabled)return alert('طلبات واتساب غير مفعلة حالياً.');const st=await getStore(storeId);if(!st)return alert('المتجر غير موجود.');const target=waTarget(st);if(!target)return alert('هذا المتجر لم يضع رابط واتساب للطلبات بعد.');const c=storeCart(storeId),items=Object.entries(c);if(!items.length)return alert('السلة فارغة.');let subtotal=0;const lines=items.map(([pid,x],i)=>{const line=x.qty*x.price;subtotal+=line;return `${i+1}) ${x.name}${x.unit?' ('+x.unit+')':''} × ${x.qty} = ${money(line)} ل.س`});const name=prompt('اسم العميل (اختياري):','')??'';const phone=prompt('رقم هاتف العميل (اختياري):','')??'';const notes=prompt('ملاحظات الطلب (اختياري):','')??'';const total=subtotal+settings.fee;const msg=`طلب من سعرلي سوريا\nالمتجر: ${st.name||''}\n\n${lines.join('\n')}\n\nالمجموع الفرعي: ${money(subtotal)} ل.س\nرسم الطلب: ${money(settings.fee)} ل.س\nالإجمالي: ${money(total)} ل.س\n\nاسم العميل: ${name||'—'}\nهاتف العميل: ${phone||'—'}\nملاحظات: ${notes||'—'}`;try{const {data,error}=await supabaseClient.rpc('submit_whatsapp_order',{p_store_id:storeId,p_customer_name:name||null,p_customer_phone:phone||null,p_customer_notes:notes||null,p_subtotal:subtotal,p_request_fee:settings.fee,p_total:total,p_items:items.map(([pid,x])=>({product_id:pid,name:x.name,unit:x.unit,quantity:x.qty,unit_price:x.price,line_total:x.qty*x.price}))});if(error)throw error;const url=waLink(target,msg);if(!url)throw new Error('رابط واتساب غير صالح.');window.location.href=url;clear(storeId);}catch(e){console.error(e);alert('تعذر تسجيل الطلب: '+(e.message||'خطأ غير معروف'))}}
  window.sareeCartAdd=add;window.sareeCartChange=change;window.sareeClearStoreCart=clear;window.sareeSendWhatsappOrder=send;
  window.renderSareeStoreCart=renderStoreCart;
  const old=window.renderStoreDetail;
  window.renderStoreDetail=async function(id){await old(id);const storeId=id||window.currentStoreId; if(!storeId)return;const body=$('storeDetailBody');if(!body)return;const oldCart=$('sareeStoreCart');if(oldCart)oldCart.remove();const holder=document.createElement('div');holder.id='sareeStoreCart';holder.className='saree-store-cart';const productGrid=$('storeProductsGrid');if(productGrid){productGrid.parentNode.insertBefore(holder,productGrid)}else{body.appendChild(holder)};const rows=rowsForStore(storeId);if(settings.enabled&&rows.length){rows.forEach(({p})=>{const card=[...document.querySelectorAll('#storeProductsGrid [data-product-id]')].find(x=>String(x.dataset.productId)===String(p.id));if(card&&!card.querySelector('[data-saree-add]')){const a=card.querySelector('.actions')||card.appendChild(document.createElement('div'));a.classList.add('actions');const b=document.createElement('button');b.className='btn primary';b.textContent='إضافة للسلة';b.setAttribute('data-saree-add','1');b.onclick=()=>add(storeId,p.id);a.appendChild(b)}})}renderStoreCart(storeId)};
  const oldBasket=window.renderBasket;
  window.renderBasket=function(){if(typeof oldBasket==='function')oldBasket();const box=$('basketList');if(!box)return;const all=carts(),ids=Object.keys(all).filter(k=>Object.keys(all[k]||{}).length);if(!ids.length)return;box.innerHTML=`<div class="card"><h2>سلال المتاجر</h2>${ids.map(id=>{const st=(stores||[]).find(s=>String(s.id)===String(id));const count=Object.values(all[id]).reduce((a,x)=>a+Number(x.qty||0),0);return `<div class="priceRow"><b>${esc(st?.name||'المتجر')}</b><div class="muted">${count} قطع</div><button class="btn primary" onclick="window.openStore('${esc(id)}')">فتح سلة المتجر</button></div>`}).join('')}</div>`};
  loadSettings().then(updateNavCount);setTimeout(()=>loadSettings().then(updateNavCount),1000);updateNavCount();
})();


/* ================= saree_admin_features.js ================= */
/* سعرلي سوريا - إعدادات الميزات والإدارة */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const admin=()=>{try{return String(profileData?.role||'').toLowerCase()==='admin'}catch(_){return false}};
  let settings={enabled:false,fee:50};
  async function getSettings(){try{const {data,error}=await supabaseClient.from('saree_feature_settings').select('key,value');if(error)throw error;(data||[]).forEach(x=>{if(x.key==='whatsapp_orders_enabled')settings.enabled=String(x.value).toLowerCase()==='true';if(x.key==='whatsapp_order_fee')settings.fee=Number(x.value||0)});}catch(e){console.warn(e)}}
  async function saveSetting(key,value){const {error}=await supabaseClient.from('saree_feature_settings').upsert({key,value:String(value),updated_at:new Date().toISOString()},{onConflict:'key'});if(error)throw error}
  async function injectAdmin(){
    if(!admin())return;const panel=$('adminPanel');if(!panel)return;
    if(!$('sareeFinalAdminBox')){const box=document.createElement('div');box.id='sareeFinalAdminBox';box.className='card';box.innerHTML=`<h2>⚙️ ميزات سعرلي سوريا</h2><p class="muted">إيقاف الميزة يخفيها من واجهة المستخدم ولا يحذف البيانات.</p><label class="rememberRow"><input id="sareeWaEnabled" type="checkbox"> تفعيل «إرسال الطلب عبر واتساب»</label><label>رسم الطلب بالليرة السورية<input id="sareeWaFee" type="number" min="0" step="1"></label><div class="actions"><button class="btn primary" id="sareeSaveSettings">حفظ إعدادات طلبات واتساب</button></div><hr style="border-color:#263137;margin:18px 0"><h3>صلاحيات الشركات</h3><p class="muted">لا تُمنح صلاحيات صور المنتجات أو أسئلة المنتجات للشركة إلا من هنا.</p><div id="sareeCompanyPerms"></div>`;panel.prepend(box)}
    $('sareeWaEnabled').checked=settings.enabled;$('sareeWaFee').value=settings.fee;
    $('sareeSaveSettings').onclick=async()=>{try{const fee=Math.max(0,Number($('sareeWaFee').value||0));await saveSetting('whatsapp_orders_enabled',$('sareeWaEnabled').checked?'true':'false');await saveSetting('whatsapp_order_fee',fee);settings.enabled=$('sareeWaEnabled').checked;settings.fee=fee;window.sareeWhatsappOrdersEnabled=settings.enabled;window.sareeWhatsappOrderFee=fee;alert('تم حفظ إعدادات طلبات واتساب.');}catch(e){alert(e.message)}};
    try{const {data,error}=await supabaseClient.from('companies').select('id,name,allow_product_images,allow_product_questions').order('name');if(error)throw error;$('sareeCompanyPerms').innerHTML=(data||[]).map(c=>`<div class="priceRow"><b>${esc(c.name)}</b><label class="rememberRow"><input type="checkbox" data-ci="${esc(c.id)}" data-k="img" ${c.allow_product_images?'checked':''}> السماح للشركة بإضافة صور للمنتجات</label><label class="rememberRow"><input type="checkbox" data-ci="${esc(c.id)}" data-k="q" ${c.allow_product_questions?'checked':''}> السماح للشركة بميزة أسئلة/ملاحظات المنتجات</label></div>`).join('')||'<div class="muted">لا توجد شركات.</div>';$('sareeCompanyPerms').querySelectorAll('input[data-ci]').forEach(ch=>ch.onchange=async()=>{const id=ch.dataset.ci;const row={};if(ch.dataset.k==='img')row.allow_product_images=ch.checked;else row.allow_product_questions=ch.checked;const {error}=await supabaseClient.from('companies').update(row).eq('id',id);if(error){ch.checked=!ch.checked;alert(error.message)}})}catch(e){console.warn(e)}
  }
  const oldRenderAdmin=window.renderAdmin;
  if(typeof oldRenderAdmin==='function'){window.renderAdmin=async function(){await oldRenderAdmin();await getSettings();await injectAdmin()}}
  else{setTimeout(async()=>{await getSettings();await injectAdmin()},1500)}
  window.sareeReloadFeatureSettings=getSettings;
})();


/* ================= saree_company_features.js ================= */
/* سعرلي سوريا - ميزات الشركات ولوحة تعريف الشركة */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  async function companyForStore(store){if(!store?.company_id)return null;try{const {data}=await supabaseClient.from('companies').select('*').eq('id',store.company_id).maybeSingle();return data}catch(_){return null}}
  window.sareeCompanyForStore=companyForStore;
  // نضيف بطاقة تعريف الشركة بشكل خفيف داخل صفحة المتجر دون إزعاج المستخدم.
  const old=window.renderStoreDetail;
  window.renderStoreDetail=async function(id){await old(id);const storeId=id||window.currentStoreId;const st=(stores||[]).find(s=>String(s.id)===String(storeId));if(!st||!st.company_id)return;const company=await companyForStore(st);if(!company||company.verified===false||company.active===false)return;const body=$('storeDetailBody');if(!body||$('sareeCompanyPromo'))return;const box=document.createElement('div');box.id='sareeCompanyPromo';box.className='card';box.innerHTML=`<div class="muted">الشركة المنتجة</div><div class="row" style="align-items:center">${company.image_url?`<img src="${esc(company.image_url)}" style="width:54px;height:54px;border-radius:12px;object-fit:cover">`:''}<div><div class="name" style="margin:0">${esc(company.name)}</div><div class="muted">تصفح معلومات الشركة ومنتجاتها.</div></div><button class="btn secondary" style="margin-inline-start:auto" onclick="window.openCompany('${esc(company.name)}')">تصفح الشركة</button></div>`;const first=body.firstElementChild;body.insertBefore(box,first?.nextSibling||null)};
})();


/* ================= saree_notifications.js ================= */
/* سعرلي سوريا - إشعارات الإدارة */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  async function render(){try{if(String(profileData?.role||'').toLowerCase()!=='admin')return;const {data,error}=await supabaseClient.from('saree_notifications').select('*').order('created_at',{ascending:false}).limit(20);if(error)throw error;const unread=(data||[]).filter(x=>!x.is_read).length;let btn=$('sareeNotificationsBtn');const host=$('adminPanel');if(!host)return;if(!btn){btn=document.createElement('button');btn.id='sareeNotificationsBtn';btn.className='btn secondary';btn.type='button';btn.style='margin-bottom:12px;display:block';host.insertBefore(btn,host.firstChild)}else if(btn.parentElement!==host){host.insertBefore(btn,host.firstChild)}btn.textContent=`🔔 الإشعارات${unread?' ('+unread+')':''}`;btn.onclick=()=>{const old=$('sareeNotificationsModal');if(old)old.remove();const m=document.createElement('div');m.id='sareeNotificationsModal';m.className='saree-modal';m.innerHTML=`<div class="saree-modal-inner"><div class="saree-modal-head"><h2>إشعارات الإدارة</h2><button class="btn secondary" onclick="this.closest('.saree-modal').remove()">×</button></div>${(data||[]).map(n=>`<div class="priceRow"><b>${esc(n.title||'إشعار')}</b><div class="muted">${esc(n.body||'')}</div><div class="muted">${new Date(n.created_at).toLocaleString('ar')}</div></div>`).join('')||'<div class="muted">لا توجد إشعارات.</div>'}</div>`;document.body.appendChild(m)};}catch(e){console.warn(e)}}
  const old=window.renderAdmin;if(typeof old==='function')window.renderAdmin=async function(){await old();await render()};setTimeout(render,1800);
})();


/* ================= saree_supporters.js ================= */
/* سعرلي سوريا - أفضل الداعمين */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  async function renderPublic(){const box=$('home');if(!box||$('sareeSupportersPublic'))return;try{const {data,error}=await supabaseClient.from('saree_supporters').select('*').eq('visible',true).order('sort_order').limit(20);if(error)throw error;if(!data?.length)return;const section=document.createElement('div');section.id='sareeSupportersPublic';section.className='card';section.innerHTML=`<h2>⭐ أفضل الداعمين</h2><div class="grid">${data.map(x=>`<div class="card">${x.image_url?`<img class="img" style="height:120px;object-fit:cover" src="${esc(x.image_url)}">`:''}<div class="name">${esc(x.name)}</div><div class="muted">${esc(x.description||'')}</div></div>`).join('')}</div>`;box.appendChild(section)}catch(e){console.warn(e)}}
  async function injectAdmin(){if(String(profileData?.role||'').toLowerCase()!=='admin')return;const panel=$('adminPanel');if(!panel||$('sareeSupportersAdmin'))return;const box=document.createElement('div');box.id='sareeSupportersAdmin';box.className='card';box.innerHTML=`<h2>⭐ إدارة أفضل الداعمين</h2><div class="two"><input id="ssName" placeholder="اسم الداعم"><input id="ssDesc" placeholder="وصف مختصر"><input id="ssImage" type="file" accept="image/*"><input id="ssOrder" type="number" value="0" placeholder="الترتيب"></div><button class="btn primary" id="ssAdd">إضافة</button><div id="ssList" style="margin-top:12px"></div>`;panel.appendChild(box);const load=async()=>{const {data}=await supabaseClient.from('saree_supporters').select('*').order('sort_order');$('ssList').innerHTML=(data||[]).map(x=>`<div class="priceRow"><b>${esc(x.name)}</b><div class="muted">${esc(x.description||'')}</div><button class="btn danger" onclick="window.sareeDeleteSupporter('${esc(x.id)}')">حذف</button></div>`).join('')};$('ssAdd').onclick=async()=>{let image=null;const file=$('ssImage').files?.[0];if(file&&window.uploadImage)image=await window.uploadImage(file,'supporters');const {error}=await supabaseClient.from('saree_supporters').insert({name:$('ssName').value.trim(),description:$('ssDesc').value.trim()||null,image_url:image,sort_order:Number($('ssOrder').value||0),visible:true});if(error)return alert(error.message);await load();$('ssName').value='';$('ssDesc').value='';$('ssImage').value=''};load()}
  window.sareeDeleteSupporter=async id=>{if(!confirm('حذف الداعم؟'))return;const {error}=await supabaseClient.from('saree_supporters').delete().eq('id',id);if(error)return alert(error.message);await injectAdmin()};
  const old=window.renderAdmin;if(typeof old==='function')window.renderAdmin=async function(){await old();await injectAdmin()};setTimeout(()=>{renderPublic();injectAdmin()},2200);
})();


/* ================= saree_whatsapp_links.js ================= */
/* سعرلي سوريا - إصلاح روابط واتساب المتاجر
 * يوضع بعد ملفات الموقع الأساسية.
 * يحوّل رقم الهاتف/الرابط إلى رابط WhatsApp صالح بدل فتح مسار داخل GitHub Pages.
 */
(function(){
  'use strict';
  const DIGITS = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
  function latin(s){ return String(s||'').replace(/[٠-٩۰-۹]/g, c => DIGITS[c] || c); }
  function whatsappUrl(value){
    let v = latin(value).trim();
    if(!v) return '';
    if(/^https?:\/\/(?:wa\.me|api\.whatsapp\.com)\//i.test(v)) return v;
    if(/^whatsapp:\/\//i.test(v)) return v;
    // رابط يحتوي على رقم phone مسبوقًا برمز الدولة
    if(/^https?:\/\//i.test(v)) return v;
    let digits = v.replace(/\D/g,'');
    if(!digits) return '';
    // أرقام سوريا المحلية: 09xxxxxxxx -> 9639xxxxxxxx
    if(digits.startsWith('00963')) digits = digits.slice(2);
    else if(digits.startsWith('09')) digits = '963' + digits.slice(1);
    else if(digits.startsWith('9') && digits.length >= 9 && digits.length <= 10) digits = '963' + digits;
    else if(digits.startsWith('963')) { /* already international */ }
    else if(digits.startsWith('0')) return '';
    return 'https://wa.me/' + digits;
  }
  function fixLinks(root){
    (root || document).querySelectorAll('a').forEach(a=>{
      const text = (a.textContent||'').trim();
      const href = a.getAttribute('href') || '';
      if(!/واتساب|whatsapp/i.test(text + ' ' + href)) return;
      const fixed = whatsappUrl(href);
      if(!fixed) return;
      const digits = fixed.replace(/\D/g,'');
      if(!digits) return;
      const appPhone = digits.startsWith('00963') ? digits.slice(2) : (digits.startsWith('09') ? '963'+digits.slice(1) : digits);
      a.href = 'whatsapp://send?phone=' + appPhone;
      a.removeAttribute('target');
      a.removeAttribute('rel');
    });
  }
  window.sareeWhatsappUrl = whatsappUrl;
  window.sareeFixWhatsappLinks = fixLinks;
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=>fixLinks());
  else fixLinks();
  const observer = new MutationObserver(()=>fixLinks());
  observer.observe(document.documentElement,{subtree:true,childList:true});
})();


/* ================= FINAL CORRECTIONS ================= */
/* التصنيفات + سلة واتساب للجميع + واتساب مباشر + موضع الإشعارات */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const money=v=>Number(v||0).toLocaleString('ar-SY',{maximumFractionDigits:2});
  const getProducts=()=>{try{return products||[]}catch(_){return []}};
  const getPrices=()=>{try{return prices||[]}catch(_){return []}};
  const getStores=()=>{try{return stores||[]}catch(_){return []}};
  const cartsKey='saree_store_carts_v1';
  const carts=()=>{try{return JSON.parse(localStorage.getItem(cartsKey)||'{}')}catch(_){return {}}};
  const cartCount=()=>Object.values(carts()).reduce((n,c)=>n+Object.values(c||{}).reduce((a,x)=>a+Number(x.qty||0),0),0);

  /* 1) التصنيفات: لا نعتمد على renderCategories الداخلي في index.html؛ نربط النقر مباشرة بكل بطاقة. */
  function openCategoryFinal(category){
    const list=getProducts().filter(p=>String(p.category||'عام').trim()===String(category).trim());
    const old=$('sareeCategoryModal'); if(old) old.remove();
    const modal=document.createElement('div');
    modal.id='sareeCategoryModal'; modal.className='saree-modal';
    modal.innerHTML=`<div class="saree-modal-inner">
      <div class="saree-modal-head"><div><h2>منتجات تصنيف: ${esc(category)}</h2><div class="muted">${list.length} منتجات</div></div><button class="btn secondary" id="sareeCloseCatFinal">× إغلاق</button></div>
      <input id="sareeCatSearchFinal" placeholder="ابحث داخل هذا التصنيف...">
      <div id="sareeCatProductsFinal" class="saree-product-grid"></div>
    </div>`;
    document.body.appendChild(modal);
    const render=()=>{
      const q=String($('sareeCatSearchFinal')?.value||'').trim().toLowerCase();
      const rows=list.filter(p=>[p.name,p.brand,p.unit,p.barcode,p.category].join(' ').toLowerCase().includes(q));
      $('sareeCatProductsFinal').innerHTML=rows.length?rows.map(p=>{
        const pr=getPrices().filter(x=>String(x.product_id)===String(p.id)).sort((a,b)=>Number(a.price_new)-Number(b.price_new))[0];
        return `<article class="card saree-medium-card">
          ${p.image_url?`<img class="img" src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`:''}
          <span class="pill">${esc(p.category||'عام')}</span><div class="name">${esc(p.name||'مادة')}</div>
          ${p.brand?`<div class="muted">${esc(p.brand)}</div>`:''}${p.unit?`<div class="muted">${esc(p.unit)}</div>`:''}
          ${pr?`<div class="price">${money(pr.price_new)} ل.س</div><div class="muted">${esc(pr.stores?.name||'')}</div>`:'<div class="notice pending">لا يوجد سعر معتمد حالياً</div>'}
          <div class="actions"><button class="btn primary" onclick="window.sareeOpenProductInfo('${esc(p.id)}')">تفاصيل</button></div>
        </article>`;
      }).join(''):'<div class="card muted">لا توجد منتجات مطابقة.</div>';
    };
    $('sareeCloseCatFinal').onclick=()=>modal.remove();
    modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});
    $('sareeCatSearchFinal').oninput=render; render();
  }
  window.sareeOpenCategory=openCategoryFinal;

  function bindCategoryCards(){
    const box=$('cats'); if(!box) return;
    box.querySelectorAll('.card').forEach(card=>{
      if(card.dataset.sareeCategoryBound==='1') return;
      const pill=card.querySelector('.pill');
      const category=(pill?.textContent||'').trim();
      if(!category) return;
      card.dataset.sareeCategoryBound='1';
      card.style.cursor='pointer';
      card.onclick=(e)=>{e.preventDefault();e.stopPropagation();openCategoryFinal(category)};
    });
  }
  const catObserver=new MutationObserver(()=>bindCategoryCards());
  function startCategoryBinding(){bindCategoryCards();const box=$('cats');if(box)catObserver.observe(box,{childList:true,subtree:true});}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',startCategoryBinding); else startCategoryBinding();
  setTimeout(bindCategoryCards,500);setTimeout(bindCategoryCards,1500);setTimeout(bindCategoryCards,3000);

  /* 2) سلة طلب واتساب: زر/نافذة عامة تعمل للزائر والحساب العادي والتاجر والمدير. */
  function openCartChooser(){
    const all=carts();
    const ids=Object.keys(all).filter(id=>Object.keys(all[id]||{}).length);
    const old=$('sareeUniversalCartModal'); if(old) old.remove();
    const modal=document.createElement('div'); modal.id='sareeUniversalCartModal'; modal.className='saree-modal';
    const stores=getStores();
    modal.innerHTML=`<div class="saree-modal-inner"><div class="saree-modal-head"><div><h2>🛒 سلة طلبات واتساب</h2><div class="muted">السلة متاحة للجميع بدون تسجيل دخول.</div></div><button class="btn secondary" id="sareeCloseUniversalCart">× إغلاق</button></div><div id="sareeUniversalCartBody"></div></div>`;
    document.body.appendChild(modal);
    const body=$('sareeUniversalCartBody');
    if(!ids.length){body.innerHTML='<div class="card muted">السلة فارغة. افتح أي متجر وأضف المنتجات إلى سلة طلب واتساب.</div>'}
    else body.innerHTML=ids.map(id=>{
      const st=stores.find(s=>String(s.id)===String(id));
      const count=Object.values(all[id]).reduce((a,x)=>a+Number(x.qty||0),0);
      return `<div class="priceRow"><b>${esc(st?.name||'المتجر')}</b><div class="muted">${count} قطع</div><button class="btn primary" onclick="window.sareeOpenStoreForCart('${esc(id)}')">فتح سلة المتجر</button></div>`;
    }).join('');
    $('sareeCloseUniversalCart').onclick=()=>modal.remove();
    modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});
  }
  window.sareeOpenUniversalCart=openCartChooser;
  window.sareeOpenStoreForCart=(id)=>{
    $('sareeUniversalCartModal')?.remove();
    if(typeof window.openStore==='function') window.openStore(id);
    else if(typeof openStore==='function') openStore(id);
  };

  function ensureUniversalCartButton(){
    if(!$('sareeUniversalCartButton')){
      const b=document.createElement('button'); b.id='sareeUniversalCartButton'; b.type='button'; b.className='btn primary';
      b.style='position:fixed;bottom:18px;left:18px;z-index:7000;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.3)';
      b.onclick=openCartChooser; document.body.appendChild(b);
    }
    const b=$('sareeUniversalCartButton');
    b.textContent=`🛒 سلة الطلبات${cartCount()?` (${cartCount()})`:''}`;
    let enabled=true; try{enabled=window.sareeWhatsappOrdersEnabled!==false}catch(_){ }
    b.style.display=enabled?'inline-flex':'none';
  }
  setInterval(ensureUniversalCartButton,1200); ensureUniversalCartButton();

  /* زر السلة الرئيسي في الموقع يفتح سلة طلب واتساب للجميع عند تفعيل الميزة. */
  function bindMainBasketButton(){
    document.querySelectorAll('nav button, .nav button').forEach(btn=>{
      if(btn.dataset.sareeWaBasketBound==='1') return;
      if(String(btn.textContent||'').trim()!=='السلة') return;
      btn.dataset.sareeWaBasketBound='1';
      btn.addEventListener('click',function(e){
        if(window.sareeWhatsappOrdersEnabled===true){
          e.preventDefault(); e.stopImmediatePropagation();
          openCartChooser();
        }
      },true);
    });
  }
  bindMainBasketButton();
  setInterval(bindMainBasketButton,1000);

  /* 3) واتساب: محاولة فتح تطبيق WhatsApp مباشرة فقط، بلا wa.me ولا موقع وسيط. */
  function phoneFromTarget(target){
    let v=String(target||'').trim().replace(/[٠-٩۰-۹]/g,c=>({'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'}[c]));
    let m=v.match(/(?:wa\.me\/|phone=)([0-9]+)/i); let phone=m?m[1]:v.replace(/\D/g,'');
    if(phone.startsWith('00963')) phone=phone.slice(2);
    else if(phone.startsWith('09')) phone='963'+phone.slice(1);
    else if(phone.startsWith('9') && phone.length>=9 && phone.length<=10) phone='963'+phone;
    return phone;
  }
  window.sareeDirectWhatsapp=(target,text)=>{
    const phone=phoneFromTarget(target); if(!phone) return false;
    const encoded=encodeURIComponent(text||'');
    const isAndroid=/Android/i.test(navigator.userAgent);
    const isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent);
    const appUrl=`whatsapp://send?phone=${phone}&text=${encoded}`;
    const intent=`intent://send?phone=${phone}&text=${encoded}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
    // Android: intent يطلب تطبيق WhatsApp مباشرة. iOS/باقي الأجهزة: whatsapp://.
    window.location.href=(isAndroid?intent:appUrl);
    return true;
  };
  const originalSend=window.sareeSendWhatsappOrder;
  if(typeof originalSend==='function'){
    // لا نعيد تنفيذ الطلب هنا؛ نستبدل فقط التنقل إلى واتساب بعد التسجيل.
    window.sareeSendWhatsappOrder=async function(storeId){
      if(!window.sareeWhatsappOrdersEnabled)return alert('طلبات واتساب غير مفعلة حالياً.');
      let st; try{st=(getStores()||[]).find(s=>String(s.id)===String(storeId));}catch(_){st=null}
      if(!st){try{const r=await supabaseClient.from('stores').select('*').eq('id',storeId).maybeSingle();st=r.data}catch(_){}}
      if(!st)return alert('المتجر غير موجود.');
      const target=st.whatsapp_url||st.whatsapp||st.companies?.whatsapp_url||''; if(!target)return alert('هذا المتجر لم يضع رقم واتساب للطلبات بعد.');
      // استخدام التنفيذ الأصلي لإنشاء الطلب والحساب، لكن منع تنقله القديم.
      // ننفذ نسخة محلية مطابقة لتجنب أي فتح لموقع خارجي.
      const all=carts(), c=all[storeId]||{}, items=Object.entries(c); if(!items.length)return alert('السلة فارغة.');
      let subtotal=0; const lines=items.map(([pid,x],i)=>{const line=Number(x.qty||0)*Number(x.price||0);subtotal+=line;return `${i+1}) ${x.name}${x.unit?' ('+x.unit+')':''} × ${x.qty} = ${money(line)} ل.س`});
      const name=prompt('اسم العميل (اختياري):','')??''; const phone=prompt('رقم هاتف العميل (اختياري):','')??''; const notes=prompt('ملاحظات الطلب (اختياري):','')??'';
      const fee=Number(window.sareeWhatsappOrderFee||0), total=subtotal+fee;
      const msg=`طلب من سعرلي سوريا\nالمتجر: ${st.name||''}\n\n${lines.join('\n')}\n\nالمجموع الفرعي: ${money(subtotal)} ل.س\nرسم الطلب: ${money(fee)} ل.س\nالإجمالي: ${money(total)} ل.س\n\nاسم العميل: ${name||'—'}\nهاتف العميل: ${phone||'—'}\nملاحظات: ${notes||'—'}`;
      try{
        const {error}=await supabaseClient.rpc('submit_whatsapp_order',{p_store_id:storeId,p_customer_name:name||null,p_customer_phone:phone||null,p_customer_notes:notes||null,p_subtotal:subtotal,p_request_fee:fee,p_total:total,p_items:items.map(([pid,x])=>({product_id:pid,name:x.name,unit:x.unit,quantity:x.qty,unit_price:x.price,line_total:Number(x.qty||0)*Number(x.price||0)}))});
        if(error)throw error;
        if(!window.sareeDirectWhatsapp(target,msg))throw new Error('رقم واتساب المتجر غير صالح.');
        localStorage.setItem('saree_store_carts_v1',JSON.stringify({...all,[storeId]:{}}));
      }catch(e){console.error(e);alert('تعذر إرسال الطلب: '+(e.message||'خطأ غير معروف'));}
    };
  }

  /* 4) الإشعارات: تبقى داخل لوحة الإدارة ولا تُضاف قرب زر دخول/خروج الحساب. */
  function moveNotifications(){
    const b=$('sareeNotificationsBtn'); const panel=$('adminPanel');
    if(!b||!panel)return;
    if(b.parentElement!==panel){panel.appendChild(b)}
    b.style.position='static'; b.style.margin='12px 0'; b.style.display='block';
  }
  setInterval(moveNotifications,800); moveNotifications();
})();
