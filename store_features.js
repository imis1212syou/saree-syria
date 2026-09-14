/* سعرلي سوريا — إضافات المتاجر والمواد
   الدفعة 1 من 2
   نسخة موحدة
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
      const {data,error} = await supabaseClient
        .from('stores')
        .select('*')
        .order('name');

      if(error){
        console.warn('stores:',error.message);
        return;
      }

      if(Array.isArray(data)){
        stores = data;
      }
    }catch(err){
      console.warn('stores refresh:',err);
    }
  }

  window.renderStores = async function(){
    const box = el('storesList');
    if(!box)return;

    await refreshStoresSafe();

    if(!stores.length){
      box.innerHTML =
        '<div class="card">' +
        '<p class="muted">لا توجد متاجر مضافة حالياً.</p>' +
        '</div>';
      return;
    }

    box.innerHTML = stores.map(function(st){
      const verified =
        st.verified
          ? '<span class="pill">✓ موثّق</span>'
          : '';

      const area =
        [st.city,st.area]
          .filter(Boolean)
          .join(' — ');

      const address =
        st.address
          ? '<div class="muted">📍 '+esc(st.address)+'</div>'
          : '';

      const phone =
        st.phone
          ? '<div class="muted">📞 '+esc(st.phone)+'</div>'
          : '';

      const hours =
        st.opening_hours
          ? '<div class="muted">🕐 '+esc(st.opening_hours)+'</div>'
          : '';

      const days =
        st.working_days
          ? '<div class="muted">📅 '+esc(st.working_days)+'</div>'
          : '';

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

  window.renderStoreDetail = async function(id){
    const body = el('storeDetailBody');
    const title = el('storeDetailName');

    if(!body || !title)return;

    const storeId = id || window.currentStoreId;

    if(!storeId){
      body.innerHTML =
        '<p class="muted">لم يتم تحديد المتجر.</p>';
      return;
    }

    await refreshStoresSafe();

    const st = stores.find(function(x){
      return String(x.id) === String(storeId);
    });

    if(!st){
      title.textContent = 'المتجر';
      body.innerHTML =
        '<div class="card">' +
        '<p class="muted">المتجر غير موجود.</p>' +
        '</div>';
      return;
    }

    window.currentStoreId = st.id;
    title.textContent = st.name || 'المتجر';

    try{
      if(typeof recordStoreVisit === 'function'){
        await recordStoreVisit(st.id);
      }
    }catch(_){}

    const area =
      [st.city,st.area]
        .filter(Boolean)
        .join(' — ');

    let html = `
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

    let ps = [];

    try{
      const {data,error} = await supabaseClient
        .from('price_listings')
        .select('*,products(*)')
        .eq('store_id',st.id)
        .eq('status','approved')
        .order('updated_at',{ascending:false});

      if(!error && Array.isArray(data)){
        ps = data;
      }
    }catch(_){}

    html += `
      <div class="card">
        <h3>أسعار المتجر</h3>

        ${
          ps.length
          ? `
            <div class="grid">
              ${
                ps.map(function(p){
                  const pr = p.products || {};

                  return `
                    <div class="card">
                      <h3>${esc(pr.name || 'مادة')}</h3>

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

                      <div class="price">
                        ${
                          typeof window.f === 'function'
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

                      ${
                        canEditStorePrice(p)
                        ? `
                          <div class="actions">
                            <button
                              class="btn secondary"
                              onclick="editStorePrice(
                                '${p.id}'
                              )">
                              ✏️ تعديل السعر
                            </button>

                            <button
                              class="btn secondary"
                              onclick="deleteStorePrice(
                                '${p.id}'
                              )">
                              🗑️ حذف السعر
                            </button>
                          </div>
                        `
                        : ''
                      }
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

    body.innerHTML = html;

    if(
      typeof window.renderStoreBarcodeActions ===
      'function'
    ){
      window.renderStoreBarcodeActions(st.id);
    }
  };

  function canEditStorePrice(p){
    if(!profileData)return false;

    if(profileData.role === 'admin'){
      return true;
    }

    return (
      profileData.role === 'store' &&
      profileData.store_id &&
      profileData.can_edit_prices &&
      String(profileData.store_id) ===
      String(p.store_id)
    );
  }

  window.toggleStoreVerification =
    async function(storeId,value){

      if(
        !profileData ||
        profileData.role !== 'admin'
      ){
        alert('هذه العملية للمدير فقط.');
        return;
      }

      try{
        const {error} = await supabaseClient
          .from('stores')
          .update({
            verified:
              value === true ||
              value === 'true'
          })
          .eq('id',storeId);

        if(error){
          alert(
            'تعذر تحديث التوثيق: ' +
            error.message
          );
          return;
        }

        await refreshStoresSafe();

        if(typeof window.renderStores === 'function'){
          await window.renderStores();
        }

      }catch(err){
        alert(
          'حدث خطأ: ' +
          err.message
        );
      }
    };

  window.showAdd = function(){

    if(!profileData){
      alert('سجّل الدخول أولاً.');
      show('login');
      return;
    }

    if(profileData.role === 'admin'){
      show('add');

      const box = el('merchantStoreBox');

      if(box){
        const opts =
          stores.map(function(s){
            return `
              <option value="${s.id}">
                ${esc(s.name)}
              </option>
            `;
          }).join('');

        box.innerHTML = `
          <label class="muted">
            المتجر للسعر
          </label>

          <select id="adminAddStore">
            <option value="">
              بدون سعر متجر
            </option>
            ${opts}
          </select>
        `;
      }

      return;
    }

    if(profileData.role !== 'store'){
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

    const box = el('merchantStoreBox');

    if(box){
      box.innerHTML = `
        <label class="muted">
          المتجر
        </label>
        <input
          type="text"
          value="${esc(
            stores.find(
              s =>
                String(s.id) ===
                String(profileData.store_id)
            )?.name || ''
          )}"
          disabled>
      `;
    }

    const note =
      document.querySelector('#add .hero .muted');

    if(note){
      note.textContent =
        'يمكنك تعديل مواد وأسعار متجرك مباشرة بدون انتظار موافقة.';
    }
  };

  function injectHomeButton(){
    const home = document.getElementById('home');

    if(!home || !canAdd()){
      return;
    }

    if(
      document.getElementById(
        'storeFeaturesAddBtn'
      )
    ){
      return;
    }

    const btn =
      document.createElement('button');

    btn.id =
      'storeFeaturesAddBtn';

    btn.className =
      'btn primary';

    btn.textContent =
      'إضافة مادة جديدة';

    btn.onclick =
      window.showAdd;

    home.appendChild(btn);
  }

  window.addEventListener(
    'load',
    function(){
      setTimeout(function(){
        injectHomeButton();

        if(
          el('stores')?.classList
            .contains('active')
        ){
          window.renderStores();
        }

      },700);
    }
  );

})();
/* =========================
   الدفعة 2 من 2
   تعديل الأسعار + باركود
   ========================= */

