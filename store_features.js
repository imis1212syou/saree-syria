/* سعرلي سوريا — store_features.js
   نسخة موحدة
   - متجر واحد فقط للباركود
   - كاميرا + إدخال يدوي
   - بدون توليد أو تنزيل باركود
   - مسافة مستقلة لكل متجر
   - Google Maps للاتجاهات
   - تعديل مباشر لمواد التاجر
   - بدون وميض أو بطاقات مكررة
*/

(function(){
  'use strict';

  function esc(v){
    if(typeof window.e === 'function') return window.e(v);

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

  function isAdmin(){
    return !!(
      window.profileData &&
      profileData.role === 'admin'
    );
  }

  function canManageStore(storeId){
    return !!(
      profileData &&
      (
        profileData.role === 'admin' ||
        (
          profileData.role === 'store' &&
          profileData.store_id &&
          profileData.can_edit_prices === true &&
          String(profileData.store_id) === String(storeId)
        )
      )
    );
  }

  /* =========================
     الموقع والمسافة
     ========================= */

  let userLat = null;
  let userLng = null;

  function distanceKm(lat1,lon1,lat2,lon2){

    const R = 6371;

    const dLat =
      (lat2-lat1) * Math.PI / 180;

    const dLon =
      (lon2-lon1) * Math.PI / 180;

    const a =
      Math.sin(dLat/2) *
      Math.sin(dLat/2) +
      Math.cos(lat1*Math.PI/180) *
      Math.cos(lat2*Math.PI/180) *
      Math.sin(dLon/2) *
      Math.sin(dLon/2);

    return R *
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1-a)
      );
  }

  function formatDistance(km){

    if(km === null || Number.isNaN(km)){
      return '';
    }

    if(km < 1){
      return Math.round(km * 1000) + ' م';
    }

    return km.toFixed(1) + ' كم';
  }

  function getUserLocation(){

    if(!navigator.geolocation){
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function(pos){

        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;

        if(
          typeof window.renderStores === 'function' &&
          el('stores')?.classList.contains('active')
        ){
          window.renderStores();
        }

      },
      function(){
        /*
          الموقع اختياري.
          المتجر يبقى ظاهرًا حتى لو رفض المستخدم.
        */
      },
      {
        enableHighAccuracy:true,
        timeout:10000,
        maximumAge:300000
      }
    );
  }

  function directionsUrl(st){

    if(
      st.latitude == null ||
      st.longitude == null
    ){
      return '';
    }

    return (
      'https://www.google.com/maps/dir/?api=1' +
      '&destination=' +
      encodeURIComponent(
        st.latitude + ',' + st.longitude
      )
    );
  }

  function storeDistance(st){

    if(
      userLat === null ||
      userLng === null ||
      st.latitude == null ||
      st.longitude == null
    ){
      return null;
    }

    return distanceKm(
      userLat,
      userLng,
      Number(st.latitude),
      Number(st.longitude)
    );
  }

  /* =========================
     المتاجر
     ========================= */

  async function refreshStores(){

    try{

      const {data,error} =
        await supabaseClient
          .from('stores')
          .select('*')
          .order('name');

      if(error){
        console.warn(error.message);
        return;
      }

      if(Array.isArray(data)){
        stores = data;
      }

    }catch(err){
      console.warn(err);
    }
  }

  window.renderStores = async function(){

    const box = el('storesList');

    if(!box) return;

    await refreshStores();

    if(!stores.length){

      box.innerHTML =
        '<div class="card">' +
        '<p class="muted">لا توجد متاجر مضافة حالياً.</p>' +
        '</div>';

      return;
    }

    let list = stores.slice();

    /*
      إذا كان موقع الزائر ومواقع المتاجر متوفرين:
      الأقرب أولاً.
    */

    list.sort(function(a,b){

      const da = storeDistance(a);
      const db = storeDistance(b);

      if(da === null && db === null) return 0;
      if(da === null) return 1;
      if(db === null) return -1;

      return da-db;
    });

    box.innerHTML = list.map(function(st){

      const verified =
        st.verified
        ? '<span class="pill">✓ موثّق</span>'
        : '';

      const area =
        [st.city,st.area]
          .filter(Boolean)
          .join(' — ');

      const distance =
        formatDistance(
          storeDistance(st)
        );

      const maps =
        directionsUrl(st);

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

          ${
            st.address
            ? `<div class="muted">📍 ${esc(st.address)}</div>`
            : ''
          }

          ${
            st.phone
            ? `<div class="muted">📞 ${esc(st.phone)}</div>`
            : ''
          }

          ${
            st.opening_hours
            ? `<div class="muted">🕐 ${esc(st.opening_hours)}</div>`
            : ''
          }

          ${
            distance
            ? `
              <div class="pill"
                   style="display:inline-block;margin-top:8px">
                📏 ${esc(distance)}
              </div>
            `
            : ''
          }

          <div class="actions">

            <button
              class="btn primary"
              onclick="openStore('${esc(st.id)}')">
              فتح صفحة المتجر
            </button>

            ${
              maps
              ? `
                <button
                  class="btn secondary"
                  onclick="window.open('${esc(maps)}','_blank')">
                  🗺️ الاتجاهات
                </button>
              `
              : ''
            }

          </div>

          ${
            isAdmin()
            ? `
              <button
                class="btn secondary"
                onclick="toggleStoreVerification(
                  '${esc(st.id)}',
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

  /* =========================
     صفحة المتجر
     ========================= */

  window.renderStoreDetail = async function(id){

    const body = el('storeDetailBody');
    const title = el('storeDetailName');

    if(!body || !title) return;

    const storeId =
      id || window.currentStoreId;

    if(!storeId){

      body.innerHTML =
        '<p class="muted">لم يتم تحديد المتجر.</p>';

      return;
    }

    await refreshStores();

    const st =
      stores.find(function(x){
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

    title.textContent =
      st.name || 'المتجر';

    try{

      if(typeof recordStoreVisit === 'function'){
        await recordStoreVisit(st.id);
      }

    }catch(_){}

    const area =
      [st.city,st.area]
        .filter(Boolean)
        .join(' — ');

    const distance =
      formatDistance(
        storeDistance(st)
      );

    const maps =
      directionsUrl(st);

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
          distance
          ? `<p class="pill">📏 يبعد ${esc(distance)}</p>`
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

        ${
          maps
          ? `
            <button
              class="btn primary"
              onclick="window.open('${esc(maps)}','_blank')">
              🗺️ فتح الاتجاهات في Google Maps
            </button>
          `
          : ''
        }

      </div>

    `;

    /* =========================
       باركود واحد فقط
       ========================= */

    html += window.storeBarcodeHtml(st.id);

    /* =========================
       الأسعار
       ========================= */

    let ps = [];

    try{

      const {data,error} =
        await supabaseClient
          .from('price_listings')
          .select('*,products(*)')
          .eq('store_id',st.id)
          .eq('approved',true)
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

                  const pr =
                    p.products || {};

                  const price =
                    p.price_new ??
                    p.price ??
                    0;

                  return `

                    <div class="card">

                      ${
                        pr.image_url
                        ? `
                          <img
                            src="${esc(pr.image_url)}"
                            style="
                              width:100%;
                              max-height:180px;
                              object-fit:contain;
                              border-radius:14px;
                            "
                          >
                        `
                        : ''
                      }

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
                        ? `
                          <div class="muted">
                            الباركود: ${esc(pr.barcode)}
                          </div>
                        `
                        : ''
                      }

                      <div class="price">

  ...
  ل.س
</div>

<div class="muted">
  آخر تحديث:
  ${esc(p.updated_at || '')}
</div>

${
  canManageStore(st.id)
  ? `
    <button
      type="button"
      class="btn secondary"
      style="margin-top:12px"
      onclick="editStoreMaterial(
        '${esc(p.id)}',
        '${esc(pr.id)}',
        '${esc(st.id)}',
        '${esc(pr.name || '')}',
        '${esc(pr.brand || '')}',
        '${esc(pr.unit || '')}',
        '${esc(pr.category || '')}',
        '${esc(pr.barcode || '')}',
        '${esc(price)}'
      )">
      ✏️ تعديل المادة
    </button>
  `
  : ''
}
                        ${
                          typeof window.f === 'function'
                          ? window.f(price)
                          : price
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

    body.innerHTML = html;
  };

  /* =========================
     باركود المتجر
     ========================= */

  window.storeBarcodeHtml =
    function(storeId){

      return `

        <div class="card store-barcode-card">

          <h3>📷 باركود المتجر</h3>

          <p class="muted">
            امسح باركود المادة للبحث ضمن مواد هذا المتجر فقط.
          </p>

          <button
            type="button"
            class="btn primary"
            onclick="openStoreBarcode('${esc(storeId)}')">
            📷 مسح بالكاميرا
          </button>

          <input
            id="storeBarcodeInput"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            placeholder="أو أدخل الباركود يدوياً">

          <button
            type="button"
            class="btn secondary"
            onclick="searchStoreBarcode('${esc(storeId)}')">
            🔍 بحث
          </button>

          <div
            id="storeBarcodeResult"
            class="muted"
            style="margin-top:12px">
          </div>

        </div>

      `;
    };

  window.openStoreBarcode =
    function(storeId){

      window.__activeBarcodeStoreId =
        storeId;

      if(
        typeof window.openBarcodeScannerForStore ===
        'function'
      ){

        window.openBarcodeScannerForStore(
          storeId
        );

        return;
      }

      if(
        typeof window.openBarcodeScannerForAdd ===
        'function'
      ){

        window.openBarcodeScannerForAdd();

        return;
      }

      alert('ماسح الباركود غير محمّل.');
    };

  window.handleStoreBarcodeScan =
    function(value){

      const storeId =
        window.__activeBarcodeStoreId ||
        window.currentStoreId;

      const code =
        String(value || '')
          .replace(/\D/g,'');

      const input =
        el('storeBarcodeInput');

      if(input){
        input.value = code;
      }

      if(storeId && code){

        window.searchStoreBarcode(
          storeId,
          code
        );

      }
    };

  window.searchStoreBarcode =
    async function(storeId,value){

      const input =
        el('storeBarcodeInput');

      const out =
        el('storeBarcodeResult');

      const code =
        String(
          value ||
          (input && input.value) ||
          ''
        ).replace(/\D/g,'');

      if(!code){

        alert(
          'أدخل أو امسح الباركود أولاً.'
        );

        return;
      }

      if(input){
        input.value = code;
      }

      if(out){
        out.textContent = 'جاري البحث...';
      }

      try{

        const r =
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
            out.textContent =
              'لا توجد مادة بهذا الباركود.';
          }

          return;
        }

        const q =
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

        const p =
          q.data &&
          q.data[0];

        if(!p){

          if(out){

            out.innerHTML =
              '<strong>' +
              esc(r.data.name || 'مادة') +
              '</strong><br>' +
              'المادة غير مسعّرة في هذا المتجر حالياً.';

          }

          return;
        }

        const price =
          p.price_new ??
          p.price ??
          0;

        if(out){

          out.innerHTML =

            '<strong>' +
            esc(r.data.name || 'مادة') +
            '</strong>' +

            (
              r.data.brand
              ? '<br>' + esc(r.data.brand)
              : ''
            ) +

            (
              r.data.unit
              ? '<br>' + esc(r.data.unit)
              : ''
            ) +

            '<br><span class="price">' +

            (
              typeof window.f === 'function'
              ? window.f(price)
              : price
            ) +

            ' ل.س</span>';

        }

      }catch(err){

        if(out){

          out.textContent =
            'حدث خطأ: ' +
            err.message;

        }

      }
    };

  /* =========================
     تعديل التوثيق
     ========================= */

  window.toggleStoreVerification =
    async function(storeId,value){

      if(!isAdmin()){

        alert(
          'هذه العملية للمدير فقط.'
        );

        return;
      }

      try{

         const {error} =
          await supabaseClient
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

        await refreshStores();

        await window.renderStores();

      }catch(err){

        alert(
          'حدث خطأ: ' +
          err.message
        );

      }
    };

  /* =========================
     إضافة مادة
     ========================= */

  window.showAdd =
    function(){

      if(!profileData){

        alert(
          'سجّل الدخول أولاً.'
        );

        show('login');

        return;
      }

      if(profileData.role === 'admin'){

        show('add');

        const box =
          el('merchantStoreBox');

        if(box){

          box.innerHTML = `

            <label class="muted">
              المتجر للسعر
            </label>

            <select id="adminAddStore">

              <option value="">
                اختر المتجر
              </option>

              ${
                stores.map(function(s){

                  return `
                    <option value="${esc(s.id)}">
                      ${esc(s.name)}
                    </option>
                  `;

                }).join('')
              }

            </select>

          `;

        }

        return;
      }

      if(
        profileData.role !== 'store'
      ){

        alert(
          'إضافة المواد متاحة للتاجر المصرح له وللمدير.'
        );

        return;
      }

      if(
        !profileData.store_id ||
        !profileData.can_edit_prices
      ){

        alert(
          'حسابك غير مصرح له حالياً.'
        );

        return;
      }

      show('add');
    };

  /* =========================
     زر إضافة واحد فقط
     ========================= */

  function addButton(){

    if(!profileData) return;

    const allowed =
      profileData.role === 'admin' ||
      (
        profileData.role === 'store' &&
        profileData.store_id &&
        profileData.can_edit_prices
      );

    if(!allowed) return;

    const box =
      el('roleActions');

    if(!box) return;

    if(
      box.querySelector(
        '[data-store-feature-add]'
      )
    ){

      return;
    }

    const b =
      document.createElement('button');

    b.className =
      'btn primary';

    b.textContent =
      'إضافة مادة جديدة';

    









b.setAttribute(
      'data-store-feature-add',
      '1'
    );

    b.onclick =
      window.showAdd;

    box.appendChild(b);
  }

  /* =========================
     تنظيف الباركود
     ========================= */

  document.addEventListener(
    'input',
    function(event){

      if(
        event.target &&
        (
          event.target.id ===
          'barcode' ||

          event.target.id ===
          'storeBarcodeInput'
        )
      ){

        event.target.value =
          event.target.value.replace(
            /\D/g,
            ''
          );

      }

    }
  );
  /* =========================
     تعديل المادة مباشرة
     ========================= */

 window.editStoreMaterial = async function(
  listingId,
  productId,
  storeId,
  name,
  brand,
  unit,
  category,
  barcode,
  price
){
  if(!canManageStore(storeId)){
    alert('ليس لديك صلاحية تعديل هذه المادة.');
    return;
  }

  const choice = prompt(
`اختر العملية:

1 - تعديل اسم المادة
2 - تعديل الماركة
3 - تعديل الوحدة
4 - تعديل التصنيف
5 - تعديل الباركود
6 - تعديل السعر
7 - حذف المادة

اكتب رقم العملية:`
  );

  if(choice === null) return;

  const option = String(choice).trim();

  if(option === '7'){

    const confirmDelete = confirm(
      'هل أنت متأكد من حذف هذه المادة من هذا المتجر؟'
    );

    if(!confirmDelete) return;

    try{

      const { error } =
        await supabaseClient
          .from('price_listings')
          .delete()
          .eq('id',listingId)
          .eq('store_id',storeId);

      if(error) throw error;

      alert('تم حذف المادة من المتجر بنجاح ✅');

      await window.renderStoreDetail(storeId);

    }catch(err){

      console.error(err);

      alert(
        'تعذر حذف المادة:\n' +
        (err.message || 'خطأ غير معروف')
      );
    }

    return;
  }

  let field = '';
  let currentValue = '';

  if(option === '1'){
    field = 'name';
    currentValue = name || '';
  }
  else if(option === '2'){
    field = 'brand';
    currentValue = brand || '';
  }
  else if(option === '3'){
    field = 'unit';
    currentValue = unit || '';
  }
  else if(option === '4'){
    field = 'category';
    currentValue = category || '';
  }
  else if(option === '5'){
    field = 'barcode';
    currentValue = barcode || '';
  }
  else if(option === '6'){

    const newPrice =
      prompt(
        'أدخل السعر الجديد:',
        price || ''
      );

    if(newPrice === null) return;

    const priceNumber =
      Number(
        String(newPrice)
          .replace(/,/g,'.')
          .trim()
      );

    if(
      !Number.isFinite(priceNumber) ||
      priceNumber < 0
    ){
      alert('السعر غير صحيح.');
      return;
    }

    try{

      const { error } =
        await supabaseClient
          .from('price_listings')
          .update({
            price_new: priceNumber,
            price: priceNumber,
            approved: true,
            updated_at: new Date().toISOString()
          })
          .eq('id',listingId)
          .eq('store_id',storeId);

      if(error) throw error;

      alert('تم تعديل السعر بنجاح ✅');

      await window.renderStoreDetail(storeId);

    }catch(err){

      console.error(err);

      alert(
        'تعذر تعديل السعر:\n' +
        (err.message || 'خطأ غير معروف')
      );
    }

    return;
  }
  else{
    alert('اختر رقمًا من 1 إلى 7.');
    return;
  }

  const newValue =
    prompt(
      'أدخل القيمة الجديدة:',
      currentValue
    );

  if(newValue === null) return;

  try{

    const updateData = {};

    updateData[field] =
      newValue.trim() || null;

    const { error } =
      await supabaseClient
        .from('products')
        .update(updateData)
        .eq('id',productId);

    if(error) throw error;

    alert('تم التعديل بنجاح ✅');

    await window.renderStoreDetail(storeId);

  }catch(err){

    console.error(err);

    alert(
      'تعذر تعديل المادة:\n' +
      (err.message || 'خطأ غير معروف')
    );
  }
};
   /* =========================
     تشغيل
     ========================= */

  window.addEventListener(
    'load',
    function(){

      setTimeout(
        function(){

          addButton();

          getUserLocation();

        },
        700
      );

    }
  );
// ===============================
// صلاحيات التاجر - المدير فقط
// ===============================

window.adminMerchantPermissions = async function(){

  if(!isAdmin()){
    alert('هذه الصفحة للمدير فقط.');
    return;
  }

  try{

    const { data: merchants, error } =
      await supabaseClient
        .from('profiles')
        .select('id,name,role,store_id,can_edit_prices')
        .eq('role','store')
        .order('created_at',{ascending:false});

    if(error) throw error;

    const { data: stores, error: storesError } =
      await supabaseClient
        .from('stores')
        .select('id,name')
        .order('name');

    if(storesError) throw storesError;

    let html = `
      <div class="card" style="margin-top:16px">
        <h3>صلاحيات التجار</h3>
        <p class="muted">
          اربط التاجر بمتجر ثم فعّل أو عطّل صلاحية التعديل.
        </p>
    `;

    if(!merchants || !merchants.length){

      html += `
        <div class="muted">
          لا يوجد تجار مسجلون حتى الآن.
        </div>
      `;

    }else{

      merchants.forEach(function(merchant){

        const store =
          (stores || []).find(
            s => s.id === merchant.store_id
          );

        html += `
          <div class="card" style="margin-top:12px">

            <strong>
              ${esc(merchant.name || 'تاجر بدون اسم')}
            </strong>

            <div class="muted" style="margin-top:6px">
              ${esc(merchant.id)}
            </div>

            <label style="display:block;margin-top:12px">
              المتجر
            </label>

            <select
              id="merchantStore_${merchant.id}"
              class="input"
              style="width:100%;margin-top:6px"
            >

              <option value="">
                بدون متجر
              </option>

              ${(stores || []).map(function(store){

                return `
                  <option
                    value="${store.id}"
                    ${merchant.store_id === store.id ? 'selected' : ''}
                  >
                    ${esc(store.name)}
                  </option>
                `;

              }).join('')}

            </select>

            <label
              style="
                display:flex;
                align-items:center;
                gap:8px;
                margin-top:12px;
              "
            >

              <input
                type="checkbox"
                id="merchantPermission_${merchant.id}"
                ${merchant.can_edit_prices ? 'checked' : ''}
              >

              السماح للتاجر بإضافة وتعديل وحذف مواد وأسعار متجره

            </label>

            <button
              type="button"
              class="btn"
              style="margin-top:12px"
              onclick="
                saveMerchantPermission(
                  '${merchant.id}'
                )
              "
            >
              💾 حفظ الصلاحيات
            </button>

          </div>
        `;

      });

    }

    html += `</div>`;

    const adminPage =
      document.getElementById('admin');

    if(!adminPage){
      alert('لم يتم العثور على صفحة الإدارة.');
      return;
    }

    let box =
      document.getElementById('merchantPermissionsBox');

    if(!box){

      box =
        document.createElement('div');

      box.id =
        'merchantPermissionsBox';

      adminPage.appendChild(box);

    }

    box.innerHTML = html;

  }catch(err){

    console.error(err);

    alert(
      'تعذر تحميل صلاحيات التجار:\n' +
      (err.message || 'خطأ غير معروف')
    );
  }
};


// حفظ صلاحيات تاجر
window.saveMerchantPermission = async function(merchantId){

  if(!isAdmin()){
    alert('المدير فقط يستطيع تغيير الصلاحيات.');
    return;
  }

  const storeSelect =
    document.getElementById(
      'merchantStore_' + merchantId
    );

  const permission =
    document.getElementById(
      'merchantPermission_' + merchantId
    );

  if(!storeSelect || !permission){
    alert('تعذر قراءة بيانات الصلاحية.');
    return;
  }

  const storeId =
    storeSelect.value || null;

  const canEdit =
    permission.checked && !!storeId;

  try{

    const { error } =
      await supabaseClient
        .from('profiles')
        .update({
          store_id: storeId,
          can_edit_prices: canEdit
        })
        .eq('id',merchantId);

    if(error) throw error;

    alert(
      canEdit
        ? 'تم ربط التاجر بالمتجر وتفعيل الصلاحية ✅'
        : 'تم حفظ الصلاحيات وتعطيل التعديل ✅'
    );

    await window.adminMerchantPermissions();

  }catch(err){

    console.error(err);

    alert(
      'تعذر حفظ الصلاحيات:\n' +
      (err.message || 'خطأ غير معروف')
    );
  }
};
})();
