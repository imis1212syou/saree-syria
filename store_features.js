/* سعرلي سوريا — إضافات المتاجر والمواد
   الدفعة 1 من 2
   نسخة نهائية بدون وميض
*/
(function(){
  'use strict';

  function esc(v){
    if(typeof window.e === 'function'){
      return window.e(v);
    }

    return String(v ?? '').replace(
      /[&<>"']/g,
      function(m){
        return {
          '&':'&amp;',
          '<':'&lt;',
          '>':'&gt;',
          '"':'&quot;',
          "'":'&#039;'
        }[m];
      }
    );
  }

  function el(id){
    return document.getElementById(id);
  }

  function canAdd(){
    return !!(
      profileData &&
      (
        profileData.role === 'admin' ||
        (
          profileData.role === 'store' &&
          profileData.store_id &&
          profileData.can_edit_prices
        )
      )
    );
  }

  async function refreshStoresSafe(){
    try{
      const {data,error} =
        await supabaseClient
          .from('stores')
          .select('*')
          .order('name');

      if(error){
        console.warn('stores:',error.message);
        return;
      }

      if(Array.isArray(data)){
        stores=data;
      }
    }catch(err){
      console.warn('stores refresh:',err);
    }
  }

  window.renderStores=async function(){
    const box=el('storesList');
    if(!box)return;

    await refreshStoresSafe();

    if(!stores.length){
      box.innerHTML=
        '<div class="card">'+
        '<p class="muted">لا توجد متاجر مضافة حالياً.</p>'+
        '</div>';
      return;
    }

    box.innerHTML=stores.map(function(st){

      const verified=st.verified
        ? '<span class="pill">✓ موثّق</span>'
        : '';

      const hours=st.opening_hours
        ? '<div class="muted">🕐 '+esc(st.opening_hours)+'</div>'
        : '';

      const days=st.working_days
        ? '<div class="muted">📅 '+esc(st.working_days)+'</div>'
        : '';

      const phone=st.phone
        ? '<div class="muted">📞 '+esc(st.phone)+'</div>'
        : '';

      const address=st.address
        ? '<div class="muted">📍 '+esc(st.address)+'</div>'
        : '';

      const area=[st.city,st.area]
        .filter(Boolean)
        .join(' — ');

      return `
        <div class="card">

          <div class="row"
               style="justify-content:space-between;align-items:center">

            <h3>${esc(st.name || 'متجر')}</h3>
            ${verified}

          </div>

          ${
            area
            ? `<div class="muted">📍 ${esc(area)}</div>`
            : ''
          }

          ${address}
          ${phone}
          ${hours}
          ${days}

          <button
            class="btn primary"
            onclick="openStore('${st.id}')">
            فتح صفحة المتجر
          </button>

          ${
            profileData?.role === 'admin'
            ? `
              <button
                class="btn secondary"
                onclick="toggleStoreVerification(
                  '${st.id}',
                  ${st.verified ? 'false' : 'true'}
                )">
                ${
                  st.verified
                  ? 'إلغاء توثيق المتجر'
                  : '✓ توثيق المتجر'
                }
              </button>
            `
            : ''
          }

        </div>
      `;

    }).join('');
  };

  window.renderStoreDetail=async function(id){

    const body=el('storeDetailBody');
    const title=el('storeDetailName');

    if(!body || !title)return;

    const storeId=id || window.currentStoreId;

    if(!storeId){
      body.innerHTML=
        '<p class="muted">لم يتم تحديد المتجر.</p>';
      return;
    }

    await refreshStoresSafe();

    const st=stores.find(function(x){
      return String(x.id)===String(storeId);
    });

    if(!st){
      title.textContent='المتجر';

      body.innerHTML=
        '<div class="card">'+
        '<p class="muted">المتجر غير موجود.</p>'+
        '</div>';

      return;
    }

    window.currentStoreId=st.id;
    title.textContent=st.name || 'المتجر';

    try{
      if(typeof recordStoreVisit==='function'){
        await recordStoreVisit(st.id);
      }
    }catch(_){}

    const area=[st.city,st.area]
      .filter(Boolean)
      .join(' — ');

    let html=`
      <div class="card">

        <div class="row"
             style="justify-content:space-between;align-items:center">

          <h2>${esc(st.name || 'المتجر')}</h2>

          ${
            st.verified
            ? '<span class="pill">✓ موثّق</span>'
            : ''
          }

        </div>

        ${
          area
          ? `<p class="muted">📍 ${esc(area)}</p>`
          : ''
        }

        ${
          st.address
          ? `<p>📍 العنوان: ${esc(st.address)}</p>`
          : ''
        }

        ${
          st.phone
          ? `<p>📞 الهاتف: ${esc(st.phone)}</p>`
          : ''
        }

        ${
          st.opening_hours
          ? `<p>🕐 ساعات الدوام: ${esc(st.opening_hours)}</p>`
          : ''
        }

        ${
          st.working_days
          ? `<p>📅 أيام العمل: ${esc(st.working_days)}</p>`
          : ''
        }

      </div>
    `;

    let ps=[];

    try{
      const {data,error}=await supabaseClient
        .from('price_listings')
        .select('*,products(*)')
        .eq('store_id',st.id)
        .eq('approved',true)
        .order('updated_at',{ascending:false});

      if(!error && Array.isArray(data)){
        ps=data;
      }
    }catch(_){}

    html+=`
      <div class="card">

        <h3>أسعار المتجر</h3>

        ${
          ps.length
          ? `
            <div class="grid">

              ${
                ps.map(function(p){

                  const pr=p.products || {};

                  return `
                    <div class="card">

                      <h3>
                        ${esc(pr.name || 'مادة')}
                      </h3>

                      ${
                        pr.brand
                        ? `<div class="muted">${esc(pr.brand)}</div>`
                        : ''
                      }

                      ${
                        pr.unit
                        ? `<div class="muted">${esc(pr.unit)}</div>`
                        : ''
                      }

                      ${
                        pr.barcode
                        ? `<div class="muted">
                            الباركود: ${esc(pr.barcode)}
                           </div>`
                        : ''
                      }

                      <div class="price">
                        ${
                          typeof window.f==='function'
                          ? window.f(
                              p.price ??
                              p.price_new ??
                              0
                            )
                          : (
                              p.price ??
                              p.price_new ??
                              0
                            )
                        }
                        ل.س
                      </div>

                      <div class="muted">
                        آخر تحديث:
                        ${esc(p.updated_at || '')}
                      </div>

                    </div>
                  `;

                }).join('')
              }

            </div>
          `
          : `
            <p class="muted">
              لا توجد أسعار منشورة لهذا المتجر حالياً.
            </p>
          `
        }

      </div>
    `;

    /*
      مهم:
      الباركود يُدمج داخل نفس عملية الرسم.
      لذلك لن يظهر ثم يختفي بسبب إعادة رسم منفصلة.
    */
    if(typeof window.storeBarcodeHtml==='function'){
      html+=window.storeBarcodeHtml(st.id);
    }

    body.innerHTML=html;
  };

  window.toggleStoreVerification=async function(storeId,value){

    if(
      !profileData ||
      profileData.role!=='admin'
    ){
      alert('هذه العملية للمدير فقط.');
      return;
    }


    try{

      const {error}=await supabaseClient
        .from('stores')
        .update({
          verified:
            value===true ||
            value==='true'
        })
        .eq('id',storeId);

      if(error){
        alert(
          'تعذر تحديث التوثيق: '+
          error.message
        );
        return;
      }

      await refreshStoresSafe();

      if(typeof window.renderStores==='function'){
        await window.renderStores();
      }

    }catch(err){

      alert(
        'حدث خطأ: '+
        err.message
      );

    }
  };

  window.showAdd=function(){

    if(!profileData){
      alert('سجّل الدخول أولاً.');
      show('login');
      return;
    }

    if(profileData.role==='admin'){

      show('add');

      const box=el('merchantStoreBox');

      if(box){

        const opts=stores.map(function(s){
          return `
            <option value="${s.id}">
              ${esc(s.name)}
            </option>
          `;
        }).join('');

        box.innerHTML=`
          <label class="muted">
            المتجر للسعر
          </label>

          <select id="adminAddStore">
            <option value="">
              اختر المتجر
            </option>
            ${opts}
          </select>
        `;
      }

      return;
    }

    if(profileData.role!=='store'){
      alert(
        'إضافة المواد متاحة للتاجر المربوط بمتجر والمصرح له، وللمدير.'
      );
      return;
    }

    if(!profileData.can_edit_prices){
      alert('حسابك غير مصرح له حالياً.');
      return;
    }

    if(!profileData.store_id){
      alert(
        'حسابك غير مربوط بمتجر حتى الآن.'
      );
      return;
    }

    show('add');
  };

  function injectHomeButton(){

    const home=el('home');

    if(!home || !canAdd()){
      return;
    }

    if(
      el('storeFeaturesAddBtn')
    ){
      return;
    }

    const btn=document.createElement('button');

    btn.id='storeFeaturesAddBtn';
    btn.className='btn primary';
    btn.textContent='إضافة مادة جديدة';
    btn.onclick=window.showAdd;

    home.appendChild(btn);
  }

  window.addEventListener(
    'load',
    function(){

      setTimeout(
        function(){

          injectHomeButton();

          if(
            el('stores')?.classList
              .contains('active')
          ){
            window.renderStores();
          }

        },
        700
      );

    }
  );

})();
/* سعرلي سوريا — الدفعة 2 من 2
   إضافة/تعديل مواد وأسعار التاجر مباشرة
   + باركود المتجر
*/
(function(){
  'use strict';

  window.submitPrice = async function(){

    const selected =
      document.getElementById('existingProduct')?.value || '';

    const name =
      document.getElementById('pn')?.value.trim() || '';

    const brand =
      document.getElementById('brand')?.value.trim() || '';

    const unit =
      document.getElementById('unit')?.value.trim() || '';

    const category =
      document.getElementById('cat')?.value.trim() || 'عام';

    const barcode =
      document.getElementById('barcode')?.value
        .replace(/\D/g,'')
        .trim() || '';

    const priceRaw =
      document.getElementById('pr')?.value;

    const price =
      priceRaw === ''
      ? null
      : Number(priceRaw);
const file =

   document.getElementById('pimg')?.files?.[0] || null;

    if(!selected && !name){
      alert('اكتب اسم المادة الجديدة.');
      return;
    }

    if(
      price === null ||
      Number.isNaN(price) ||
      price < 0
    ){
      alert('اكتب السعر بشكل صحيح.');
      return;
    }

    if(!profileData){
      alert('سجّل الدخول أولاً.');
      return;
    }

    /*
      =========================
      المدير
      =========================
    */

    if(profileData.role === 'admin'){

      let imageUrl=null;

      try{

        if(
          file &&
          typeof window.uploadImage === 'function'
        ){
          imageUrl=
            await window.uploadImage(
              file,
              'materials'
            );
        }

      }catch(err){

        alert(
          'فشل رفع الصورة: '+
          err.message
        );

        return;
      }

      /*
        مادة موجودة
      */

      if(selected){

        const storeId=
          document.getElementById(
            'adminAddStore'
          )?.value || '';

        if(!storeId){
          alert('اختر المتجر للسعر.');
          return;
        }

        const {error}=await supabaseClient
          .from('price_listings')
          .upsert({
            product_id:selected,
            store_id:storeId,
            price_new:price,
            approved:true,
             
            submitted_by:profileData.id,
            approved_by:profileData.id,
            updated_at:new Date().toISOString()
          },{
            onConflict:'product_id,store_id'
          });

        if(error){
          alert(error.message);
          return;
        }

        alert(
          'تم إضافة السعر ونشره مباشرة.'
        );

      }else{

        /*
          مادة جديدة للمدير
        */

        const {data,error}=
          await supabaseClient
            .from('products')
            .insert({
              name:name,
              brand:brand || null,
              description:null,
              category:category,
              unit:unit || null,
              barcode:barcode || null,
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

        const storeId=
          document.getElementById(
            'adminAddStore'
          )?.value || '';

        if(storeId){

          const {error:e2}=
            await supabaseClient
              .from('price_listings')
              .insert({
                product_id:data.id,
                store_id:storeId,
                price_new:price,
                approved:true,
                 
                submitted_by:profileData.id,
                approved_by:profileData.id,
                updated_at:new Date().toISOString()
              });

          if(e2){
            alert(e2.message);
            return;
          }
        }

        alert(
          storeId
          ? 'تمت إضافة المادة والسعر ونشرهما مباشرة.'
          : 'تمت إضافة المادة ونشرها مباشرة.'
        );
      }

      [
        'pn',
        'brand',
        'unit',
        'cat',
        'barcode',
        'pr'
      ].forEach(function(id){

        const x=
          document.getElementById(id);

        if(x){
          x.value='';
        }

      });

      const imageInput=
        document.getElementById('pimg');

      if(imageInput){
        imageInput.value='';
      }

      const existingProduct=
        document.getElementById(
          'existingProduct'
        );

      if(existingProduct){
        existingProduct.value='';
      }

      if(typeof window.refreshAll==='function'){
        await window.refreshAll();
      }

      if(typeof window.show==='function'){
        window.show('home');
      }

      return;
    }

    /*
      =========================
      التاجر
      =========================
    */

    if(
      profileData.role !== 'store' ||
      !profileData.store_id ||
      !profileData.can_edit_prices
    ){
      alert(
        'حسابك غير مخول لإدارة مواد وأسعار المتجر.'
      );
      return;
    }

    const storeId=profileData.store_id;

    let imageUrl=null;

    try{

      if(
        file &&
        typeof window.uploadImage==='function'
      ){
        imageUrl=
          await window.uploadImage(
            file,
            'materials'
          );
      }

    }catch(err){

      alert(
        'فشل رفع الصورة: '+
        err.message
      );

      return;
    }

    /*
      إذا اختار مادة موجودة:
      نعدّل معلوماتها ونضيف/نحدّث سعر المتجر.
    */

    if(selected){

      const {error:productError}=
        await supabaseClient
          .from('products')
          .update({
            name:name || undefined,
            brand:brand || null,
            unit:unit || null,
            category:category,
            barcode:barcode || null,
            image_url:imageUrl || undefined
          })
          .eq('id',selected);

      if(productError){
        alert(
          'تعذر تعديل المادة: '+
          productError.message
        );
        return;
      }

      const {error:priceError}=
        await supabaseClient
          .from('price_listings')
          .upsert({
            product_id:selected,
            store_id:storeId,
            price_new:price,
            approved:true,
             
            submitted_by:profileData.id,
            updated_at:new Date().toISOString()
          },{
            onConflict:'product_id,store_id'
          });

      if(priceError){
        alert(
          'تعذر حفظ السعر: '+
          priceError.message
        );
        return;
      }

      alert(
        'تم تعديل المادة والسعر مباشرة.'
      );

    }else{

      /*
        مادة جديدة للتاجر
      */

      const {data,error}=
        await supabaseClient
          .from('products')
          .insert({
            name:name,
            brand:brand || null,
            unit:unit || null,
            category:category,
            barcode:barcode || null,
            image_url:imageUrl,
            active:true,
            created_by:profileData.id
          })
          .select()
          .single();

      if(error){
        alert(
          'تعذر إضافة المادة: '+
          error.message
        );
        return;
      }

      const {error:priceError}=
        await supabaseClient
          .from('price_listings')
          .insert({
            product_id:data.id,
            store_id:storeId,
            price_new:price,
            approved:true,
             
            submitted_by:profileData.id,
            updated_at:new Date().toISOString()
          });

      if(priceError){
        alert(
          'تم إنشاء المادة لكن تعذر حفظ السعر: '+
          priceError.message
        );
        return;
      }

      alert(
        'تمت إضافة المادة والسعر ونشرهما مباشرة.'
      );
    }

    [
      'pn',
      'brand',
      'unit',
      'cat',
      'barcode',
      'pr'
    ].forEach(function(id){

      const x=
        document.getElementById(id);

      if(x){
        x.value='';
      }

    });

    const imageInput=
      document.getElementById('pimg');

    if(imageInput){
      imageInput.value='';
    }

    const existingProduct=
      document.getElementById(
        'existingProduct'
      );

    if(existingProduct){
      existingProduct.value='';
    }

    if(typeof window.refreshAll==='function'){
      await window.refreshAll();
    }

    if(typeof window.show==='function'){
      window.show('merchant');
    }

    if(typeof window.renderMerchant==='function'){
      await window.renderMerchant();
    }
  };


  /*
    ========================================
    باركود المتجر
    ========================================
  */

  function escB(v){

    if(typeof window.e==='function'){
      return window.e(v);
    }

    return String(v ?? '').replace(
      /[&<>"']/g,
      function(m){
        return {
          '&':'&amp;',
          '<':'&lt;',
          '>':'&gt;',
          '"':'&quot;',
          "'":'&#039;'
        }[m];
      }
    );
  }


  function canManageStore(storeId){

    return !!(
      profileData &&
      (
        profileData.role==='admin' ||

        (
          profileData.role==='store' &&
          profileData.store_id &&
          profileData.can_edit_prices===true &&
          String(profileData.store_id)===
          String(storeId)
        )
      )
    );
  }


  window.storeBarcodeHtml=function(storeId){

    const internal=
      canManageStore(storeId);

    return `
      <div class="card" id="storeBarcodeCard">

        <h3>📷 باركود المتجر</h3>

        <p class="muted">
          امسح باركود مادة للبحث ضمن مواد هذا المتجر فقط.
        </p>

        <div class="actions">

          <button
            type="button"
            class="btn primary"
            onclick="openStoreBarcode('${escB(storeId)}')">
            📷 مسح بالكاميرا
          </button>

          ${
            internal
            ? `
              <button
                type="button"
                class="btn secondary"
                onclick="generateStoreBarcode('${escB(storeId)}')">
                ⚙️ توليد باركود
              </button>
            `
            : ''
          }

        </div>

        <input
          id="storeBarcodeInput"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="أو أدخل الباركود يدوياً">

        <div class="actions">

          <button
            type="button"
            class="btn secondary"
            onclick="searchStoreBarcode('${escB(storeId)}')">
            🔍 بحث
          </button>

          ${
            internal
            ? `
              <button
                type="button"
                class="btn secondary"
                onclick="downloadStoreBarcode('${escB(storeId)}')">
                ⬇️ تنزيل الباركود
              </button>
            `
            : ''
          }

        </div>

        <div
          id="storeBarcodeResult"
          class="muted">
        </div>

      </div>
    `;
  };


  window.openStoreBarcode=function(storeId){

    window.__activeBarcodeStoreId=
      storeId;

    if(
      typeof window.openBarcodeScannerForStore===
      'function'
    ){

      window.openBarcodeScannerForStore(
        storeId
      );

      return;
    }

    if(
      typeof window.openBarcodeScannerForAdd===
      'function'
    ){

      window.openBarcodeScannerForAdd();
      return;
    }

    alert(
      'ماسح الباركود غير محمّل.'
    );
  };


  window.handleStoreBarcodeScan=function(value){

    const storeId=
      window.__activeBarcodeStoreId ||
      window.currentStoreId;

    const input=
      document.getElementById(
        'storeBarcodeInput'
      );

    const code=
      String(value || '')
        .replace(/\D/g,'');

    if(input){
      input.value=code;
    }

    if(storeId && code){
      window.searchStoreBarcode(
        storeId,
        code
      );
    }
  };


  window.searchStoreBarcode=
    async function(storeId,value){

      const input=
        document.getElementById(
          'storeBarcodeInput'
        );

      const code=
        String(
          value ||
          (input && input.value) ||
          ''
        ).replace(/\D/g,'');

      const out=
        document.getElementById(
          'storeBarcodeResult'
        );

      if(!code){
        alert(
          'أدخل أو امسح الباركود أولاً.'
        );
        return;
      }

      if(input){
        input.value=code;
      }

      if(out){
        out.textContent=
          'جاري البحث...';
      }

      try{

        /*
          أولاً نبحث عن المادة بالباركود.
        */

        const r=
          await supabaseClient
            .from('products')
            .select('*')
            .eq('barcode',code)
            .limit(1)
            .maybeSingle();

        if(r.error){
          throw r.error;
        }

        if(!r.data){

          if(out){
            out.textContent=
              'لا توجد مادة بهذا الباركود.';
          }

          return;
        }

        /*
          بعدها نبحث عن سعرها
          داخل المتجر المحدد فقط.
        */

        const q=
          await supabaseClient
            .from('price_listings')
            .select('*,products(*)')
            .eq('store_id',storeId)
            .eq('product_id',r.data.id)
            .eq('approved',true)
            .limit(1);

        if(q.error){
          throw q.error;
        }

        const p=
          q.data &&
          q.data[0];

        if(!p){

          if(out){

            out.innerHTML=
              '<strong>'+
              escB(
                r.data.name ||
                'مادة'
              )+
              '</strong><br>'+
              'المادة غير مسعّرة في هذا المتجر حالياً.';

          }

          return;
        }

        const price=
          p.price_new ??
          p.price ??
          0;

        if(out){

          out.innerHTML=
            '<strong>'+
            escB(
              r.data.name ||
              'مادة'
            )+
            '</strong>'+

            (
              r.data.brand
              ? '<br>'+escB(r.data.brand)
              : ''
            )+

            (
              r.data.unit
              ? '<br>'+escB(r.data.unit)
              : ''
            )+

            (
              r.data.barcode
              ? '<br>الباركود: '+
                escB(r.data.barcode)
              : ''
            )+

            '<br><span class="price">'+
            (
              typeof window.f==='function'
              ? window.f(price)
              : price
            )+
            ' ل.س</span>';

        }

      }catch(err){

        if(out){
          out.textContent=
            'حدث خطأ: '+
            err.message;
        }

      }
    };


  /*
    توليد رقم باركود جديد.
  */

  window.generateStoreBarcode=
    function(storeId){

      if(!canManageStore(storeId)){
        alert(
          'هذه العملية للمتجر المصرّح فقط.'
        );
        return;
      }

      const input=
        document.getElementById(
          'storeBarcodeInput'
        );

      if(!input)return;

      input.value=
        (
          '200'+
          Date.now()
            .toString()
            .slice(-10)
        ).slice(0,13);

      const out=
        document.getElementById(
          'storeBarcodeResult'
        );

      if(out){

        out.textContent=
          'تم توليد باركود. احفظه مع المادة.';

      }

      /*
        إذا كان حقل المادة موجوداً
        ننسخ الرقم إليه تلقائياً أيضاً.
      */

      const productBarcode=
        document.getElementById(
          'barcode'
        );

      if(productBarcode){
        productBarcode.value=
          input.value;
      }
    };


  /*
    تنزيل صورة الباركود.
  */

  window.downloadStoreBarcode=
    function(storeId){

      if(!canManageStore(storeId)){
        alert(
          'هذه العملية للمتجر المصرّح فقط.'
        );
        return;
      }

      const input=
        document.getElementById(
          'storeBarcodeInput'
        );

      const code=
        String(
          input &&
          input.value ||
          ''
        ).replace(/\D/g,'');

      if(!code){

        alert(
          'أدخل أو ولّد الباركود أولاً.'
        );

        return;
      }

      const canvas=
        document.createElement(
          'canvas'
        );

      const ctx=
        canvas.getContext('2d');

      canvas.width=900;
      canvas.height=300;

      ctx.fillStyle='#fff';
      ctx.fillRect(
        0,
        0,
        900,
        300
      );

      ctx.fillStyle='#000';

      let x=50;

      for(
        let i=0;
        i<code.length;
        i++
      ){

        const d=
          Number(code[i]);

        const w=
          2+(d%4);

        ctx.fillRect(
          x,
          30,
          w,
          190
        );

        x+=
          w+
          2+
          (d%2);
      }

      ctx.font=
        '32px Arial';

      ctx.textAlign=
        'center';

      ctx.fillText(
        code,
        450,
        260
      );

      const a=
        document.createElement('a');

      a.download=
        'barcode-'+
        code+
        '.png';

      a.href=
        canvas.toDataURL(
          'image/png'
        );

      a.click();
    };


  /*
    تنظيف حقول الباركود من أي أحرف.
  */

  document.addEventListener(
    'input',
    function(e){

      if(
        e.target &&
        (
          e.target.id===
          'storeBarcodeInput' ||

          e.target.id===
          'barcode'
        )
      ){

        e.target.value=
          e.target.value.replace(
            /\D/g,
            ''
          );
      }

    }
  );


  /*
    زر إضافة المادة في منطقة الحساب.
    يظهر مرة واحدة فقط.
  */

  function addButton(){

    if(!profileData){
      return;
    }

    const allowed=
      profileData.role==='admin' ||

      (
        profileData.role==='store' &&
        profileData.store_id &&
        profileData.can_edit_prices
      );

    if(!allowed){
      return;
    }

    const box=
      document.getElementById(
        'roleActions'
      );

    if(!box){
      return;
    }

    if(
      box.querySelector(
        '[data-store-feature-add]'
      )
    ){
      return;
    }

    const b=
      document.createElement(
        'button'
      );

    b.className=
      'btn primary';

    b.textContent=
      'إضافة مادة جديدة';

    b.setAttribute(
      'data-store-feature-add',
      '1'
    );

    b.onclick=
      window.showAdd;

    box.appendChild(b);
  }


  /*
    لا يوجد setInterval.
    لا يوجد إعادة رسم مستمرة.
  */

  window.addEventListener(
    'load',
    function(){

      setTimeout(
        function(){

          addButton();

        },
        700
      );

    }
  );

})();


             

