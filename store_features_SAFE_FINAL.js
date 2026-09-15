/* سعرلي سوريا — الإصلاح النهائي الآمن
   يوضع بعد store_features.js و barcode_scanner.js
   لا يستخدم price_listings.status
   يعتمد على price_listings.approved
   - باركود واحد لكل متجر في صفحة المتاجر الخارجية
   - باركود داخل صفحة المتجر
   - باركود داخل لوحة التاجر
   - إضافة/تعديل/حذف مباشر للتاجر المربوط والمصرح
   - اسم المتجر يظهر مع الأسعار
   - بدون setInterval وبدون إعادة رسم متكرر
*/
(function(){
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = v => typeof window.e === 'function'
    ? window.e(v)
    : String(v ?? '').replace(/[&<>"']/g,m=>({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
      }[m]));

  const admin = () => !!window.profileData && profileData.role === 'admin';
  const merchant = () => !!window.profileData && profileData.role === 'store' && !!profileData.store_id && profileData.can_edit_prices === true;
  const allowed = () => admin() || merchant();

  function db(){ return window.supabaseClient; }

  async function getStores(){
    const {data,error}=await db().from('stores').select('*').order('name');
    if(error) throw error;
    window.stores=Array.isArray(data)?data:[];
    return window.stores;
  }

  async function getListings(storeId){
    const {data,error}=await db()
      .from('price_listings')
      .select('id,store_id,product_id,price_new,price,approved,updated_at,products(*)')
      .eq('store_id',storeId)
      .eq('approved',true)
      .order('updated_at',{ascending:false});
    if(error) throw error;
    return data||[];
  }

  function priceText(p){
    const v=p?.price_new ?? p?.price ?? 0;
    return typeof window.f === 'function' ? window.f(v) : String(v);
  }

  function storeUrl(id){
    return window.location.origin + window.location.pathname + '?store=' + encodeURIComponent(id);
  }

  /* =========================
     باركود خارجي لكل متجر
     ========================= */
  function barcodeBox(storeId, compact){
    const id=String(storeId);
    return `
      <div class="card" data-store-barcode-box="${esc(id)}" style="margin-top:10px">
        <h4 style="margin-top:0">باركود متجر ${esc((window.stores||[]).find(s=>String(s.id)===id)?.name||'')}</h4>
        <p class="muted">امسح باركود مادة للبحث عن سعرها في هذا المتجر فقط.</p>
        <div class="actions">
          <button type="button" class="btn secondary" onclick="window.ssfOpenScanner('${esc(id)}')">📷 مسح بالكاميرا</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <input id="ssf_bc_${esc(id)}" inputmode="numeric" autocomplete="off" placeholder="رقم الباركود" style="flex:1;min-width:180px">
          <button type="button" class="btn primary" onclick="window.ssfSearchBarcode('${esc(id)}')">بحث 🔎</button>
        </div>
        <div id="ssf_res_${esc(id)}"></div>
      </div>`;
  }

  async function searchBarcode(storeId, code){
    code=String(code||'').replace(/\D/g,'');
    const res=$('ssf_res_'+storeId);
    if(res) res.innerHTML='<p class="muted">جاري البحث...</p>';
    if(!code){ if(res) res.innerHTML='<p class="muted">أدخل أو امسح الباركود أولاً.</p>'; return; }

    try{
      const {data,error}=await db()
        .from('price_listings')
        .select('id,store_id,product_id,price_new,price,approved,updated_at,products!inner(id,name,brand,unit,barcode,image_url)')
        .eq('store_id',storeId)
        .eq('approved',true)
        .eq('products.barcode',code)
        .limit(1)
        .maybeSingle();
      if(error) throw error;
      if(!data){ if(res) res.innerHTML='<div class="card"><p class="muted">المادة موجودة، لكن لا يوجد لها سعر منشور في هذا المتجر.</p></div>'; return; }
      const p=data.products||{};
      if(res) res.innerHTML=`<div class="card">
        <h3>${esc(p.name||'مادة')}</h3>
        ${p.brand?`<div class="muted">${esc(p.brand)}</div>`:''}
        ${p.unit?`<div class="muted">${esc(p.unit)}</div>`:''}
        <div class="price">${esc(priceText(data))} ل.س</div>
        <div class="muted">الباركود: ${esc(code)}</div>
        <div class="muted">آخر تحديث: ${esc(data.updated_at||'')}</div>
      </div>`;
    }catch(e){
      console.error(e);
      if(res) res.innerHTML='<p class="muted">تعذر البحث عن السعر. تأكد من وجود barcode وأن السعر منشور.</p>';
    }
  }

  window.ssfSearchBarcode=(storeId)=>searchBarcode(storeId,$('ssf_bc_'+storeId)?.value||'');

  /* كاميرا واحدة مشتركة */
  let ssfStream=null, ssfTimer=null, ssfModal=null;
  function closeScanner(){
    if(ssfTimer){clearInterval(ssfTimer);ssfTimer=null;}
    if(ssfStream){ssfStream.getTracks().forEach(t=>t.stop());ssfStream=null;}
    if(ssfModal){ssfModal.remove();ssfModal=null;}
  }

  window.ssfOpenScanner=async function(storeId){
    closeScanner();
    ssfModal=document.createElement('div');
    ssfModal.style.cssText='position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl';
    ssfModal.innerHTML=`<div style="width:min(520px,100%);background:#111;color:#fff;border:1px solid #333;border-radius:20px;padding:14px">
      <div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">مسح باركود المادة</h3><button id="ssf_close" class="btn secondary" type="button">إغلاق</button></div>
      <video id="ssf_video" autoplay playsinline muted style="width:100%;aspect-ratio:4/3;object-fit:cover;background:#000;border-radius:16px;margin-top:12px"></video>
      <p id="ssf_status" class="muted">وجّه الكاميرا نحو الباركود...</p>
      <input id="ssf_manual" inputmode="numeric" autocomplete="off" placeholder="أو اكتب رقم الباركود هنا" style="width:100%;box-sizing:border-box">
      <button id="ssf_use" class="btn primary" type="button" style="width:100%;margin-top:8px">بحث</button>
    </div>`;
    document.body.appendChild(ssfModal);
    $('#ssf_close').onclick=closeScanner;
    $('#ssf_use').onclick=()=>{const c=$('#ssf_manual').value.replace(/\D/g,''); if(c){closeScanner(); const i=$('ssf_bc_'+storeId); if(i)i.value=c; searchBarcode(storeId,c);}};

    if(!navigator.mediaDevices?.getUserMedia){$('#ssf_status').textContent='الكاميرا غير متاحة. استخدم الإدخال اليدوي.';return;}
    try{
      ssfStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
      const video=$('ssf_video'); video.srcObject=ssfStream; await video.play();
      if(!('BarcodeDetector' in window)){$('#ssf_status').textContent='الكاميرا تعمل، لكن المسح التلقائي غير مدعوم. استخدم الإدخال اليدوي.';return;}
      let detector;
      try{detector=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf','codabar']});}catch(_){detector=new BarcodeDetector();}
      ssfTimer=setInterval(async()=>{
        if(!video || video.readyState<2) return;
        try{
          const a=await detector.detect(video);
          if(a?.[0]?.rawValue){
            const c=String(a[0].rawValue).replace(/\D/g,'');
            if(c){closeScanner();const i=$('ssf_bc_'+storeId);if(i)i.value=c;searchBarcode(storeId,c);}
          }
        }catch(_){ }
      },250);
    }catch(e){
      console.error(e);
      $('#ssf_status').textContent='تعذر فتح الكاميرا. اسمح للموقع باستخدام الكاميرا ثم حاول مرة أخرى.';
    }
  };
  window.addEventListener('pagehide',closeScanner);

  /* =========================
     قائمة المتاجر الخارجية
     ========================= */
  window.renderStores=async function(){
    const box=$('storesList'); if(!box)return;
    try{
      await getStores();
      if(!stores.length){box.innerHTML='<div class="card"><p class="muted">لا توجد متاجر مضافة حالياً.</p></div>';return;}
      box.innerHTML=stores.map(st=>`<div class="card" data-store-card="${esc(st.id)}">
        <div class="row" style="justify-content:space-between;align-items:center"><h3>${esc(st.name||'متجر')}</h3>${st.verified?'<span class="pill">✓ موثّق</span>':''}</div>
        ${[st.city,st.area].filter(Boolean).length?`<div class="muted">📍 ${esc([st.city,st.area].filter(Boolean).join(' — '))}</div>`:''}
        ${st.address?`<div class="muted">📍 ${esc(st.address)}</div>`:''}
        ${st.phone?`<div class="muted">📞 ${esc(st.phone)}</div>`:''}
        ${st.opening_hours?`<div class="muted">🕐 ${esc(st.opening_hours)}</div>`:''}
        <div class="actions" style="margin-top:10px">
          <button class="btn primary" type="button" onclick="openStore('${esc(st.id)}')">فتح صفحة المتجر</button>
          <button class="btn secondary" type="button" onclick="window.ssfOpenScanner('${esc(st.id)}')">📷 باركود المتجر</button>
        </div>
        ${barcodeBox(st.id,true)}
      </div>`).join('');
      box.querySelectorAll('input[id^="ssf_bc_"]').forEach(i=>i.addEventListener('input',()=>i.value=i.value.replace(/\D/g,'')));
    }catch(e){console.error(e);box.innerHTML='<div class="card"><p class="muted">تعذر تحميل المتاجر.</p></div>';}
  };

  /* =========================
     صفحة المتجر
     ========================= */
  window.renderStoreDetail=async function(id){
    const body=$('storeDetailBody'), title=$('storeDetailName'); if(!body||!title)return;
    const storeId=id||window.currentStoreId; if(!storeId)return;
    try{
      await getStores();
      const st=stores.find(x=>String(x.id)===String(storeId));
      if(!st){title.textContent='المتجر';body.innerHTML='<div class="card"><p class="muted">المتجر غير موجود.</p></div>';return;}
      window.currentStoreId=st.id; title.textContent=st.name||'المتجر';
      try{if(typeof window.recordStoreVisit==='function')await window.recordStoreVisit(st.id);}catch(_){ }
      const ps=await getListings(st.id);
      const can=allowed()&&(admin()||String(profileData.store_id)===String(st.id));
      body.innerHTML=`
        <div class="card">
          <div class="row" style="justify-content:space-between;align-items:center"><h2>${esc(st.name||'المتجر')}</h2>${st.verified?'<span class="pill">✓ موثّق</span>':''}</div>
          ${[st.city,st.area].filter(Boolean).length?`<p class="muted">📍 ${esc([st.city,st.area].filter(Boolean).join(' — '))}</p>`:''}
          ${st.address?`<p>📍 العنوان: ${esc(st.address)}</p>`:''}
          ${st.phone?`<p>📞 الهاتف: ${esc(st.phone)}</p>`:''}
          ${st.opening_hours?`<p>🕐 ساعات الدوام: ${esc(st.opening_hours)}</p>`:''}
          ${barcodeBox(st.id,false)}
        </div>
        <div class="card"><h3>أسعار ${esc(st.name||'المتجر')}</h3>
          ${ps.length?`<div class="grid">${ps.map(p=>{
            const pr=p.products||{};
            return `<div class="card" data-listing-id="${esc(p.id)}">
              <h3>${esc(pr.name||'مادة')}</h3>
              ${pr.brand?`<div class="muted">${esc(pr.brand)}</div>`:''}
              ${pr.unit?`<div class="muted">${esc(pr.unit)}</div>`:''}
              <div class="muted">المتجر: ${esc(st.name||'')}</div>
              ${pr.barcode?`<div class="muted">الباركود: ${esc(pr.barcode)}</div>`:''}
              <div class="price">${esc(priceText(p))} ل.س</div>
              <div class="muted">آخر تحديث: ${esc(p.updated_at||'')}</div>
              ${can?`<div class="actions" style="margin-top:10px"><button class="btn secondary" type="button" onclick="window.ssfEdit('${esc(p.id)}','${esc(p.product_id)}','${esc(st.id)}')">تعديل المادة والسعر</button><button class="btn secondary" type="button" onclick="window.ssfDelete('${esc(p.id)}','${esc(st.id)}')">حذف المادة من المتجر</button></div>`:''}
            </div>`;
          }).join('')}</div>`:'<p class="muted">لا توجد أسعار منشورة لهذا المتجر حالياً.</p>'}
        </div>`;
      body.querySelectorAll('input[id^="ssf_bc_"]').forEach(i=>i.addEventListener('input',()=>i.value=i.value.replace(/\D/g,'')));
    }catch(e){console.error(e);body.innerHTML='<div class="card"><p class="muted">تعذر تحميل أسعار المتجر: '+esc(e.message)+'</p></div>';}
  };
    /* =========================
     إضافة مباشرة للتاجر والمدير
     ========================= */
  async function savePrice(){
    if(!allowed()){alert('حسابك غير مصرح له.');return;}
    const selected=$('existingProduct')?.value||'';
    const name=$('pn')?.value.trim()||'';
    const brand=$('brand')?.value.trim()||null;
    const unit=$('unit')?.value.trim()||null;
    const category=$('cat')?.value.trim()||'عام';
    const barcode=$('barcode')?.value.trim().replace(/\D/g,'')||null;
    const raw=$('pr')?.value;
    const price=raw===''||raw==null?null:Number(raw);

    if(!selected&&!name){
      alert('اكتب اسم المادة الجديدة.');
      return;
    }

    if(price===null||!Number.isFinite(price)||price<0){
      alert('اكتب السعر بشكل صحيح.');
      return;
    }

    let imageUrl=null;
    const file=$('pimg')?.files?.[0]||null;

    if(file&&typeof window.uploadImage==='function'){
      try{
        imageUrl=await window.uploadImage(file,'materials');
      }catch(e){
        alert('فشل رفع الصورة: '+e.message);
        return;
      }
    }

    let productId=selected;

    if(!productId){
      const {data,error}=await db()
        .from('products')
        .insert({
          name,
          brand,
          unit,
          category,
          barcode,
          image_url:imageUrl,
          active:true,
          created_by:profileData.id
        })
        .select()
        .single();

      if(error){
        alert(error.message);
        return;
      }

      productId=data.id;
    }else{
      const patch={
        name,
        brand,
        unit,
        category,
        barcode
      };

      if(imageUrl)patch.image_url=imageUrl;

      const {error}=await db()
        .from('products')
        .update(patch)
        .eq('id',productId);

      if(error){
        alert(error.message);
        return;
      }
    }

    const storeId=admin()
      ? ($('adminAddStore')?.value||'')
      : profileData.store_id;

    if(!storeId){
      alert('اختر المتجر للسعر.');
      return;
    }

    const {
      data:old,
      error:qe
    }=await db()
      .from('price_listings')
      .select('id')
      .eq('product_id',productId)
      .eq('store_id',storeId)
      .limit(1)
      .maybeSingle();

    if(qe){
      alert(qe.message);
      return;
    }

    const payload={
      product_id:productId,
      store_id:storeId,
      price_new:price,
      approved:true,
      submitted_by:profileData.id,
      approved_by:profileData.id,
      updated_at:new Date().toISOString()
    };

    let pe;

    if(old?.id){
      ({
        error:pe
      }=await db()
        .from('price_listings')
        .update(payload)
        .eq('id',old.id)
        .eq('store_id',storeId));
    }else{
      ({
        error:pe
      }=await db()
        .from('price_listings')
        .insert(payload));
    }

    if(pe){
      alert(pe.message);
      return;
    }

    alert(
      selected
      ? 'تم تعديل المادة والسعر ونشرهما مباشرة.'
      : 'تمت إضافة المادة والسعر ونشرهما مباشرة.'
    );

    [
      'pn',
      'brand',
      'unit',
      'cat',
      'pr',
      'barcode'
    ].forEach(id=>{
      if($(id))$(id).value='';
    });

    if($('pimg'))$('pimg').value='';
    if($('existingProduct'))$('existingProduct').value='';

    if(typeof window.refreshAll==='function'){
      await window.refreshAll();
    }

    if(typeof window.show==='function'){
      window.show('home');
    }
  }

  window.submitPrice=savePrice;


  /* =========================
     تعديل وحذف
     ========================= */

  window.ssfEdit=async function(
    listingId,
    productId,
    storeId
  ){
    if(!allowed()){
      alert('غير مصرح.');
      return;
    }

    if(
      !admin() &&
      String(profileData.store_id)!==
      String(storeId)
    ){
      alert('لا يمكنك تعديل مادة متجر آخر.');
      return;
    }

    const {
      data:p,
      error:pe
    }=await db()
      .from('products')
      .select('*')
      .eq('id',productId)
      .maybeSingle();

    if(pe){
      alert(pe.message);
      return;
    }

    const {
      data:l,
      error:le
    }=await db()
      .from('price_listings')
      .select('price_new,price')
      .eq('id',listingId)
      .eq('store_id',storeId)
      .maybeSingle();

    if(le){
      alert(le.message);
      return;
    }

    const name=prompt(
      'اسم المادة:',
      p?.name||''
    );

    if(name===null)return;

    const brand=prompt(
      'العلامة التجارية:',
      p?.brand||''
    );

    if(brand===null)return;

    const unit=prompt(
      'الوزن / الحجم:',
      p?.unit||''
    );

    if(unit===null)return;

    const category=prompt(
      'التصنيف:',
      p?.category||'عام'
    );

    if(category===null)return;

    const barcode=prompt(
      'الباركود:',
      p?.barcode||''
    );

    if(barcode===null)return;

    const raw=prompt(
      'السعر الجديد:',
      l?.price_new??l?.price??''
    );

    if(raw===null)return;

    const price=Number(raw);

    if(
      !Number.isFinite(price) ||
      price<0
    ){
      alert('السعر غير صحيح.');
      return;
    }

    const {
      error:e1
    }=await db()
      .from('products')
      .update({
        name:name.trim(),
        brand:brand.trim()||null,
        unit:unit.trim()||null,
        category:category.trim()||'عام',
        barcode:barcode.replace(/\D/g,'')||null
      })
      .eq('id',productId);

    if(e1){
      alert(e1.message);
      return;
    }

    const {
      error:e2
    }=await db()
      .from('price_listings')
      .update({
        price_new:price,
        approved:true,
        updated_at:new Date().toISOString()
      })
      .eq('id',listingId)
      .eq('store_id',storeId);

    if(e2){
      alert(e2.message);
      return;
    }

    alert('تم تعديل المادة والسعر مباشرة.');

    await window.renderStoreDetail(storeId);
  };


  window.ssfDelete=async function(
    listingId,
    storeId
  ){
    if(!allowed()){
      alert('غير مصرح.');
      return;
    }

    if(
      !admin() &&
      String(profileData.store_id)!==
      String(storeId)
    ){
      alert('لا يمكنك حذف مادة متجر آخر.');
      return;
    }

    if(
      !confirm(
        'حذف المادة والسعر من هذا المتجر؟'
      )
    ){
      return;
    }

    const {
      error
    }=await db()
      .from('price_listings')
      .delete()
      .eq('id',listingId)
      .eq('store_id',storeId);

    if(error){
      alert(error.message);
      return;
    }

    alert('تم حذف المادة من المتجر.');

    await window.renderStoreDetail(storeId);
  };


  /* =========================
     لوحة التاجر
     مادة + سعر + اسم المتجر
     ========================= */

  async function renderMerchantTools(){
    if(!merchant()&&!admin())return;

    const page=$('merchant');

    if(!page)return;

    let box=$('ssfMerchantTools');

    if(!box){
      box=document.createElement('div');
      box.id='ssfMerchantTools';
      box.className='card';
      page.appendChild(box);
    }

    const storeId=merchant()
      ? profileData.store_id
      : ($('adminMerchantStore')?.value||'');

    if(!storeId){
      box.innerHTML=`
        <h3>إدارة مواد المتجر</h3>
        <p class="muted">
          اربط حساب التاجر بمتجر وفعّل صلاحية
          التعديل من الإدارة.
        </p>
      `;
      return;
    }

    try{
      const st=(await getStores())
        .find(
          s=>String(s.id)===String(storeId)
        );

      const ps=await getListings(storeId);

      box.innerHTML=`
        <h3>
          إدارة مواد ${esc(st?.name||'المتجر')}
        </h3>

        <p class="muted">
          يمكنك إضافة وتعديل وحذف مواد وأسعار
          هذا المتجر مباشرة.
        </p>

        ${
          ps.length
          ? ps.map(p=>{
              const pr=p.products||{};

              return `
                <div
                  class="card"
                  style="margin-top:8px"
                >
                  <h4>
                    ${esc(pr.name||'مادة')}
                  </h4>

                  <div class="muted">
                    المتجر:
                    ${esc(st?.name||'')}
                  </div>

                  <div class="muted">
                    ${esc(pr.unit||'')}
                  </div>

                  ${
                    pr.barcode
                    ? `
                      <div class="muted">
                        الباركود:
                        ${esc(pr.barcode)}
                      </div>
                    `
                    : ''
                  }

                  <div class="price">
                    ${esc(priceText(p))} ل.س
                  </div>

                  <div class="actions">
                    <button
                      class="btn secondary"
                      type="button"
                      onclick="
                        window.ssfEdit(
                          '${esc(p.id)}',
                          '${esc(p.product_id)}',
                          '${esc(storeId)}'
                        )
                      "
                    >
                      تعديل
                    </button>

                    <button
                      class="btn secondary"
                      type="button"
                      onclick="
                        window.ssfDelete(
                          '${esc(p.id)}',
                          '${esc(storeId)}'
                        )
                      "
                    >
                      حذف
                    </button>
                  </div>
                </div>
              `;
            }).join('')
          : `
            <p class="muted">
              لا توجد مواد وأسعار لهذا المتجر بعد.
            </p>
          `
        }

        <div
          class="actions"
          style="margin-top:10px"
        >
          <button
            class="btn primary"
            type="button"
            onclick="window.showAdd()"
          >
            إضافة مادة جديدة
          </button>

          <button
            class="btn secondary"
            type="button"
            onclick="
              window.ssfOpenScanner(
                '${esc(storeId)}'
              )
            "
          >
            📷 مسح باركود
          </button>
        </div>
      `;

    }catch(e){
      box.innerHTML=`
        <p class="muted">
          تعذر تحميل مواد المتجر:
          ${esc(e.message)}
        </p>
      `;
    }
  }


  /* تحميل المواد الموجودة في نموذج الإضافة */

  window.loadExistingProducts=async function(){
    const sel=$('existingProduct');

    if(!sel)return;

    try{
      const {
        data,
        error
      }=await db()
        .from('products')
        .select('*')
        .eq('active',true)
        .order('name');

      if(error)throw error;

      sel.innerHTML=
        '<option value="">إضافة مادة جديدة</option>'+
        (data||[])
          .map(p=>`
            <option value="${esc(p.id)}">
              ${esc(p.name||'مادة')}
            </option>
          `)
          .join('');

      sel.onchange=()=>{
        const p=(data||[])
          .find(
            x=>String(x.id)===String(sel.value)
          );

        if(!p)return;

        if($('pn'))$('pn').value=p.name||'';
        if($('brand'))$('brand').value=p.brand||'';
        if($('unit'))$('unit').value=p.unit||'';
        if($('cat'))$('cat').value=p.category||'';
        if($('barcode'))$('barcode').value=p.barcode||'';
      };

    }catch(e){
      console.warn(
        'load products',
        e.message
      );
    }
  };


  function addBarcodeTools(){
    const box=document.querySelector(
      '#add .barcodeBox'
    );

    if(
      !box ||
      box.querySelector(
        '[data-ssf-barcode-tools]'
      )
    ){
      return;
    }

    const d=document.createElement('div');

    d.className='actions';

    d.setAttribute(
      'data-ssf-barcode-tools',
      '1'
    );

    d.style.marginTop='8px';

    d.innerHTML=`
      <button
        type="button"
        class="btn secondary"
        onclick="window.ssfGenerateBarcode()"
      >
        توليد باركود تلقائي
      </button>
    `;

    box.appendChild(d);

    const i=$('barcode');

    if(
      i &&
      !i.dataset.ssfBound
    ){
      i.dataset.ssfBound='1';

      i.addEventListener(
        'input',
        ()=>{
          i.value=i.value.replace(/\D/g,'');
        }
      );
    }
  }


  window.ssfGenerateBarcode=function(){
    const i=$('barcode');

    if(!i){
      alert('حقل الباركود غير موجود.');
      return;
    }

    let base=
      '200'+
      String(Date.now()).slice(-9);

    base=base.slice(0,12);

    let sum=0;

    for(
      let x=0;
      x<12;
      x++
    ){
      sum+=
        Number(base[x])*
        (x%2?3:1);
    }

    i.value=
      base+
      ((10-(sum%10))%10);

    i.dispatchEvent(
      new Event(
        'input',
        {bubbles:true}
      )
    );
  };


  /* إزالة أي باركود مكرر من الإضافات السابقة */

  function removeOldDuplicateBarcode(){
    document
      .querySelectorAll(
        '[data-store-barcode]'
      )
      .forEach(
        (x,i)=>{
          if(i>0)x.remove();
        }
      );

    document
      .querySelectorAll(
        '#storeBarcodePanelV2,'+
        '#sbv2Modal,'+
        '#storeQRBox'
      )
      .forEach(
        x=>{
          if(
            x &&
            x.id!=='storeQRBox'
          ){
            x.remove();
          }
        }
      );
  }


  /* تشغيل آمن بدون مؤقتات دورية */

  function boot(){
    removeOldDuplicateBarcode();

    addBarcodeTools();

    if(
      window.profileData &&
      (merchant()||admin())
    ){
      window.loadExistingProducts();
    }

    renderMerchantTools();
  }


  const oldShow=window.show;

  if(typeof oldShow==='function'){
    window.show=function(id){

      const r=
        oldShow.apply(
          this,
          arguments
        );

      if(id==='stores'){
        Promise.resolve()
          .then(
            ()=>window.renderStores()
          );
      }

      if(id==='storeDetail'){
        Promise.resolve()
          .then(
            ()=>window.renderStoreDetail(
              window.currentStoreId
            )
          );
      }

      if(id==='merchant'){
        Promise.resolve()
          .then(
            renderMerchantTools
          );
      }

      if(id==='add'){
        Promise.resolve()
          .then(
            ()=>{
              addBarcodeTools();
              window.loadExistingProducts();
            }
          );
      }

      return r;
    };
  }


  window.addEventListener(
    'load',
    boot
  );

  window.addEventListener(
    'pagehide',
    closeScanner
  );

})();
