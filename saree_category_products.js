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
