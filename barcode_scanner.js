(function () {
  'use strict';

  let stream = null;
  let video = null;
  let detector = null;
  let scanTimer = null;
  let scannerMode = null; // add أو store
  let scannerStoreId = null;

  function el(id) {
    return document.getElementById(id);
  }

  /* =========================
     فتح ماسح الباركود
     ========================= */

  window.openBarcodeScannerForAdd = function () {
    scannerMode = 'add';
    scannerStoreId = null;
    openScannerModal();
  };

  window.openBarcodeScannerForStore = function (storeId) {
    scannerMode = 'store';
    scannerStoreId = storeId;
    openScannerModal();
  };


  /* =========================
     نافذة الكاميرا
     ========================= */

  function openScannerModal() {

    closeBarcodeScanner();

    const modal = document.createElement('div');

    modal.id = 'barcodeScannerModal';

    modal.style.cssText = `
      position:fixed;
      inset:0;
      z-index:999999;
      background:rgba(0,0,0,.94);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:15px;
      direction:rtl;
    `;

    modal.innerHTML = `
      <div style="
        width:100%;
        max-width:520px;
        background:#10191c;
        border:1px solid rgba(57,217,138,.25);
        border-radius:20px;
        padding:18px;
        color:#fff;
        box-sizing:border-box;
      ">

        <h2 style="margin-top:0">
          📷 مسح الباركود
        </h2>

        <p style="opacity:.75">
          وجّه الكاميرا نحو الباركود
        </p>

        <video
          id="barcodeVideo"
          autoplay
          muted
          playsinline
          style="
            width:100%;
            height:300px;
            object-fit:cover;
            background:#000;
            border-radius:15px;
          ">
        </video>

        <p
          id="barcodeScanStatus"
          style="
            color:#39d98a;
            text-align:center;
            margin:12px 0;
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
            placeholder="اكتب رقم الباركود يدويًا"
            style="
              flex:1;
              min-width:0;
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
          onclick="closeBarcodeScanner()"
          style="margin-top:12px;width:100%;">
          إغلاق
        </button>

      </div>
    `;

    document.body.appendChild(modal);

    video = el('barcodeVideo');

    el('barcodeManualSearchBtn').onclick = function () {

      const value = (el('barcodeManualModal')?.value || '').trim();

      if (!value) {
        alert('اكتب رقم الباركود أولاً.');
        return;
      }

      handleBarcode(value);
    };

    startCamera();
  }


  /* =========================
     تشغيل الكاميرا
     ========================= */

  async function startCamera() {

    try {

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('camera_not_supported');
      }

      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: 'environment'
          },
          width: {
            ideal: 1280
          },
          height: {
            ideal: 720
          }
        },
        audio: false
      });

      video.srcObject = stream;

      const status = el('barcodeScanStatus');

      if (status) {
        status.textContent =
          '📷 وجّه الكاميرا نحو الباركود...';
      }

      if ('BarcodeDetector' in window) {

        try {

          detector = new BarcodeDetector({
            formats: [
              'ean_13',
              'ean_8',
              'upc_a',
              'upc_e',
              'code_128',
              'code_39',
              'itf'
            ]
          });

          scan();

        } catch (err) {

          console.warn('BarcodeDetector error:', err);

          fallbackMessage();

        }

      } else {

        fallbackMessage();
      }

    } catch (err) {

      console.error('Camera error:', err);

      const status = el('barcodeScanStatus');

      if (status) {
        status.textContent =
          '⚠️ لم يتم تشغيل الكاميرا. اسمح للموقع باستخدام الكاميرا أو اكتب الباركود يدويًا.';
      }
    }
  }


  /* =========================
     قراءة الباركود بالكاميرا
     ========================= */

  async function scan() {

    if (!video || !detector) return;

    try {

      const result = await detector.detect(video);

      if (result && result.length) {

        const value = result[0]?.rawValue;

        if (value) {

          await handleBarcode(value);

          return;
        }
      }

    } catch (err) {
      console.warn('Barcode scan:', err);
    }

    scanTimer = setTimeout(scan, 300);
  }


  /* =========================
     معالجة الباركود
     ========================= */

  async function handleBarcode(barcode) {

    barcode = String(barcode || '').trim();

    if (!barcode) return;

    closeBarcodeScanner();

    /* التاجر / المدير */
    if (scannerMode === 'add') {

      const input = el('barcode');

      if (input) {
        input.value = barcode;

        input.dispatchEvent(
          new Event('input', {
            bubbles: true
          })
        );

        input.dispatchEvent(
          new Event('change', {
            bubbles: true
          })
        );
      }

      const msg = el('barcodeMsg');

      if (msg) {
        msg.textContent =
          '✅ تم قراءة الباركود تلقائيًا: ' + barcode;
      }

      await fillProductFromBarcode(barcode);

      return;
    }


    /* الزائر داخل المتجر */
    if (scannerMode === 'store') {

      await showStoreBarcodeResult(
        barcode,
        scannerStoreId
      );
    }
  }


  /* =========================
     البحث عن مادة للتاجر
     ========================= */

  async function fillProductFromBarcode(barcode) {

    try {

      const {
        data,
        error
      } = await supabaseClient
        .from('products')
        .select('*')
        .eq('barcode', barcode)
        .eq('active', true)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn(error);
        return;
      }

      if (!data) {

        const msg = el('barcodeMsg');

        if (msg) {
          msg.textContent =
            'ℹ️ لم نجد مادة بهذا الباركود. يمكنك إضافة المادة الجديدة.';
        }

        return;
      }

      if (el('pn') && data.name)
        el('pn').value = data.name;

      if (el('brand') && data.brand)
        el('brand').value = data.brand;

      if (el('unit') && data.unit)
        el('unit').value = data.unit;

      if (el('cat') && data.category)
        el('cat').value = data.category;

      const msg = el('barcodeMsg');

      if (msg) {
        msg.textContent =
          '✅ تم العثور على المادة وتعبئة بياناتها تلقائيًا.';
      }

    } catch (err) {

      console.warn('Product barcode lookup:', err);
    }
  }


  /* =========================
     الزائر:
     البحث عن المادة في نفس المتجر
     ========================= */

  async function showStoreBarcodeResult(
    barcode,
    storeId
  ) {

    if (!storeId) {
      alert('لم يتم تحديد المتجر.');
      return;
    }

    try {

      const {
        data: product,
        error: productError
      } = await supabaseClient
        .from('products')
        .select('*')
        .eq('barcode', barcode)
        .eq('active', true)
        .limit(1)
        .maybeSingle();

      if (productError) {
        throw productError;
      }

      if (!product) {

        showBarcodeResultModal(
          'لم نجد مادة بهذا الباركود',
          'لا توجد مادة مسجلة بهذا الرقم حاليًا.'
        );

        return;
      }


      const {
        data: listing,
        error: priceError
      } = await supabaseClient
        .from('price_listings')
        .select('price_new,approved,store_id,product_id')
        .eq('store_id', storeId)
        .eq('product_id', product.id)
        .eq('approved', true)
        .limit(1)
        .maybeSingle();

      if (priceError) {
        throw priceError;
      }


      if (!listing) {

        showBarcodeResultModal(
          product.name || 'المادة',
          'المادة موجودة، لكن لا يوجد لها سعر معتمد في هذا المتجر حاليًا.'
        );

        return;
      }


      const store =
        stores.find(x => x.id === storeId);

      const oldPrice =
        Number(listing.price_new || 0) * 100;


      showBarcodeProductModal({
        product,
        listing,
        store,
        oldPrice
      });

    } catch (err) {

      console.error('Store barcode:', err);

      showBarcodeResultModal(
        'تعذر البحث',
        'حدث خطأ أثناء البحث عن المادة. حاول مرة أخرى.'
      );
    }
  }


  /* =========================
     عرض نتيجة الزائر
     ========================= */

  function showBarcodeProductModal({
    product,
    listing,
    store,
    oldPrice
  }) {

    closeBarcodeResultModal();

    const modal =
      document.createElement('div');

    modal.id =
      'barcodeResultModal';

    modal.style.cssText = `
      position:fixed;
      inset:0;
      z-index:999998;
      background:rgba(0,0,0,.88);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:18px;
      direction:rtl;
    `;

    const image =
      product.image_url
        ? `
          <img
            src="${escapeHtml(product.image_url)}"
            style="
              width:100px;
              height:100px;
              object-fit:cover;
              border-radius:14px;
            ">
        `
        : '';

    modal.innerHTML = `
      <div style="
        width:100%;
        max-width:430px;
        background:#10191c;
        border-radius:20px;
        padding:20px;
        color:#fff;
        text-align:center;
      ">

        ${image}

        <h2>
          ${escapeHtml(product.name || 'المادة')}
        </h2>

        ${
          product.brand
            ? `<p class="muted">
                العلامة: ${escapeHtml(product.brand)}
              </p>`
            : ''
        }

        ${
          product.unit
            ? `<p class="muted">
                ${escapeHtml(product.unit)}
              </p>`
            : ''
        }

        <div style="
          margin:18px 0;
          padding:15px;
          border-radius:15px;
          background:rgba(57,217,138,.08);
        ">

          <div class="muted">
            السعر في هذا المتجر
          </div>

          <div style="
            font-size:28px;
            font-weight:bold;
            margin:6px 0;
          ">
            ${formatPrice(listing.price_new)}
            ل.س جديدة
          </div>

          <div class="muted">
            ${formatPrice(oldPrice)}
            ل.س قديمة
          </div>

        </div>

        ${
          store
            ? `<p class="muted">
                المتجر: ${escapeHtml(store.name || '')}
              </p>`
            : ''
        }

        <p class="muted">
          الباركود: ${escapeHtml(product.barcode || '')}
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


  window.closeBarcodeResultModal =
    closeBarcodeResultModal;

  function closeBarcodeResultModal() {

    const modal =
      el('barcodeResultModal');

    if (modal) modal.remove();
  }


  function showBarcodeResultModal(
    title,
    text
  ) {

    closeBarcodeResultModal();

    const modal =
      document.createElement('div');

    modal.id =
      'barcodeResultModal';

    modal.style.cssText = `
      position:fixed;
      inset:0;
      z-index:999998;
      background:rgba(0,0,0,.88);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:18px;
      direction:rtl;
    `;

    modal.innerHTML = `
      <div style="
        width:100%;
        max-width:420px;
        background:#10191c;
        border-radius:20px;
        padding:20px;
        color:#fff;
        text-align:center;
      ">

        <h2>
          ${escapeHtml(title)}
        </h2>

        <p class="muted">
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


  /* =========================
     زر الباركود في صفحة المتجر
     ========================= */

  function addStoreBarcodeButton() {

    const body =
      el('storeDetailBody');

    if (!body) return;

    if (
      document.getElementById(
        'storeBarcodeButton'
      )
    ) return;

    const storeId =
      new URLSearchParams(
        location.search
      ).get('store');

    if (!storeId) return;

    const box =
      document.createElement('div');

    box.id =
      'storeBarcodeButton';

    box.style.cssText = `
      margin:15px 0;
    `;

    box.innerHTML = `
      <button
        type="button"
        class="btn primary"
        style="width:100%;"
        onclick="openBarcodeScannerForStore('${storeId}')">

        📷 مسح باركود للبحث عن مادة

      </button>
    `;

    body.prepend(box);
  }


  /* =========================
     ربط الزر بصفحة المتجر
     بدون interval
     ========================= */

  function hookStoreDetail() {

    if (
      typeof window.renderStoreDetail !==
      'function'
    ) return;

    const original =
      window.renderStoreDetail;

    if (original.__barcodeWrapped)
      return;

    function wrappedRenderStoreDetail() {

      const result =
        original.apply(this, arguments);

      setTimeout(
        addStoreBarcodeButton,
        0
      );

      return result;
    }

    wrappedRenderStoreDetail.__barcodeWrapped =
      true;

    window.renderStoreDetail =
      wrappedRenderStoreDetail;
  }


  /* =========================
     مراقبة ظهور صفحة المتجر
     ========================= */

  function setupNavigationHook() {

    const originalShow =
      window.show;

    if (
      typeof originalShow !==
      'function'
    ) return;

    if (originalShow.__barcodeWrapped)
      return;

    function wrappedShow(id) {

      const result =
        originalShow.apply(this, arguments);

      if (id === 'storeDetail') {

        setTimeout(
          addStoreBarcodeButton,
          0
        );
      }

      return result;
    }

    wrappedShow.__barcodeWrapped =
      true;

    window.show =
      wrappedShow;
  }


  /* =========================
     إغلاق الكاميرا
     ========================= */

  window.closeBarcodeScanner =
    function () {

      if (scanTimer) {
        clearTimeout(scanTimer);
        scanTimer = null;
      }

      if (stream) {

        stream
          .getTracks()
          .forEach(track => track.stop());

        stream = null;
      }

      detector = null;
      video = null;

      const modal =
        el('barcodeScannerModal');

      if (modal) {
        modal.remove();
      }

      scannerMode = null;
      scannerStoreId = null;
    };


  /* =========================
     المتصفح لا يدعم الكاميرا
     ========================= */

  function fallbackMessage() {

    const status =
      el('barcodeScanStatus');

    if (status) {

      status.textContent =
        '⚠️ هذا المتصفح لا يدعم القراءة التلقائية. يمكنك كتابة الباركود في الخانة بالأسفل.';
    }
  }


  /* =========================
     أدوات
     ========================= */

  function escapeHtml(value) {

    return String(value ?? '')
      .replace(/[&<>"']/g, function (m) {

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

    return Number(value || 0)
      .toLocaleString('en-US', {
        maximumFractionDigits:2
      });
  }


  /* =========================
     التشغيل بعد تحميل الصفحة
     ========================= */

  window.addEventListener(
    'load',
    function () {

      hookStoreDetail();
      setupNavigationHook();

      setTimeout(
        addStoreBarcodeButton,
        300
      );

    }
  );

})();
