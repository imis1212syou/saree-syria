/* سعرلي سوريا — barcode_scanner.js
   - كاميرا خلفية
   - إدخال باركود يدوي
   - تعبئة المادة تلقائياً عند العثور عليها
   - البحث داخل متجر محدد
   - بدون توليد أو تنزيل باركود
*/

(function () {
  'use strict';

  let scanner = null;
  let scannerMode = null;
  let scannerStoreId = null;
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

  window.openBarcodeScannerForAdd = function () {
    scannerMode = 'add';
    scannerStoreId = null;
    scanLocked = false;

    openScanner();
  };

  window.openBarcodeScannerForStore = function (storeId) {
    scannerMode = 'store';
    scannerStoreId = storeId;
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

    const clean =
      cleanBarcode(barcode);

    if (!clean) {
      return;
    }

    const mode =
      scannerMode;

    const storeId =
      scannerStoreId;

    await window.closeBarcodeScanner();

    if (mode === 'add') {

      const input =
        el('barcode');

      if (input) {

        input.value =
          clean;

        input.dispatchEvent(
          new Event(
            'input',
            { bubbles:true }
          )
        );

        input.dispatchEvent(
          new Event(
            'change',
            { bubbles:true }
          )
        );
      }

      const msg =
        el('barcodeMsg');

      if (msg) {
        msg.textContent =
          'تم قراءة الباركود: ' + clean;
      }

      await fillProductFromBarcode(clean);

      return;
    }

    if (mode === 'store') {

      await showStoreBarcodeResult(
        clean,
        storeId
      );
    }
  }

  async function fillProductFromBarcode(barcode) {

    try {

      const { data, error } =
        await supabaseClient
          .from('products')
          .select('*')
          .eq('barcode', barcode)
          .limit(1)
          .maybeSingle();

      if (error) {
        console.warn(error);
        return;
      }

      if (!data) {

        const msg =
          el('barcodeMsg');

        if (msg) {
          msg.textContent =
            'لم نجد مادة بهذا الباركود. يمكنك إضافة مادة جديدة.';
        }

        return;
      }

      if (el('pn')) {
        el('pn').value =
          data.name || '';
      }

      if (el('brand')) {
        el('brand').value =
          data.brand || '';
      }

      if (el('unit')) {
        el('unit').value =
          data.unit || '';
      }

      if (el('cat')) {
        el('cat').value =
          data.category || '';
      }

      const msg =
        el('barcodeMsg');

      if (msg) {
        msg.textContent =
          'تم العثور على المادة وتعبئة بياناتها تلقائياً.';
      }

    } catch (error) {

      console.error(
        'Barcode product lookup:',
        error
      );
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
       * أولاً نبحث عن المنتج بواسطة الباركود.
       */

      const { data: product, error } =
        await supabaseClient
          .from('products')
          .select('*')
          .eq('barcode', barcode)
          .limit(1)
          .maybeSingle();

      if (error) {
        throw error;
      }

      if (!product) {

        showResult(
          'لم نجد المادة',
          'لا توجد مادة بهذا الباركود.'
        );

        return;
      }

      /*
       * ثم نبحث عن سعرها داخل المتجر المحدد فقط.
       */

      const {
        data: listing,
        error: priceError
      } =
        await supabaseClient
          .from('price_listings')
          .select(
            'id,price_new,store_id,product_id,approved,updated_at'
          )
          .eq('store_id', storeId)
          .eq('product_id', product.id)
          .eq('approved', true)
          .order(
            'updated_at',
            { ascending:false }
          )
          .limit(1)
          .maybeSingle();

      if (priceError) {
        throw priceError;
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

      if (!listing) {

        showResult(
          product.name || 'المادة',
          'المادة موجودة، لكن لا يوجد لها سعر معتمد في هذا المتجر حالياً.'
        );

        return;
      }

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