/* سعرلي سوريا — إضافات المتاجر والمواد والتوثيق */
(function(){
  'use strict';

  function esc(v){
    if(typeof window.e==='function') return window.e(v);
    return String(v??'').replace(/[&<>"']/g,m=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#039;'
    }[m]));
  }

  function el(id){
    return document.getElementById(id);
  }

  function canAdd(){
    return !!(
      window.profileData &&
      (
        window.profileData.role === 'admin' ||
        (
          window.profileData.role === 'store' &&
          window.profileData.store_id &&
          window.profileData.can_edit_prices
        )
      )
    );
  }

  function addButtonHtml(){
    if(!canAdd()) return '';

    return `
      <button class="btn primary" onclick="showAdd()">
        إضافة مادة جديدة
      </button>
    `;
  }

  /* بيانات المتجر */
  function storeInfo(s){
    const rows=[];

    if(s.city || s.area)
      rows.push(
        esc([s.city,s.area].filter(Boolean).join(' • '))
      );

    if(s.address)
      rows.push('العنوان: '+esc(s.address));

    if(s.phone)
      rows.push('الهاتف: '+esc(s.phone));

    if(s.opening_hours)
      rows.push('ساعات العمل: '+esc(s.opening_hours));

    if(s.working_days)
      rows.push('أيام العمل: '+esc(s.working_days));

    return rows.join('<br>') ||
      'لا توجد بيانات إضافية مسجلة لهذا المتجر.';
  }

  /* عرض المتاجر */
  window.renderStores = function(){

    const list = window.stores || [];
    const box = el('storesList');

    if(!box) return;

    box.innerHTML =

      (
        addButtonHtml()
        ?
        `
        <div class="card" style="grid-column:1/-1">
          <div class="actions">
            ${addButtonHtml()}
          </div>
        </div>
        `
        :
        ''
      )

      +

      (
        list.map(s => `

          <div class="card">

            <div
              onclick="openStore('${s.id}')"
              style="cursor:pointer"
            >

              ${
                s.image_url
                ?
                `<img
                  class="img"
                  src="${esc(s.image_url)}"
                >`
                :
                ''
              }

              <div class="name">
                ${esc(s.name)}
                ${s.verified ? ' ✓ موثّق' : ''}
              </div>

              <div class="muted">
                ${storeInfo(s)}
              </div>

            </div>

            <div class="actions">

              <button
                class="btn secondary"
                onclick="openStore('${s.id}')"
              >
                فتح المتجر
              </button>

              ${
                window.profileData?.role === 'admin'
                ?
                `
                <button
                  class="btn ${s.verified?'secondary':'primary'}"
                  onclick="toggleStoreVerification(
                    '${s.id}',
                    ${!!s.verified}
                  )"
                >
                  ${
                    s.verified
                    ?
                    'إلغاء توثيق المتجر'
                    :
                    '✓ توثيق المتجر'
                  }
                </button>
                `
                :
                ''
              }

            </div>

          </div>

        `).join('')

        ||

        `
        <div class="card muted">
          لا توجد متاجر حالياً.
        </div>
        `
      );
  };


  /* =====================================================
     توثيق المتجر — المدير فقط
     ===================================================== */

  window.toggleStoreVerification = async function(
    storeId,
    currentVerified
  ){

    if(window.profileData?.role !== 'admin'){
      alert('توثيق المتاجر متاح للمدير فقط.');
      return;
    }

    const next = !currentVerified;

    const {error} =
      await window.supabaseClient
        .from('stores')
        .update({
          verified: next
        })
        .eq('id', storeId);

    if(error){
      alert(
        'تعذر تحديث التوثيق: ' +
        error.message
      );
      return;
    }

    const s =
      (window.stores || [])
      .find(x => x.id === storeId);

    if(s){
      s.verified = next;
    }

    alert(
      next
      ?
      'تم توثيق المتجر ✓'
      :
      'تم إلغاء توثيق المتجر.'
    );

    if(typeof window.renderStores === 'function'){
      window.renderStores();
    }

    if(
      el('storeDetail')?.classList.contains('active') &&
      typeof window.renderStoreDetail === 'function'
    ){
      window.renderStoreDetail(storeId);
    }
  };


  /* =====================================================
     صفحة المتجر
     ===================================================== */

  window.renderStoreDetail = function(id){

    const storeId =
      id ||
      new URLSearchParams(location.search).get('store');

    const s =
      (window.stores || [])
      .find(x => x.id === storeId);

    const nameBox =
      el('storeDetailName');

    const body =
      el('storeDetailBody');

    if(!nameBox || !body) return;

    if(!s){

      nameBox.textContent =
        'المتجر غير موجود';

      body.innerHTML = `
        <div class="card">
          هذا الرابط غير صالح أو المتجر غير متاح حالياً.
        </div>
      `;

      return;
    }

    if(typeof window.recordStoreVisit === 'function'){
      window.recordStoreVisit(storeId);
    }

    const ps =
      (window.prices || [])
      .filter(x => x.store_id === s.id)
      .sort(
        (a,b) =>
          Number(a.price_new) -
          Number(b.price_new)
      );

    const add = addButtonHtml();

    body.innerHTML = `

      ${
        s.image_url
        ?
        `<img
          class="img"
          src="${esc(s.image_url)}"
        >`
        :
        ''
      }

      <div class="card">

        <div class="name">

          ${esc(s.name)}

          ${
            s.verified
            ?
            ' ✓ موثّق'
            :
            ''
          }

        </div>

        <div class="muted">
          ${storeInfo(s)}
        </div>

        ${
          add
          ?
          `
          <div class="actions">
            ${add}
          </div>
          `
          :
          ''
        }

      </div>

      <h2 style="margin-top:18px">
        أسعار المتجر (${ps.length})
      </h2>

      <div class="grid">
                ${
            ps.length
            ?
            ps.map(x => {

              const p =
                (window.products || [])
                .find(y => y.id === x.product_id);

              if(!p) return '';

              return `

                <div class="card">

                  ${
                    p.image_url
                    ?
                    `<img
                      class="img"
                      src="${esc(p.image_url)}"
                    >`
                    :
                    ''
                  }

                  <div class="name">
                    ${esc(p.name)}
                  </div>

                  <div class="muted">
                    ${esc(p.unit || '')}

                    ${
                      p.brand
                      ?
                      ' • ' + esc(p.brand)
                      :
                      ''
                    }
                  </div>

                  <div class="price">

                    ${
                      typeof window.f === 'function'
                      ?
                      window.f(x.price_new)
                      :
                      Number(
                        x.price_new || 0
                      ).toLocaleString('en-US')
                    }

                    ل.س جديدة

                  </div>

                  <div class="old">

                    ${
                      typeof window.old === 'function'
                      ?
                      window.old(x.price_new)
                      :
                      (
                        Number(x.price_new || 0) * 100
                      ).toLocaleString('en-US')
                    }

                    ل.س قديمة

                  </div>

                </div>

              `;

            }).join('')

            :

            `
            <div class="card muted">
              لا توجد أسعار معتمدة لهذا المتجر حالياً.
            </div>
            `
          }

        </div>
      `;
  };


  /* =====================================================
     إضافة مادة جديدة
     ===================================================== */

  window.showAdd = function(){

    if(!window.profileData){

      alert(
        'سجّل الدخول بحساب تاجر أو مدير أولاً.'
      );

      return;
    }


    /* المدير */

    if(window.profileData.role === 'admin'){

      if(typeof window.show === 'function'){
        window.show('add');
      }

      const box =
        el('merchantStoreBox');

      if(box){

        const opts =
          (window.stores || [])
          .map(s => `
            <option value="${s.id}">
              ${esc(s.name)}
              ${
                s.city
                ?
                ' • ' + esc(s.city)
                :
                ''
              }
            </option>
          `)
          .join('');

        box.innerHTML = `

          <div class="notice">
            المدير: الإضافة والنشر مسموحان مباشرة.
          </div>

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


    /* التاجر */

    if(window.profileData.role !== 'store'){

      alert(
        'إضافة المواد متاحة للتاجر المربوط بمتجر والمصرح له، وللمدير.'
      );

      return;
    }


    if(!window.profileData.can_edit_prices){

      alert(
        'حسابك غير مصرح له حالياً.'
      );

      return;
    }


    if(!window.profileData.store_id){

      alert(
        'الحساب غير مرتبط بمتجر بعد.'
      );

      return;
    }


    if(typeof window.show === 'function'){
      window.show('add');
    }

    const box =
      el('merchantStoreBox');

    if(box){

      const s =
        (window.stores || [])
        .find(
          x =>
            x.id ===
            window.profileData.store_id
        );

      box.innerHTML = `

        <div class="notice">

          المتجر المرتبط:
          ${esc(s?.name || 'غير ظاهر')}

          —

          الطلب يحتاج موافقة المدير قبل النشر.

        </div>

      `;
    }
  };


  /* =====================================================
     إعادة الرسم
     ===================================================== */

  const originalShow =
    window.show;

  if(typeof originalShow === 'function'){

    window.show = function(id){

      const r =
        originalShow.apply(
          this,
          arguments
        );

      if(id === 'stores'){
        setTimeout(
          window.renderStores,
          0
        );
      }

      if(id === 'storeDetail'){
        setTimeout(
          () =>
            window.renderStoreDetail(),
          0
        );
      }

      if(id === 'home'){
        setTimeout(
          window.renderStores,
          0
        );
      }

      return r;
    };
  }


  /* زر إضافة مادة في الصفحة الرئيسية */

  function injectHomeButton(){

    const box =
      el('roleActions');

    if(!box || !canAdd()) return;

    if(
      !box.querySelector(
        '[data-store-feature-add]'
      )
    ){

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
  }


  /* تحديث تلقائي */

  setInterval(function(){

    try{

      injectHomeButton();

      if(
        el('stores')
        ?.classList.contains('active')
      ){
        window.renderStores();
      }

      if(
        el('storeDetail')
        ?.classList.contains('active')
      ){
        window.renderStoreDetail();
      }

    }catch(_){}

  },1200);


  window.addEventListener(
    'load',
    function(){

      setTimeout(function(){

        injectHomeButton();

        if(
          el('stores')
          ?.classList.contains('active')
        ){
          window.renderStores();
        }

      },700);

    }
  );

})();
