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

      const {
        data,
        error
      } = await supabaseClient
        .from('stores')
        .select('*')
        .order('name');

      if(error){

        console.warn(
          'stores:',
          error.message
        );

        return;
      }

      if(Array.isArray(data)){
        stores = data;
      }

    }catch(err){

      console.warn(
        'stores refresh:',
        err
      );

    }
  }


  window.renderStores =
    async function(){

      const box =
        el('storesList');

      if(!box){
        return;
      }

      await refreshStoresSafe();


      if(!stores.length){

        box.innerHTML =
          '<div class="card">' +
          '<p class="muted">' +
          'لا توجد متاجر مضافة حالياً.' +
          '</p>' +
          '</div>';

        return;
      }


      box.innerHTML =
        stores.map(function(st){

          const verified =
            st.verified
            ? '<span class="pill">✓ موثّق</span>'
            : '';


          const hours =
            st.opening_hours
            ? '<div class="muted">🕐 ' +
              esc(st.opening_hours) +
              '</div>'
            : '';


          const days =
            st.working_days
            ? '<div class="muted">📅 ' +
              esc(st.working_days) +
              '</div>'
            : '';


          const phone =
            st.phone
            ? '<div class="muted">📞 ' +
              esc(st.phone) +
              '</div>'
            : '';


          const address =
            st.address
            ? '<div class="muted">📍 ' +
              esc(st.address) +
              '</div>'
            : '';


          const area =
            [st.city, st.area]
              .filter(Boolean)
              .join(' — ');


          return `

            <div class="card">

              <div
                class="row"
                style="
                  justify-content:space-between;
                  align-items:center
                ">

                <h3>
                  ${esc(st.name || 'متجر')}
                </h3>

                ${verified}

              </div>


              ${
                area
                ? `
                  <div class="muted">
                    📍 ${esc(area)}
                  </div>
                `
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
                    onclick="
                      toggleStoreVerification(
                        '${st.id}',
                        ${st.verified ? 'false' : 'true'}
                      )
                    ">

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


  window.renderStoreDetail =
    async function(id){

      const body =
        el('storeDetailBody');

      const title =
        el('storeDetailName');

      if(!body || !title){
        return;
      }


      const storeId =
        id ||
        window.currentStoreId;


      if(!storeId){

        body.innerHTML =
          '<p class="muted">' +
          'لم يتم تحديد المتجر.' +
          '</p>';

        return;
      }


      await refreshStoresSafe();


      const st =
        stores.find(function(x){

          return String(x.id) ===
            String(storeId);

        });


      if(!st){

        title.textContent =
          'المتجر';

        body.innerHTML =
          '<div class="card">' +
          '<p class="muted">' +
          'المتجر غير موجود.' +
          '</p>' +
          '</div>';

        return;
      }


      window.currentStoreId =
        st.id;


      title.textContent =
        st.name || 'المتجر';


      try{

        if(
          typeof recordStoreVisit ===
          'function'
        ){

          await recordStoreVisit(
            st.id
          );

        }

      }catch(_){}


      const area =
        [st.city, st.area]
          .filter(Boolean)
          .join(' — ');


      let html = `

        <div class="card">

          <div
            class="row"
            style="
              justify-content:space-between;
              align-items:center
            ">

            <h2>
              ${esc(st.name || 'المتجر')}
            </h2>

            ${
              st.verified
              ? '<span class="pill">✓ موثّق</span>'
              : ''
            }

          </div>


          ${
            area
            ? `
              <p class="muted">
                📍 ${esc(area)}
              </p>
            `
            : ''
          }


          ${
            st.address
            ? `
              <p>
                📍 العنوان:
                ${esc(st.address)}
              </p>
            `
            : ''
          }


          ${
            st.phone
            ? `
              <p>
                📞 الهاتف:
                ${esc(st.phone)}
              </p>
            `
            : ''
          }


          ${
            st.opening_hours
            ? `
              <p>
                🕐 ساعات الدوام:
                ${esc(st.opening_hours)}
              </p>
            `
            : ''
          }


          ${
            st.working_days
            ? `
              <p>
                📅 أيام العمل:
                ${esc(st.working_days)}
              </p>
            `
            : ''
          }

        </div>

      `;


      let ps = [];


      try{

        const {
          data,
          error
        } =
          await supabaseClient
            .from('price_listings')
            .select('*,products(*)')
            .eq('store_id',st.id)
            .eq('status','approved')
            .order(
              'updated_at',
              {
                ascending:false
              }
            );


        if(
          !error &&
          Array.isArray(data)
        ){

          ps = data;

        }

      }catch(_){}


      html += `

        <div class="card">

          <h3>
            أسعار المتجر
          </h3>


          ${
            ps.length

            ? `

              <div class="grid">

                ${
                  ps.map(function(p){

                    const pr =
                      p.products || {};


                    return `

                      <div class="card">

                        <h3>
                          ${esc(
                            pr.name || 'مادة'
                          )}
                        </h3>


                        ${
                          pr.brand
                          ? `
                            <div class="muted">
                              ${esc(pr.brand)}
                            </div>
                          `
                          : ''
                        }


                        ${
                          pr.unit
                          ? `
                            <div class="muted">
                              ${esc(pr.unit)}
                            </div>
                          `
                          : ''
                        }


                        <div class="price">

                          ${
                            typeof window.f ===
                            'function'
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
                          ${esc(
                            p.updated_at || ''
                          )}

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


      body.innerHTML =
        html;
    };


  window.toggleStoreVerification =
    async function(storeId,value){

      if(
        !profileData ||
        profileData.role !== 'admin'
      ){

        alert(
          'هذه العملية للمدير فقط.'
        );

        return;
      }


      try{

        const {
          error
        } =
          await supabaseClient
            .from('stores')
            .update({
              verified:
                value === true ||
                value === 'true'
            })
            .eq(
              'id',
              storeId
            );


        if(error){

          alert(
            'تعذر تحديث التوثيق: ' +
            error.message
          );

          return;
        }


        await refreshStoresSafe();


        /*
          إعادة رسم قائمة المتاجر مرة واحدة فقط
          بعد العملية، وليس كل ثانية.
        */

        if(
          typeof window.renderStores ===
          'function'
        ){

          await window.renderStores();

        }

      }catch(err){

        alert(
          'حدث خطأ: ' +
          err.message
        );

      }
    };


  window.showAdd =
    function(){

      if(!profileData){

        alert(
          'سجّل الدخول أولاً.'
        );

        show('login');

        return;
      }


      if(
        profileData.role ===
        'admin'
      ){

        show('add');


        const box =
          el('merchantStoreBox');


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
              المتجر للسعر (اختياري)
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


      if(
        profileData.role !==
        'store'
      ){

        alert(
          'إضافة المواد متاحة للتاجر المربوط بمتجر والمصرح له، وللمدير.'
        );

        return;
      }


      if(
        !profileData.can_edit_prices
      ){

        alert(
          'حسابك غير مصرح له حالياً.'
        );

        return;
      }


      if(
        !profileData.store_id
      ){

        alert(
          'حسابك غير مربوط بمتجر حتى الآن.'
        );

        return;
      }


      show('add');
    };


  function injectHomeButton(){

    const home =
      document.getElementById(
        'home'
      );

    if(
      !home ||
      !canAdd()
    ){

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
      document.createElement(
        'button'
      );


    btn.id =
      'storeFeaturesAddBtn';

    btn.className =
      'btn primary';

    btn.textContent =
      'إضافة مادة جديدة';

    btn.onclick =
      window.showAdd;


    home.appendChild(
      btn
    );
  }


  /*
    مهم:
    تم حذف setInterval بالكامل.
    لا يوجد أي تحديث تلقائي لصفحة المتاجر.
  */
 (function(){
  'use strict';

  window.submitPrice =
    async function(){

      const msg =
        el('addMsg');

      if(msg){
        msg.textContent =
          '';
      }


      if(!profileData){

        if(msg){
          msg.textContent =
            'يجب تسجيل الدخول أولاً.';
        }

        return;
      }


      const selectedProduct =
        el('existingProduct')?.value || '';


      const productName =
        el('pn')?.value.trim() || '';


      const brand =
        el('brand')?.value.trim() || '';


      const unit =
        el('unit')?.value.trim() || '';


      const barcode =
        el('barcode')?.value.trim() || '';


      const category =
        el('cat')?.value.trim() || '';


      const priceValue =
        Number(
          el('pr')?.value
        );


      const imageInput =
        el('pimg');


      const imageFile =
        imageInput?.files?.[0] || null;


      if(
        !selectedProduct &&
        !productName
      ){

        if(msg){
          msg.textContent =
            'اكتب اسم المادة أو اختر مادة موجودة.';
        }

        return;
      }


      if(
        !Number.isFinite(priceValue) ||
        priceValue < 0
      ){

        if(msg){
          msg.textContent =
            'أدخل سعراً صحيحاً.';
        }

        return;
      }


      /*
        المدير:
        يستطيع إضافة المادة والسعر مباشرة.
      */

      if(
        profileData.role ===
        'admin'
      ){

        try{

          let imageUrl =
            null;


          if(imageFile){

            const ext =
              (
                imageFile.name
                .split('.')
                .pop() ||
                'jpg'
              )
              .toLowerCase();


            const path =
              'products/' +
              crypto.randomUUID() +
              '.' +
              ext;


            const {
              error:
              uploadError
            } =
              await supabaseClient
                .storage
                .from('product-images')
                .upload(
                  path,
                  imageFile,
                  {
                    upsert:false,
                    contentType:
                      imageFile.type ||
                      'image/jpeg'
                  }
                );


            if(uploadError){

              if(msg){
                msg.textContent =
                  'تعذر رفع الصورة: ' +
                  uploadError.message;
              }

              return;
            }


            const {
              data:
              publicData
            } =
              supabaseClient
                .storage
                .from('product-images')
                .getPublicUrl(
                  path
                );


            imageUrl =
              publicData?.publicUrl ||
              null;
          }


          let productId =
            selectedProduct;


          /*
            إذا كانت مادة موجودة:
            نستخدمها مباشرة.
          */

          if(productId){

            const updateData = {};


            if(productName){
              updateData.name =
                productName;
            }


            if(brand){
              updateData.brand =
                brand;
            }


            if(unit){
              updateData.unit =
                unit;
            }


            if(category){
              updateData.category =
                category;
            }


            if(barcode){
              updateData.barcode =
                barcode;
            }


            if(imageUrl){
              updateData.image_url =
                imageUrl;
            }


            if(
              Object.keys(updateData)
                .length
            ){

              const {
                error
              } =
                await supabaseClient
                  .from('products')
                  .update(updateData)
                  .eq(
                    'id',
                    productId
                  );


              if(error){

                if(msg){
                  msg.textContent =
                    'تعذر تعديل المادة: ' +
                    error.message;
                }

                return;
              }
            }

          }else{

            /*
              مادة جديدة.
            */

            const {
              data:
              newProduct,
              error
            } =
              await supabaseClient
                .from('products')
                .insert({
                  name:
                    productName,
                  brand:
                    brand || null,
                  unit:
                    unit || null,
                  category:
                    category || null,
                  barcode:
                    barcode || null,
                  image_url:
                    imageUrl,
                  active:true,
                  created_by:
                    profileData.id
                })
                .select()
                .single();


            if(error){

              if(msg){
                msg.textContent =
                  'تعذر إضافة المادة: ' +
                  error.message;
              }

              return;
            }


            productId =
              newProduct.id;
          }


          /*
            المتجر الذي يختاره المدير.
          */

          const storeId =
            el('adminAddStore')?.value ||
            '';


          if(storeId){

            const {
              error
            } =
              await supabaseClient
                .from('price_listings')
                .upsert(
                  {
                    store_id:
                      storeId,
                    product_id:
                      productId,
                    price:
                      priceValue,
                    status:
                      'approved',
                    updated_at:
                      new Date().toISOString()
                  },
                  {
                    onConflict:
                      'store_id,product_id'
                  }
                );


            if(error){

              if(msg){
                msg.textContent =
                  'تم حفظ المادة لكن تعذر حفظ سعر المتجر: ' +
                  error.message;
              }

              return;
            }
          }


          if(msg){

            msg.textContent =
              'تمت إضافة/تعديل المادة والسعر بنجاح.';

          }


          /*
            تنظيف النموذج.
          */

          if(el('existingProduct')){
            el('existingProduct').value =
              '';
          }

          if(el('pn')){
            el('pn').value =
              '';
          }

          if(el('brand')){
            el('brand').value =
              '';
          }

          if(el('unit')){
            el('unit').value =
              '';
          }

          if(el('barcode')){
            el('barcode').value =
              '';
          }

          if(el('cat')){
            el('cat').value =
              '';
          }

          if(el('pr')){
            el('pr').value =
              '';
          }

          if(el('pimg')){
            el('pimg').value =
              '';
          }


          if(
            typeof refreshAll ===
            'function'
          ){

            await refreshAll();

          }


          if(
            typeof show ===
            'function'
          ){

            show('home');

          }


        }catch(err){

          if(msg){

            msg.textContent =
              'حدث خطأ: ' +
              err.message;

          }

        }

        return;
      }


      /*
        التاجر:
        يجب أن يكون مربوطاً بمتجر
        ومفعلاً من المدير.
      */

      if(
        profileData.role !==
        'store'
      ){

        if(msg){
          msg.textContent =
            'هذه العملية متاحة للتاجر المصرح له فقط.';
        }

        return;
      }


      if(
        !profileData.store_id
      ){

        if(msg){
          msg.textContent =
            'حسابك غير مربوط بمتجر.';
        }

        return;
      }


      if(
        !profileData.can_edit_prices
      ){

        if(msg){
          msg.textContent =
            'المدير لم يفعّل صلاحية تعديل الأسعار لحسابك.';
        }

        return;
      }


      try{

        let imageUrl =
          null;


        if(imageFile){

          const ext =
            (
              imageFile.name
              .split('.')
              .pop() ||
              'jpg'
            )
            .toLowerCase();


          const path =
            'products/' +
            crypto.randomUUID() +
            '.' +
            ext;


          const {
            error:
            uploadError
          } =
            await supabaseClient
              .storage
              .from('product-images')
              .upload(
                path,
                imageFile,
                {
                  upsert:false,
                  contentType:
                    imageFile.type ||
                    'image/jpeg'
                }
              );


          if(uploadError){

            if(msg){
              msg.textContent =
                'تعذر رفع الصورة: ' +
                uploadError.message;
            }

            return;
          }


          const {
            data:
            publicData
          } =
            supabaseClient
              .storage
              .from('product-images')
              .getPublicUrl(
                path
              );


          imageUrl =
            publicData?.publicUrl ||
            null;
        }


        /*
          إذا كانت المادة موجودة:
          يعدّل التاجر بياناتها والسعر
          ضمن متجره فقط.
        */

        let productId =
          selectedProduct;


        if(productId){

          const updateData = {};


          if(productName){
            updateData.name =
              productName;
          }


          if(brand){
            updateData.brand =
              brand;
          }


          if(unit){
            updateData.unit =
              unit;
          }


          if(category){
            updateData.category =
              category;
          }


          if(barcode){
            updateData.barcode =
              barcode;
          }


          if(imageUrl){
            updateData.image_url =
              imageUrl;
          }


          if(
            Object.keys(updateData)
              .length
          ){

            /*
              هذا التحديث سيخضع لـ RLS.
              التاجر لا يستطيع تعديل
              مادة خارج صلاحياته.
            */

            const {
              error
            } =
              await supabaseClient
                .from('products')
                .update(updateData)
                .eq(
                  'id',
                  productId
                );


            if(error){

              if(msg){
                msg.textContent =
                  'تعذر تعديل المادة: ' +
                  error.message;
              }

              return;
            }
          }


          const {
            error:
            priceError
          } =
            await supabaseClient
              .from('price_listings')
              .upsert(
                {
                  store_id:
                    profileData.store_id,
                  product_id:
                    productId,
                  price:
                    priceValue,
                  status:
                    'approved',
                  updated_at:
                    new Date().toISOString()
                },
                {
                  onConflict:
                    'store_id,product_id'
                }
              );


          if(priceError){

            if(msg){
              msg.textContent =
                'تعذر تحديث السعر: ' +
                priceError.message;
            }

            return;
          }

        }else{

          /*
            مادة جديدة للتاجر.
          */

          const {
            data:
            newProduct,
            error
          } =
            await supabaseClient
              .from('products')
              .insert({
                name:
                  productName,
                brand:
                  brand || null,
                unit:
                  unit || null,
                category:
                  category || null,
                barcode:
                  barcode || null,
                image_url:
                  imageUrl,
                active:true,
                created_by:
                  profileData.id
              })
              .select()
              .single();


          if(error){

            if(msg){
              msg.textContent =
                'تعذر إضافة المادة: ' +
                error.message;
            }

            return;
          }


          productId =
            newProduct.id;


          const {
            error:
            priceError
          } =
            await supabaseClient
              .from('price_listings')
              .insert({
                store_id:
                  profileData.store_id,
                product_id:
                  productId,
                price:
                  priceValue,
                status:
                  'approved',
                updated_at:
                  new Date().toISOString()
              });


          if(priceError){

            if(msg){
              msg.textContent =
                'تم إنشاء المادة لكن تعذر إضافة السعر: ' +
                priceError.message;
            }

            return;
          }
        }


        if(msg){

          msg.textContent =
            'تم حفظ المادة والسعر في متجرك بنجاح.';

        }


        /*
          تنظيف الحقول.
        */

        if(el('existingProduct')){
          el('existingProduct').value =
            '';
        }

        if(el('pn')){
          el('pn').value =
            '';
        }

        if(el('brand')){
          el('brand').value =
            '';
        }

        if(el('unit')){
          el('unit').value =
            '';
        }

        if(el('barcode')){
          el('barcode').value =
            '';
        }

        if(el('cat')){
          el('cat').value =
            '';
        }

        if(el('pr')){
          el('pr').value =
            '';
        }

        if(el('pimg')){
          el('pimg').value =
            '';
        }


        if(
          typeof refreshAll ===
          'function'
        ){

          await refreshAll();

        }


        if(
          typeof show ===
          'function'
        ){

          show('home');

        }

      }catch(err){

        if(msg){

          msg.textContent =
            'حدث خطأ: ' +
            err.message;

        }

      }
    };


  /*
    إعادة رسم صفحة المتجر مرة واحدة
    عند الانتقال إليها فقط.
  */

  const originalShow =
    window.show;


  if(
    typeof originalShow ===
    'function'
  ){

    window.show =
      function(page){

        originalShow.apply(
          this,
          arguments
        );


        setTimeout(
          function(){

            try{

              if(
                page ===
                'stores' &&
                typeof window.renderStores ===
                'function'
              ){

                window.renderStores();

              }


              if(
                page ===
                'storeDetail' &&
                typeof window.renderStoreDetail ===
                'function'
              ){

                window.renderStoreDetail(
                  window.currentStoreId
                );

              }

            }catch(_){}

          },
          0
        );
      };

  }


  /*
    زر إضافة المادة في الصفحة الرئيسية.
    تتم الإضافة مرة واحدة فقط.
  */

  function addButton(){

    if(
      !canAdd()
    ){

      return;
    }


    if(
      document.getElementById(
        'storeFeaturesAddBtn2'
      )
    ){

      return;
    }


    const home =
      document.getElementById(
        'home'
      );


    if(!home){
      return;
    }


    const btn =
      document.createElement(
        'button'
      );


    btn.id =
      'storeFeaturesAddBtn2';

    btn.className =
      'btn primary';

    btn.textContent =
      'إضافة مادة جديدة';

    btn.onclick =
      window.showAdd;


    const actions =
      home.querySelector(
        '.actions'
      );


    if(actions){

      actions.appendChild(
        btn
      );

    }else{

      home.appendChild(
        btn
      );

    }
  }


  /*
    تشغيل أولي مرة واحدة فقط.
    لا يوجد setInterval.
  */

  window.addEventListener(
    'load',
    function(){

      setTimeout(
        function(){

          try{
            addButton();
          }catch(_){}

        },
        300
      );

    }
  );


})();


/* =========================================================
   ربط ملف التحديثات الجديد app_updates.js
   - لا نغيّر index.html
   - لا نحمّل الملف أكثر من مرة
   - إذا فشل الملف الجديد، يبقى store_features.js يعمل
   ========================================================= */

(function(){

  'use strict';


  if(
    document.querySelector(
      'script[data-saree-app-updates="1"]'
    )
  ){

    return;
  }


  var s =
    document.createElement(
      'script'
    );


  s.src =
    'app_updates.js';


  s.async =
    false;


  s.setAttribute(
    'data-saree-app-updates',
    '1'
  );


  s.onerror =
    function(){

      console.warn(
        'تعذر تحميل app_updates.js — تم إبقاء الموقع الحالي كما هو.'
      );

    };


  document.head.appendChild(
    s
  );

})();
