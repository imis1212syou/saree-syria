/* سعرلي سوريا — barcode_scanner.js
   نسخة مبنية مباشرة على ماسح الباركود القديم الذي كان يعمل.
   - كاميرا خلفية
   - إدخال باركود يدوي
   - تعبئة المادة تلقائياً عند العثور عليها
   - البحث داخل متجر محدد أو شركة محددة
   - عزل المادة والباركود حسب المتجر/الشركة
   - إضافة مادة الشركة بالكاميرا
   - بدون توليد أو تنزيل باركود
*/

(function () {
  'use strict';

  let scanner = null;
  let scannerMode = null;
  let scannerStoreId = null;
  let scannerCompanyId = null;
  let scanLocked = false;

  function el(id) {
    return document.getElementById(id);
  }

  function cleanBarcode(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }

  function formatPrice(value) {
    const n = Number(value || 0);

    return n.toLocaleString('en-US', {
      maximumFractionDigits: 2
    });
  }

  function setStatus(text) {
    const status = el('barcodeScanStatus');

    if (status) {
      status.textContent = text;
    }
  }

  function loadScannerLibrary(callback) {
    if (window.Html5Qrcode) {
      callback();
      return;
    }

    const old = document.getElementById('html5QrScript');

    if (old) {
      old.addEventListener(
        'load',
        callback,
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');

    script.id = 'html5QrScript';

    script.src =
      'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';

    script.onload = callback;

    script.onerror = function () {
      setStatus(
        'تعذر تحميل قارئ الباركود. تحقق من اتصال الإنترنت.'
      );
    };

   document.head.appendChild(script);
  }

  window.openBarcodeScannerForAdd = function (storeId) {
    scannerMode = 'add';
    scannerStoreId = storeId || null;
    scannerCompanyId = null;
    scanLocked = false;
    openScanner();
  };

  window.openBarcodeScannerForStore = function (storeId) {
    scannerMode = 'store';
    scannerStoreId = storeId;
    scannerCompanyId = null;
    scanLocked = false;
    openScanner();
  };

  window.openBarcodeScannerForCompany = function (companyId) {
    scannerMode = 'company';
    scannerCompanyId = companyId;
    scannerStoreId = null;
    scanLocked = false;
    openScanner();
  };

  window.openBarcodeScannerForCompanyAdd = function (companyId) {
    scannerMode = 'companyAdd';
    scannerCompanyId = companyId;
    scannerStoreId = null;
    scanLocked = false;
    openScanner();
  };

  function openScanner() {
    window.closeBarcodeScanner();

    const modal = document.createElement('div');

    modal.id = 'barcodeScannerModal';

    modal.style.cssText = `
      position:fixed;
      inset:0;
      z-index:999999;
      background:#0b1113;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:15px;
      direction:rtl;
      box-sizing:border-box;
    `;

    modal.innerHTML = `
      <div style="
        width:100%;
        max-width:520px;
        max-height:95vh;
        overflow:auto;
        background:#10191c;
        border-radius:20px;
        padding:18px;
        box-sizing:border-box;
        color:#fff;
        box-shadow:0 20px 60px rgba(0,0,0,.45);
      ">

        <h2 style="
          margin:0;
          text-align:center;
        ">
          مسح الباركود
        </h2>

        <p style="
          text-align:center;
          opacity:.75;
          margin:10px 0 15px;
        ">
          وجّه الكاميرا نحو الباركود
        </p>

        <div
          id="barcodeReader"
          style="
            width:100%;
            min-height:280px;
            background:#000;
            border-radius:15px;
            overflow:hidden;
          ">
        </div>

        <p
          id="barcodeScanStatus"
          style="
            text-align:center;
            margin:12px 0;
            opacity:.9;
          ">
          جاري تشغيل الكاميرا...
        </p>
   <div style="
          display:flex;
          gap:8px;
          margin-top:10px;
        ">

          <input
            id="barcodeManualModal"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            placeholder="أو اكتب رقم الباركود"
            style="
              flex:1;
              min-width:0;
              box-sizing:border-box;
            ">

          <button
            type="button"
            class="btn primary"
            id="barcodeManualSearchBtn">
            بحث
          </button>

        </div>

        <button
          type="button"
          class="btn secondary"
          id="barcodeCloseBtn"
          style="
            width:100%;
            margin-top:12px;
          ">
          إغلاق
        </button>

      </div>
    `;

    document.body.appendChild(modal);

    const manualInput =
      el('barcodeManualModal');
const searchButton =
      el('barcodeManualSearchBtn');

    const closeButton =
      el('barcodeCloseBtn');

    if (searchButton) {
      searchButton.onclick = function () {
        const value =
          cleanBarcode(
            manualInput ? manualInput.value : ''
          );

        if (!value) {
          alert('اكتب رقم الباركود أولاً.');
          return;
        }

        handleBarcode(value);
      };
    }

    if (manualInput) {
      manualInput.addEventListener(
        'input',
        function () {
          manualInput.value =
            cleanBarcode(manualInput.value);
        }
      );

      manualInput.addEventListener(
        'keydown',
        function (event) {
          if (event.key === 'Enter') {
            event.preventDefault();

            if (searchButton) {
              searchButton.click();
            }
          }
        }
      );
    }
   if (closeButton) {
      closeButton.onclick =
        window.closeBarcodeScanner;
    }

    loadScannerLibrary(startScanner);
  }

  function startScanner() {
    if (!window.Html5Qrcode) {
      setStatus(
        'تعذر تحميل قارئ الباركود.'
      );

      return;
    }

    const reader =
      el('barcodeReader');

    if (!reader) {
      return;
    }

    try {
      scanner =
        new window.Html5Qrcode(
          'barcodeReader'
        );
    } catch (error) {
      console.error(error);

      setStatus(
        'تعذر تشغيل قارئ الباركود.'
      );

      return;
    }

    const config = {
      fps: 10,
      qrbox: {
        width: 280,
        height: 140
      },
      aspectRatio: 1.777
    };

    scanner.start(
      {
        facingMode: 'environment'
      },
      config,
      function (decodedText) {

        if (scanLocked) {
          return;
        }

        const barcode =
          cleanBarcode(decodedText);

        if (!barcode) {
          return;
        }

        scanLocked = true;

        handleBarcode(barcode);
      },
      function () {
        // أخطاء القراءة أثناء تحريك الكاميرا يتم تجاهلها.
      }
    )
    .then(function () {

      setStatus(
        'الكاميرا تعمل — وجّهها نحو الباركود'
      );

    })
    .catch(function (error) {

      console.error(
        'Camera start error:',
        error
      );

      setStatus(
        'لم تفتح الكاميرا. اسمح بالوصول للكاميرا أو استخدم الإدخال اليدوي.'
      );
    });
  }
async function handleBarcode(barcode) {

    const clean = cleanBarcode(barcode);
    if (!clean) return;

    const mode = scannerMode;
    const storeId = scannerStoreId;
    const companyId = scannerCompanyId;

    await window.closeBarcodeScanner();

    if (mode === 'add') {
      const input = el('barcode');
      if (input) {
        input.value = clean;
        input.dispatchEvent(new Event('input', { bubbles:true }));
        input.dispatchEvent(new Event('change', { bubbles:true }));
      }
      const msg = el('barcodeMsg');
      if (msg) msg.textContent = 'تم قراءة الباركود: ' + clean;
      await fillProductFromBarcode(clean, storeId);
      return;
    }

    if (mode === 'store') {
      await showStoreBarcodeResult(clean, storeId);
      return;
    }

    if (mode === 'company') {
      await showCompanyBarcodeResult(clean, companyId);
      return;
    }

    if (mode === 'companyAdd') {
      const input = el('cep_barcode') || el('admin_cep_barcode');
      if (input) {
        input.value = clean;
        input.dispatchEvent(new Event('input', { bubbles:true }));
        input.dispatchEvent(new Event('change', { bubbles:true }));
      }
      const msg = el('cepBarcodeMsg');
      if (msg) msg.textContent = 'تم قراءة الباركود: ' + clean;
      const adminMsg = el('adminCepBarcodeMsg');
      if (adminMsg) adminMsg.textContent = 'تم قراءة الباركود: ' + clean;
    }
  }

  async function fillProductFromBarcode(barcode, storeId) {
    const code = cleanBarcode(barcode);
    try {
      const scopedStoreId = storeId ||
        (typeof profileData !== 'undefined' && profileData?.store_id) ||
        el('merchantStoreSelect')?.value ||
        new URLSearchParams(location.search).get('store') || null;

      if (!scopedStoreId) {
        const msg = el('barcodeMsg');
        if (msg) msg.textContent = 'تم قراءة الباركود. اختر المتجر ثم احفظ المادة.';
        return;
      }

      const { data: listings, error } = await supabaseClient
        .from('price_listings')
        .select('id,store_id,product_id,approved,updated_at,products(*)')
        .eq('store_id', scopedStoreId)
        .eq('approved', true)
        .order('updated_at', { ascending:false });

      if (error) throw error;

      let listing = (Array.isArray(listings) ? listings : []).find(row =>
        cleanBarcode(row?.products?.barcode || row?.barcode || '') === code
      );
      if (!listing) {
        const { data: linked, error: linkedError } = await supabaseClient
          .from('store_product_barcodes')
          .select('product_id')
          .eq('store_id', scopedStoreId)
          .eq('barcode', code)
          .limit(1)
          .maybeSingle();
        if (linkedError) throw linkedError;
        if (linked?.product_id) {
          listing = (Array.isArray(listings) ? listings : []).find(row => String(row.product_id) === String(linked.product_id)) || null;
        }
      }
      const data = listing?.products || null;

      if (!data) {
        const existing = el('existingProduct');
        if (existing) {
          existing.value = '';
          existing.dispatchEvent(new Event('change', { bubbles:true }));
        }
        const msg = el('barcodeMsg');
        if (msg) msg.textContent = 'لم نجد مادة بهذا الباركود داخل هذا المتجر. يمكنك إضافة مادة جديدة.';
        return;
      }

      const existing = el('existingProduct');
      if (existing) {
        let option = [...existing.options].find(o => String(o.value) === String(data.id));
        if (!option) {
          option = document.createElement('option');
          option.value = data.id;
          option.textContent = 'المادة الممسوحة: ' + (data.name || 'مادة');
          existing.appendChild(option);
        }
        existing.value = data.id;
        existing.dispatchEvent(new Event('change', { bubbles:true }));
      }

      ['pn','brand','unit','cat'].forEach(id => {
        if (el(id)) el(id).value = data[id] || '';
      });
      if (el('merchantCompanySelect')) el('merchantCompanySelect').value = data.company_id || '';

      const msg = el('barcodeMsg');
      if (msg) msg.textContent = 'تم العثور على المادة داخل هذا المتجر وتعبئة بياناتها.';
    } catch (error) {
      console.error('Barcode product lookup:', error);
      const msg = el('barcodeMsg');
      if (msg) msg.textContent = 'تم قراءة الباركود، لكن تعذر جلب بيانات المادة من المتجر.';
    }
  }

  async function showStoreBarcodeResult(
    barcode,
    storeId
  ) {

    if (!storeId) {

      showResult(
        'المتجر غير محدد',
        'لم يتم تحديد المتجر المطلوب البحث داخله.'
      );

      return;
    }

    try {

      /*
       * البحث يجب أن يبدأ من أسعار المتجر المحدد، وليس من جدول
       * products العام؛ لأن نفس الباركود يمكن أن يكون له مادة
       * مستقلة في متجر آخر.
       */
      const {
        data: listings,
        error: priceError
      } =
        await supabaseClient
          .from('price_listings')
          .select(
            'id,price_new,store_id,product_id,approved,updated_at,products(*)'
          )
          .eq('store_id', storeId)
          .eq('approved', true)
          .order(
            'updated_at',
            { ascending:false }
          );

      if (priceError) {
        throw priceError;
      }

      let listing =
        (Array.isArray(listings) ? listings : [])
          .find(function (row) {
            return cleanBarcode(row?.products?.barcode || row?.barcode || '') === barcode;
          });
      if (!listing) {
        const linked = await supabaseClient
          .from('store_product_barcodes')
          .select('product_id')
          .eq('store_id', storeId)
          .eq('barcode', barcode)
          .limit(1)
          .maybeSingle();
        if (linked.error) throw linked.error;
        if (linked.data?.product_id) {
          listing = (Array.isArray(listings) ? listings : [])
            .find(function (row) { return String(row.product_id) === String(linked.data.product_id); }) || null;
        }
      }

      const product = listing?.products || null;

      if (!listing || !product) {

        showResult(
          'لم نجد المادة',
          'لا توجد مادة بهذا الباركود داخل هذا المتجر.'
        );

        return;
      }

      const store =
        Array.isArray(window.stores)
          ? window.stores.find(
              function (x) {
                return String(x.id) ===
                  String(storeId);
              }
            )
          : null;

      const newPrice =
        Number(
          listing.price_new || 0
        );

      const oldPrice =
        newPrice * 100;

      showProductResult(
        product,
        newPrice,
        oldPrice,
        store,
        listing.updated_at
      );

    } catch (error) {

      console.error(
        'Store barcode lookup:',
        error
      );

      showResult(
        'تعذر البحث',
        'حدث خطأ أثناء البحث عن المادة.'
      );
    }
  }

  async function showCompanyBarcodeResult(barcode, companyId) {
    if (!companyId) {
      showResult('الشركة غير محددة', 'لم يتم تحديد الشركة المطلوب البحث داخلها.');
      return;
    }

    try {
      const { data, error } = await supabaseClient
        .from('company_products')
        .select('*')
        .eq('company_id', companyId)
        .eq('active', true)
        .eq('barcode', barcode)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        showResult('لم نجد المادة', 'لا توجد مادة بهذا الباركود داخل هذه الشركة.');
        return;
      }

      if (typeof window.openCompanyProduct === 'function') {
        window.openCompanyProduct(data.id);
        return;
      }
      showResult('تم العثور على المادة', 'تم العثور على المادة، لكن تعذر فتح تفاصيلها.');
    } catch (error) {
      console.error('Company barcode lookup:', error);
      showResult('تعذر البحث', error?.message || 'حدث خطأ أثناء البحث داخل الشركة.');
    }
  }

  function showProductResult(
    product,
    newPrice,
    oldPrice,
    store,
    updatedAt
  ) {

    closeResult();

    const modal =
      document.createElement('div');

    modal.id =
      'barcodeResultModal';

    modal.style.cssText = `
      position:fixed;
      inset:0;
      z-index:999998;
      background:rgba(0,0,0,.9);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:18px;
      direction:rtl;
      box-sizing:border-box;
    `;

    modal.innerHTML = `
      <div style="
        width:100%;
        max-width:430px;
        max-height:90vh;
        overflow:auto;
        background:#10191c;
        color:#fff;
        border-radius:20px;
        padding:20px;
        text-align:center;
        box-sizing:border-box;
      ">

        ${
          product.image_url
            ? `
              <img
                src="${escapeHtml(product.image_url)}"
                alt=""
                style="
                  width:110px;
                  height:110px;
                  object-fit:cover;
                  border-radius:15px;
                ">
            `
            : ''
        }

        <h2>
          ${escapeHtml(
            product.name || 'المادة'
          )}
        </h2>

        ${
          product.brand
            ? `
              <p>
                الماركة:
                ${escapeHtml(product.brand)}
              </p>
            `
            : ''
        }

        ${
          product.unit
            ? `
              <p>
                الوحدة:
                ${escapeHtml(product.unit)}
              </p>
            `
            : ''
        }

        <div style="
          padding:15px;
          margin:15px 0;
          border-radius:15px;
          background:rgba(57,217,138,.08);
        ">

          <div style="
            font-size:28px;
            font-weight:bold;
          ">
            ${formatPrice(newPrice)}
            ل.س جديدة
          </div>

          <div style="
            opacity:.7;
            margin-top:5px;
          ">
            ${formatPrice(oldPrice)}
            ل.س قديمة
          </div>

        </div>

        ${
          store
            ? `
              <p>
                المتجر:
                ${escapeHtml(
                  store.name || ''
                )}
              </p>
            `
            : ''
        }

        ${
          updatedAt
            ? `
              <p style="opacity:.65">
                آخر تحديث:
                ${escapeHtml(updatedAt)}
              </p>
            `
            : ''
        }

        <p style="opacity:.65">
          الباركود:
          ${escapeHtml(
            product.barcode || ''
          )}
        </p>

        <button
          type="button"
          class="btn primary"
          onclick="closeBarcodeResultModal()"
          style="width:100%;">
          إغلاق
        </button>

      </div>
    `;

    document.body.appendChild(modal);
  }

  function showResult(
    title,
    text
  ) {

    closeResult();

    const modal =
      document.createElement('div');

    modal.id =
      'barcodeResultModal';

    modal.style.cssText = `
      position:fixed;
      inset:0;
      z-index:999998;
      background:rgba(0,0,0,.9);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:18px;
      direction:rtl;
      box-sizing:border-box;
    `;

    modal.innerHTML = `
      <div style="
        width:100%;
        max-width:420px;
        background:#10191c;
        color:#fff;
        border-radius:20px;
        padding:20px;
        text-align:center;
        box-sizing:border-box;
      ">

        <h2>
          ${escapeHtml(title)}
        </h2>

        <p>
          ${escapeHtml(text)}
        </p>

        <button
          type="button"
          class="btn primary"
          onclick="closeBarcodeResultModal()"
          style="width:100%;">
          إغلاق
        </button>

      </div>
    `;

    document.body.appendChild(modal);
  }

  function closeResult() {

    const modal =
      el('barcodeResultModal');

    if (modal) {
      modal.remove();
    }
  }

  window.closeBarcodeResultModal =
    closeResult;

  window.closeBarcodeScanner =
    async function () {

      if (scanner) {

        try {
          await scanner.stop();
        } catch (error) {
          console.warn(error);
        }

        try {
          scanner.clear();
        } catch (error) {
          console.warn(error);
        }

        scanner = null;
      }

      scanLocked = false;

      const modal =
        el('barcodeScannerModal');

      if (modal) {
        modal.remove();
      }
    };

})();