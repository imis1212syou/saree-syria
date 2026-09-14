/* =========================================================
   سعرلي سوريا — store_features.js
   الدفعة 1 من 2
   النسخة الشاملة
   ========================================================= */

(function () {

  'use strict';

  /* =======================================================
     أدوات
     ======================================================= */

  function el(id) {
    return document.getElementById(id);
  }

  function esc(v) {

    if (typeof window.e === 'function') {
      return window.e(v);
    }

    return String(v ?? '').replace(
      /[&<>"']/g,
      function (m) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;'
        }[m];
      }
    );
  }


  function isAdmin() {

    return !!(
      profileData &&
      profileData.role === 'admin'
    );
  }


  function isMerchant() {

    return !!(
      profileData &&
      profileData.role === 'store'
    );
  }


  function merchantAllowed() {

    return !!(
      profileData &&
      profileData.role === 'store' &&
      profileData.store_id &&
      profileData.can_edit_prices
    );
  }


  function canManageProducts() {

    return (
      isAdmin() ||
      merchantAllowed()
    );
  }


  /* =======================================================
     تحميل المتاجر
     ======================================================= */

  async function loadStores() {

    try {

      const {
        data,
        error
      } = await supabaseClient
        .from('stores')
        .select('*')
        .order('name');

      if (error) {
        console.warn(
          'تعذر تحميل المتاجر:',
          error.message
        );
        return;
      }

      stores =
        Array.isArray(data)
          ? data
          : [];

    } catch (err) {

      console.warn(
        'stores error:',
        err
      );

    }
  }


  /* =======================================================
     صفحة المتاجر
     ======================================================= */

  window.renderStores =
    async function () {

      const box =
        el('storesList');

      if (!box) {
        return;
      }

      await loadStores();


      if (!stores.length) {

        box.innerHTML = `
          <div class="card">
            <p class="muted">
              لا توجد متاجر مضافة حالياً.
            </p>
          </div>
        `;

        return;
      }


      box.innerHTML =
        stores.map(function (store) {

          const area =
            [
              store.city,
              store.area
            ]
              .filter(Boolean)
              .join(' — ');


          return `

            <div class="card">

              <div
                class="row"
                style="
                  justify-content:space-between;
                  align-items:center;
                  gap:10px;
                "
              >

                <h3>
                  ${esc(
                    store.name || 'متجر'
                  )}
                </h3>

                ${
                  store.verified
                    ? `
                      <span class="pill">
                        ✓ موثّق
                      </span>
                    `
                    : ''
                }

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


              ${
                store.address
                  ? `
                    <div class="muted">
                      📍 ${esc(store.address)}
                    </div>
                  `
                  : ''
              }


              ${
                store.phone
                  ? `
                    <div class="muted">
                      📞 ${esc(store.phone)}
                    </div>
                  `
                  : ''
              }


              ${
                store.opening_hours
                  ? `
                    <div class="muted">
                      🕐 ${esc(
                        store.opening_hours
                      )}
                    </div>
                  `
                  : ''
              }


              <div
                class="actions"
                style="margin-top:12px;"
              >

                <button
                  type="button"
                  class="btn primary"
                  onclick="
                    openStore('${store.id}')
                  "
                >
                  فتح صفحة المتجر
                </button>


                ${
                  isAdmin()
                    ? `
                      <button
                        type="button"
                        class="btn secondary"
                        onclick="
                          toggleStoreVerification(
                            '${store.id}',
                            ${store.verified ? 'false' : 'true'}
                          )
                        "
                      >
                        ${
                          store.verified
                            ? 'إلغاء التوثيق'
                            : '✓ توثيق المتجر'
                        }
                      </button>
                    `
                    : ''
                }

              </div>

            </div>

          `;

        }).join('');

    };


  /* =======================================================
     صفحة المتجر
     ======================================================= */

  window.renderStoreDetail =
    async function (storeId) {

      const body =
        el('storeDetailBody');

      const title =
        el('storeDetailName');

      if (!body || !title) {
        return;
      }


      const id =
        storeId ||
        window.currentStoreId;


      if (!id) {

        body.innerHTML = `
          <div class="card">
            <p class="muted">
              لم يتم تحديد المتجر.
            </p>
          </div>
        `;

        return;
      }


      window.currentStoreId =
        id;


      await loadStores();


      const store =
        stores.find(function (s) {

          return String(s.id) ===
            String(id);

        });


      if (!store) {

        body.innerHTML = `
          <div class="card">
            <p class="muted">
              المتجر غير موجود.
            </p>
          </div>
        `;

        return;
      }


      title.textContent =
        store.name || 'المتجر';


      try {

        if (
          typeof window.recordStoreVisit ===
          'function'
        ) {

          await window.recordStoreVisit(
            store.id
          );

        }

      } catch (_) {}


      let pricesData = [];


      try {

        const {
          data,
          error
        } =
          await supabaseClient
            .from('price_listings')
            .select(
              '*,products(*)'
            )
            .eq(
              'store_id',
              store.id
            )
            .eq(
              'approved',
              true
            )
            .order(
              'updated_at',
              {
                ascending: false
              }
            );


        if (!error) {

          pricesData =
            Array.isArray(data)
              ? data
              : [];

        }

      } catch (_) {}


      let html = `

        <div class="card">

          <div
            class="row"
            style="
              justify-content:space-between;
              align-items:center;
            "
          >

            <h2>
              ${esc(
                store.name || 'المتجر'
              )}
            </h2>

            ${
              store.verified
                ? `
                  <span class="pill">
                    ✓ موثّق
                  </span>
                `
                : ''
            }

          </div>


          ${
            store.city || store.area
              ? `
                <p class="muted">
                  📍
                  ${esc(
                    [
                      store.city,
                      store.area
                    ]
                      .filter(Boolean)
                      .join(' — ')
                  )}
                </p>
              `
              : ''
          }


          ${
            store.address
              ? `
                <p class="muted">
                  العنوان:
                  ${esc(store.address)}
                </p>
              `
              : ''
          }


          ${
            store.phone
              ? `
                <p class="muted">
                  الهاتف:
                  ${esc(store.phone)}
                </p>
              `
              : ''
          }

        </div>


        ${
          merchantAllowed() &&
          String(profileData.store_id) ===
          String(store.id)

          ? `

            <div class="card">

              <div
                class="actions"
                style="margin-bottom:10px;"
              >

                <button
                  type="button"
                  class="btn primary"
                  onclick="
                    openBarcodeScannerForStore(
                      '${store.id}'
                    )
                  "
                >
                  📷 مسح الباركود
                </button>

                <button
                  type="button"
                  class="btn secondary"
                  onclick="
                    showAdd()
                  "
                >
                  إضافة مادة
                </button>

              </div>

              <p class="muted">
                يمكنك تعديل وحذف مواد وأسعار متجرك فقط.
              </p>

            </div>

          `
          : ''
        }


        <div class="card">

          <h3>
            المواد والأسعار
          </h3>

          <div
            class="grid"
            id="storeProductsGrid"
          >

      `;


      if (!pricesData.length) {

        html += `
          <p class="muted">
            لا توجد أسعار منشورة لهذا المتجر حالياً.
          </p>
        `;

      } else {

        html +=
          pricesData
            .map(function (row) {

              const product =
                row.products || {};

              const price =
                row.price_new ??
                row.price ??
                0;


              const canEditThis =
                isAdmin() ||
                (
                  merchantAllowed() &&
                  String(
                    profileData.store_id
                  ) ===
                  String(store.id)
                );


              return `

                <div
                  class="card"
                  data-store-product="${esc(row.id)}"
                >

                  ${
                    product.image_url
                      ? `
                        <img
                          src="${esc(
                            product.image_url
                          )}"
                          alt="${esc(
                            product.name || ''
                          )}"
                          loading="lazy"
                          style="
                            width:100%;
                            max-height:200px;
                            object-fit:contain;
                            border-radius:14px;
                          "
                        >
                      `
                      : ''
                  }


                  <h3>
                    ${esc(
                      product.name ||
                      'مادة'
                    )}
                  </h3>


                  ${
                    product.brand
                      ? `
                        <div class="muted">
                          ${esc(
                            product.brand
                          )}
                        </div>
                      `
                      : ''
                  }


                  ${
                    product.unit
                      ? `
                        <div class="muted">
                          ${esc(
                            product.unit
                          )}
                        </div>
                      `
                      : ''
                  }


                  ${
                    product.barcode
                      ? `
                        <div class="muted">
                          باركود:
                          ${esc(
                            product.barcode
                          )}
                        </div>
                      `
                      : ''
                  }


                  <div class="price">

                    ${
                      typeof window.f ===
                      'function'
                        ? window.f(price)
                        : price
                    }

                    ل.س

                  </div>


                  ${
                    row.updated_at
                      ? `
                        <div class="muted">
                          آخر تحديث:
                          ${esc(
                            row.updated_at
                          )}
                        </div>
                      `
                      : ''
                  }


                  ${
                    canEditThis
                      ? `

                        <div
                          class="actions"
                          style="
                            margin-top:10px;
                          "
                        >

                          <button
                            type="button"
                            class="btn secondary"
                            onclick="
                              editStoreProduct(
                                '${row.id}',
                                '${product.id}',
                                '${store.id}'
                              )
                            "
                          >
                            ✏️ تعديل
                          </button>


                          <button
                            type="button"
                            class="btn secondary"
                            onclick="
                              deleteStoreProduct(
                                '${row.id}',
                                '${product.id}',
                                '${store.id}'
                              )
                            "
                          >
                            🗑️ حذف
                          </button>

                        </div>

                      `
                      : ''
                  }

                </div>

              `;

            })
            .join('');

      }


      html += `
          </div>
        </div>
      `;


      body.innerHTML =
        html;

    };


  /* =======================================================
     توثيق المتجر — المدير فقط
     ======================================================= */

  window.toggleStoreVerification =
    async function (
      storeId,
      value
    ) {

      if (!isAdmin()) {

        alert(
          'هذه العملية للمدير فقط.'
        );

        return;
      }


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


      if (error) {

        alert(
          'تعذر تحديث المتجر: ' +
          error.message
        );

        return;
      }


      await renderStores();

    };


  /* =======================================================
     صفحة إضافة مادة
     ======================================================= */

  window.showAdd =
    function () {

      if (!canManageProducts()) {

        alert(
          'ليس لديك صلاحية إضافة مادة.'
        );

        return;
      }


      if (
        typeof window.show ===
        'function'
      ) {

        window.show('add');

      }


      const box =
        el('merchantStoreBox');


      if (!box) {
        return;
      }


      /*
        المدير يختار المتجر.
      */

      if (isAdmin()) {

        const options =
          stores
            .map(function (store) {

              return `
                <option value="${esc(store.id)}">
                  ${esc(store.name)}
                </option>
              `;

            })
            .join('');


        box.innerHTML = `

          <label class="muted">
            المتجر الذي سيضاف إليه السعر
          </label>

          <select id="adminAddStore">

            <option value="">
              اختر المتجر
            </option>

            ${options}

          </select>

        `;

        return;
      }


      /*
        التاجر المربوط:
        متجره محدد تلقائياً.
      */

      if (merchantAllowed()) {

        const store =
          stores.find(function (s) {

            return String(s.id) ===
              String(profileData.store_id);

          });


        box.innerHTML = `

          <label class="muted">
            المتجر
          </label>

          <input
            type="text"
            value="${esc(
              store?.name ||
              'متجرك'
            )}"
            disabled
          >

          <input
            type="hidden"
            id="merchantStoreId"
            value="${esc(
              profileData.store_id
            )}"
          >

        `;

      }

    };


  /* =======================================================
     تجهيز قائمة المواد الموجودة
     ======================================================= */

  async function loadExistingProducts() {

    const select =
      el('existingProduct');

    if (!select) {
      return;
    }


    try {

      const {
        data,
        error
      } =
        await supabaseClient
          .from('products')
          .select(
            'id,name,brand,unit,category,barcode,image_url'
          )
          .eq(
            'active',
            true
          )
          .order(
            'name'
          );


      if (error) {
        return;
      }


      select.innerHTML =
        `
          <option value="">
            إضافة مادة جديدة
          </option>
        `;


      (data || [])
        .forEach(function (product) {

          const option =
            document.createElement(
              'option'
            );


          option.value =
            product.id;


          option.textContent =
            product.name +
            (
              product.brand
                ? ' — ' +
                  product.brand
                : ''
            );


          select.appendChild(
            option
          );

        });

    } catch (_) {}

  }


  /* =======================================================
     عند اختيار مادة
     ======================================================= */

  function setupExistingProduct() {

    const select =
      el('existingProduct');


    if (
      !select ||
      select.dataset.bound === '1'
    ) {
      return;
    }


    select.dataset.bound =
      '1';


    select.addEventListener(
      'change',
      async function () {

        const id =
          select.value;


        if (!id) {
          return;
        }


        try {

          const {
            data,
            error
          } =
            await supabaseClient
              .from('products')
           /* =========================================================
   سعرلي سوريا — store_features.js
   الدفعة 2 من 2
   ========================================================= */

(function () {

  'use strict';


  function el(id) {
    return document.getElementById(id);
  }


  function esc(v) {

    if (typeof window.e === 'function') {
      return window.e(v);
    }

    return String(v ?? '').replace(
      /[&<>"']/g,
      function (m) {
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


  function isAdmin() {

    return !!(
      profileData &&
      profileData.role === 'admin'
    );

  }


  function merchantAllowed() {

    return !!(
      profileData &&
      profileData.role === 'store' &&
      profileData.store_id &&
      profileData.can_edit_prices
    );

  }


  function canManage() {

    return (
      isAdmin() ||
      merchantAllowed()
    );

  }


  /* =======================================================
     إضافة المادة / السعر
     ======================================================= */

  window.submitPrice =
    async function () {

      if (!canManage()) {

        alert(
          'ليس لديك صلاحية إضافة أو تعديل المواد.'
        );

        return;
      }


      const selected =
        el('existingProduct')?.value || '';


      const name =
        el('pn')?.value.trim() || '';


      const brand =
        el('brand')?.value.trim() || '';


      const unit =
        el('unit')?.value.trim() || '';


      const category =
        el('cat')?.value.trim() || '';


      const barcode =
        el('barcode')?.value.trim() || '';


      const priceRaw =
        el('pr')?.value;


      const price =
        priceRaw === '' ||
        priceRaw == null
          ? null
          : Number(priceRaw);


      const imageFile =
        el('pimg')?.files?.[0] || null;


      if (!selected && !name) {

        alert(
          'اكتب اسم المادة الجديدة.'
        );

        return;
      }


      if (
        price === null ||
        Number.isNaN(price) ||
        price < 0
      ) {

        alert(
          'اكتب السعر بشكل صحيح.'
        );

        return;
      }


      /* ---------------------------------------------------
         تحديد المتجر
         --------------------------------------------------- */

      let storeId = null;


      if (isAdmin()) {

        storeId =
          el('adminAddStore')?.value ||
          null;

      } else {

        storeId =
          profileData.store_id;

      }


      if (!storeId) {

        alert(
          'اختر المتجر.'
        );

        return;
      }


      /* ---------------------------------------------------
         الصورة اختيارية
         --------------------------------------------------- */

      let imageUrl = null;


      try {

        if (imageFile) {

          if (
            typeof window.uploadImage ===
            'function'
          ) {

            imageUrl =
              await window.uploadImage(
                imageFile,
                'materials'
              );

          }

        }

      } catch (err) {

        alert(
          'فشل رفع الصورة: ' +
          err.message
        );

        return;
      }


      /* ===================================================
         مادة موجودة
         =================================================== */

      if (selected) {

        /*
          المدير يستطيع تعديل أي مادة.
          التاجر يستطيع التعامل مع مادته ضمن متجره.
        */


        if (isAdmin()) {

          const productUpdate = {

            name:
              name || undefined,

            brand:
              brand || null,

            unit:
              unit || null,

            category:
              category || null,

            barcode:
              barcode || null

          };


          if (imageUrl) {
            productUpdate.image_url =
              imageUrl;
          }


          const {
            error: productError
          } =
            await supabaseClient
              .from('products')
              .update(productUpdate)
              .eq(
                'id',
                selected
              );


          if (productError) {

            alert(
              'تعذر تعديل المادة: ' +
              productError.message
            );

            return;
          }

        }


        /*
          السعر للمتجر المختار
        */

        const {
          error: priceError
        } =
          await supabaseClient
            .from('price_listings')
            .upsert(
              {
                product_id:
                  selected,

                store_id:
                  storeId,

                price_new:
                  price,

                approved:
                  true,

                status:
                  'approved',

                submitted_by:
                  profileData.id,

                approved_by:
                  profileData.id,

                updated_at:
                  new Date().toISOString()
              },
              {
                onConflict:
                  'product_id,store_id'
              }
            );


        if (priceError) {

          alert(
            'تعذر حفظ السعر: ' +
            priceError.message
          );

          return;
        }


        clearAfterSave();

        alert(
          'تم تحديث المادة والسعر بنجاح.'
        );


        if (
          typeof window.renderStoreDetail ===
          'function'
        ) {

          await window.renderStoreDetail(
            storeId
          );

        }


        return;
      }


      /* ===================================================
         مادة جديدة
         =================================================== */

      const {
        data: product,
        error: insertError
      } =
        await supabaseClient
          .from('products')
          .insert({

            name:
              name,

            brand:
              brand || null,

            unit:
              unit || null,

            category:
              category || null,

            barcode:
              barcode || null,

            image_url:
              imageUrl || null,

            active:
              true,

            created_by:
              profileData.id

          })
          .select()
          .single();


      if (insertError) {

        alert(
          'تعذر إضافة المادة: ' +
          insertError.message
        );

        return;
      }


      if (!product) {

        alert(
          'لم يتم إنشاء المادة.'
        );

        return;
      }


      /* ---------------------------------------------------
         إضافة سعر المادة للمتجر
         --------------------------------------------------- */

      const {
        error: listingError
      } =
        await supabaseClient
          .from('price_listings')
          .insert({

            product_id:
              product.id,

            store_id:
              storeId,

            price_new:
              price,

            approved:
              true,

            status:
              'approved',

            submitted_by:
              profileData.id,

            approved_by:
              profileData.id,

            updated_at:
              new Date().toISOString()

          });


      if (listingError) {

        alert(
          'تم إنشاء المادة لكن تعذر حفظ السعر: ' +
          listingError.message
        );

        return;
      }


      clearAfterSave();


      alert(
        'تمت إضافة المادة والسعر بنجاح.'
      );


      if (
        typeof window.renderStoreDetail ===
        'function'
      ) {

        await window.renderStoreDetail(
          storeId
        );

      }

    };


  /* =======================================================
     تنظيف النموذج
     ======================================================= */

  function clearAfterSave() {

    [
      'pn',
      'brand',
      'unit',
      'barcode',
      'cat',
      'pr'
    ].forEach(function (id) {

      const input =
        el(id);

      if (input) {
        input.value = '';
      }

    });


    if (el('existingProduct')) {
      el('existingProduct').value = '';
    }


    if (el('pimg')) {
      el('pimg').value = '';
    }


    if (el('barcodeMsg')) {
      el('barcodeMsg').textContent = '';
    }

  }


  /* =======================================================
     تعديل مادة
     ======================================================= */

  window.editStoreProduct =
    async function (
      listingId,
      productId,
      storeId
    ) {

      if (!canManage()) {

        alert(
          'ليس لديك صلاحية التعديل.'
        );

        return;
      }


      /*
        التاجر ممنوع من تعديل متجر آخر.
      */

      if (
        merchantAllowed() &&
        String(
          profileData.store_id
        ) !==
        String(storeId)
      ) {

        alert(
          'لا يمكنك تعديل مادة في متجر آخر.'
        );

        return;
      }


      try {

        const {
          data,
          error
        } =
          await supabaseClient
            .from('price_listings')
            .select(
              'id,store_id,price_new,price,products(*)'
            )
            .eq(
              'id',
              listingId
            )
            .single();


        if (error || !data) {

          alert(
            'تعذر تحميل المادة.'
          );

          return;
        }


        if (
          merchantAllowed() &&
          String(data.store_id) !==
          String(profileData.store_id)
        ) {

          alert(
            'لا يمكنك تعديل هذه المادة.'
          );

          return;
        }


        const product =
          data.products || {};


        const newName =
          prompt(
            'اسم المادة:',
            product.name || ''
          );


        if (newName === null) {
          return;
        }


        const newBrand =
          prompt(
            'العلامة التجارية:',
            product.brand || ''
          );


        if (newBrand === null) {
          return;
        }


        const newUnit =
          prompt(
            'الوزن / الحجم:',
            product.unit || ''
          );


        if (newUnit === null) {
          return;
        }


        const newCategory =
          prompt(
            'التصنيف:',
            product.category || ''
          );


        if (newCategory === null) {
          return;
        }


        const newBarcode =
          prompt(
            'الباركود:',
            product.barcode || ''
          );


        if (newBarcode === null) {
          return;
        }


        const currentPrice =
          data.price_new ??
          data.price ??
          '';


        const newPriceRaw =
          prompt(
            'السعر الجديد:',
            currentPrice
          );


        if (newPriceRaw === null) {
          return;
        }


        const newPrice =
          Number(newPriceRaw);


        if (
          Number.isNaN(newPrice) ||
          newPrice < 0
        ) {

          alert(
            'السعر غير صحيح.'
          );

          return;
        }


        const {
          error: updateProductError
        } =
          await supabaseClient
            .from('products')
            .update({

              name:
                newName.trim(),

              brand:
                newBrand.trim() || null,

              unit:
                newUnit.trim() || null,

              category:
                newCategory.trim() || null,

              barcode:
                newBarcode.trim() || null

            })
            .eq(
              'id',
              productId
            );


        if (updateProductError) {

          alert(
            'تعذر تعديل المادة: ' +
            updateProductError.message
          );

          return;
        }


        const {
          error: updatePriceError
        } =
          await supabaseClient
            .from('price_listings')
            .update({

              price_new:
                newPrice,

              price:
                newPrice,

              approved:
                true,

              status:
                'approved',

              updated_at:
                new Date().toISOString()

            })
            .eq(
              'id',
              listingId
            );


        if (updatePriceError) {

          alert(
            'تم تعديل المادة لكن تعذر تعديل السعر: ' +
            updatePriceError.message
          );

          return;
        }


        alert(
          'تم التعديل بنجاح.'
        );


        await window.renderStoreDetail(
          storeId
        );

      } catch (err) {

        alert(
          'حدث خطأ: ' +
          err.message
        );

      }

    };


  /* =======================================================
     حذف المادة / سعرها من المتجر
     ======================================================= */

  window.deleteStoreProduct =
    async function (
      listingId,
      productId,
      storeId
    ) {

      if (!canManage()) {

        alert(
          'ليس لديك صلاحية الحذف.'
        );

        return;
      }


      if (
        merchantAllowed() &&
        String(
          profileData.store_id
        ) !==
        String(storeId)
      ) {

        alert(
          'لا يمكنك حذف مادة من متجر آخر.'
        );

        return;
      }


      if (
        !confirm(
          'هل تريد حذف هذه المادة من هذا المتجر؟'
        )
      ) {

        return;
      }


      try {

        /*
          نحذف سعر المتجر فقط.
          لا نحذف المنتج العام حتى لا يختفي
          من المتاجر الأخرى.
        */

        const {
          error
        } =
          await supabaseClient
            .from('price_listings')
            .delete()
            .eq(
              'id',
              listingId
            )
            .eq(
              'store_id',
              storeId
            );


        if (error) {

          alert(
            'تعذر الحذف: ' +
            error.message
          );

          return;
        }


        alert(
          'تم حذف المادة من هذا المتجر.'
        );


        await window.renderStoreDetail(
          storeId
        );

      } catch (err) {

        alert(
          'حدث خطأ: ' +
          err.message
        );

      }

    };


  /* =======================================================
     زر إضافة مادة بالصفحة الرئيسية
     ======================================================= */

  function injectHomeButton() {

    if (!canManage()) {
      return;
    }


    const home =
      el('home');


    if (!home) {
      return;
    }


    if (
      el('storeFeaturesAddBtn')
    ) {
      return;
    }


    const button =
      document.createElement(
        'button'
      );


    button.id =
      'storeFeaturesAddBtn';


    button.type =
      'button';


    button.className =
      'btn primary';


    button.textContent =
      'إضافة مادة جديدة';


    button.onclick =
      window.showAdd;


    home.appendChild(
      button
    );

  }


  /* =======================================================
     تجهيز صفحة الإضافة
     ======================================================= */

  function prepareAddPage() {

    if (!canManage()) {
      return;
    }


    const note =
      document.querySelector(
        '#add .hero .muted'
      );


    if (note) {

      note.textContent =
        isAdmin()
          ? 'المدير يستطيع إضافة وتعديل المواد والأسعار لجميع المتاجر.'
          : 'يمكنك إضافة وتعديل مواد وأسعار متجرك مباشرة بدون موافقة المدير.';

    }


    loadExistingProducts();


    if (
      typeof setupExistingProduct ===
      'function'
    ) {
      setupExistingProduct();
    }

  }


  /* =======================================================
     فتح المتجر
     ======================================================= */

  window.openStore =
    function (storeId) {

      window.currentStoreId =
        storeId;


      if (
        typeof window.show ===
        'function'
      ) {

        window.show(
          'storeDetail'
        );

      }


      if (
        typeof window.renderStoreDetail ===
        'function'
      ) {

        window.renderStoreDetail(
          storeId
        );

      }

    };


  /* =======================================================
     QR للمتجر
     ======================================================= */

  window.generateStoreQR =
    function (storeId) {

      const box =
        el('storeQR');


      if (!box) {
        return;
      }


      box.innerHTML = '';


      if (
        typeof QRCode ===
        'undefined'
      ) {

        box.innerHTML = `
          <p class="muted">
            تعذر تحميل مولد QR.
          </p>
        `;

        return;
      }


      const url =
        window.location.origin +
        window.location.pathname +
        '?store=' +
        encodeURIComponent(
          storeId
        );


      new QRCode(
        box,
        {
          text: url,
          width: 220,
          height: 220
        }
      );

    };


  /* =======================================================
     بداية التشغيل
     ======================================================= */

  function initStoreFeatures() {

    injectHomeButton();

    prepareAddPage();

  }


  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      initStoreFeatures,
      {
        once: true
      }
    );

  } else {

    initStoreFeatures();

  }


})();