(function(){
  'use strict';

  window.editStorePrice = async function(priceId){

    if(!profileData){
      alert('سجّل الدخول أولاً.');
      return;
    }

    const {data:p,error} = await supabaseClient
      .from('price_listings')
      .select('id,store_id,price_new,price,product_id')
      .eq('id',priceId)
      .single();

    if(error || !p){
      alert('تعذر تحميل السعر.');
      return;
    }

    if(
      profileData.role !== 'admin' &&
      (
        profileData.role !== 'store' ||
        !profileData.can_edit_prices ||
        String(profileData.store_id) !== String(p.store_id)
      )
    ){
      alert('لا تملك صلاحية تعديل هذا السعر.');
      return;
    }

    const oldPrice =
      p.price_new ?? p.price ?? 0;

    const value = prompt(
      'أدخل السعر الجديد:',
      oldPrice
    );

    if(value === null)return;

    const newPrice = Number(value);

    if(!Number.isFinite(newPrice) || newPrice < 0){
      alert('السعر غير صحيح.');
      return;
    }

    const {error:updateError} =
      await supabaseClient
        .from('price_listings')
        .update({
          price_new:newPrice,
          updated_at:new Date().toISOString()
        })
        .eq('id',priceId);

    if(updateError){
      alert(
        'تعذر تعديل السعر: ' +
        updateError.message
      );
      return;
    }

    alert('تم تعديل السعر بنجاح.');

    if(
      typeof window.renderStoreDetail ===
      'function'
    ){
      await window.renderStoreDetail(
        p.store_id
      );
    }
  };


  window.deleteStorePrice = async function(priceId){

    if(!profileData){
      alert('سجّل الدخول أولاً.');
      return;
    }

    const {data:p,error} = await supabaseClient
      .from('price_listings')
      .select('id,store_id')
      .eq('id',priceId)
      .single();

    if(error || !p){
      alert('السعر غير موجود.');
      return;
    }

    if(
      profileData.role !== 'admin' &&
      (
        profileData.role !== 'store' ||
        !profileData.can_edit_prices ||
        String(profileData.store_id) !== String(p.store_id)
      )
    ){
      alert('لا تملك صلاحية حذف هذا السعر.');
      return;
    }

    if(!confirm('هل تريد حذف هذا السعر؟')){
      return;
    }

    const {error:deleteError} =
      await supabaseClient
        .from('price_listings')
        .delete()
        .eq('id',priceId);

    if(deleteError){
      alert(
        'تعذر حذف السعر: ' +
        deleteError.message
      );
      return;
    }

    alert('تم حذف السعر.');

    if(
      typeof window.renderStoreDetail ===
      'function'
    ){
      await window.renderStoreDetail(
        p.store_id
      );
    }
  };


  /* =========================
     الباركود
     ========================= */

  function barcodeBox(){

    if(document.getElementById(
      'barcodeTools'
    )){
      return;
    }

    const input =
      document.getElementById('barcode');

    if(!input)return;

    const box =
      document.createElement('div');

    box.id =
      'barcodeTools';

    box.className =
      'actions';

    box.style.marginTop =
      '8px';

    box.innerHTML = `
      <button
        type="button"
        class="btn secondary"
        id="barcodeCameraBtn">
        📷 مسح بالكاميرا
      </button>

      <button
        type="button"
        class="btn secondary"
        id="barcodeGenerateBtn">
        ⚙️ توليد باركود
      </button>

      <button
        type="button"
        class="btn secondary"
        id="barcodeDownloadBtn">
        ⬇️ تنزيل الباركود
      </button>

      <p
        id="barcodeAutoMsg"
        class="muted">
      </p>
    `;

    input.parentNode.appendChild(box);

    document
      .getElementById('barcodeCameraBtn')
      .onclick =
        function(){

          if(
            typeof window.openBarcodeScannerForAdd ===
            'function'
          ){
            window.openBarcodeScannerForAdd();
          }else{
            alert(
              'ملف الكاميرا غير محمّل.'
            );
          }
        };


    document
      .getElementById('barcodeGenerateBtn')
      .onclick =
        function(){

          const number =
            '200' +
            Date.now()
              .toString()
              .slice(-10);

          input.value =
            number;

          const msg =
            document.getElementById(
              'barcodeAutoMsg'
            );

          if(msg){
            msg.textContent =
              'تم توليد باركود تلقائياً.';
          }
        };


    document
      .getElementById('barcodeDownloadBtn')
      .onclick =
        function(){

          const value =
            input.value.trim();

          if(!value){
            alert(
              'امسح أو أدخل أو ولّد الباركود أولاً.'
            );
            return;
          }

          downloadBarcode(value);
        };
  }


  function downloadBarcode(value){

    const canvas =
      document.createElement('canvas');

    const ctx =
      canvas.getContext('2d');

    const width = 700;
    const height = 260;

    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    ctx.fillStyle = '#000000';

    let x = 40;

    /*
      تمثيل بصري للباركود.
      الرقم نفسه يبقى محفوظاً كما هو.
    */

    for(let i=0;i<value.length;i++){

      const n =
        Number(value[i]);

      const bars =
        2 + (n % 4);

      for(let j=0;j<bars;j++){

        const bw =
          2 + ((n+j) % 3);

        ctx.fillRect(
          x,
          30,
          bw,
          150
        );

        x +=
          bw + 2;
      }

      x += 3;
    }

    ctx.font =
      '28px Arial';

    ctx.textAlign =
      'center';

    ctx.fillText(
      value,
      width / 2,
      225
    );

    const link =
      document.createElement('a');

    link.download =
      'barcode-' +
      value +
      '.png';

    link.href =
      canvas.toDataURL(
        'image/png'
      );

    link.click();
  }


  /* =========================
     تجهيز الباركود عند فتح الصفحة
     ========================= */

  function initBarcodeTools(){

    if(
      document.getElementById('barcode')
    ){
      barcodeBox();
    }
  }


  /*
    لا يوجد setInterval.
    نتحقق مرة واحدة فقط عند التحميل.
  */

  window.addEventListener(
    'load',
    function(){

      setTimeout(
        initBarcodeTools,
        800
      );

    }
  );


  /* =========================
     دعم الباركود اليدوي
     ========================= */

  document.addEventListener(
    'input',
    function(e){

      if(
        e.target &&
        e.target.id === 'barcode'
      ){

        e.target.value =
          e.target.value.replace(
            /\D/g,
            ''
          );
      }

    }
  );


  /* =========================
     تعديل submitPrice
     لتحديث السعر مباشرة
     ========================= */

  const oldSubmit =
    window.submitPrice;

  if(
    typeof oldSubmit === 'function'
  ){

    window.submitPrice =
      async function(){

        /*
          نترك الدالة الأصلية تنفذ
          ونضمن وجود الباركود في الحقل.
        */

        return await oldSubmit.apply(
          this,
          arguments
        );
      };
  }


  /*
    عند اختيار مادة موجودة،
    نعرض الباركود المخزن إن وجد.
  */

  window.fillProductBarcode =
    function(product){

      const input =
        document.getElementById(
          'barcode'
        );

      if(
        input &&
        product
      ){

        input.value =
          product.barcode ||
          '';
      }
    };


  /*
    ربط فتح المتجر بالباركود.
  */

  window.openStoreBarcode =
    function(storeId){

      window.currentStoreId =
        storeId;

      if(
        typeof window.openBarcodeScannerForStore ===
        'function'
      ){

        window.openBarcodeScannerForStore(
          storeId
        );

      }else{

        alert(
          'ماسح الباركود غير محمّل.'
        );
      }
    };


  /*
    منع تكرار الأدوات.
  */

  window.addEventListener(
    'DOMContentLoaded',
    function(){

      initBarcodeTools();

    }
  );

})();
