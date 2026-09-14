(function () {
  'use strict';

  let scanner = null;
  let scannerMode = null;
  let scannerStoreId = null;

  function el(id) {
    return document.getElementById(id);
  }

  function loadScannerLibrary(callback) {
    if (window.Html5Qrcode) {
      callback();
      return;
    }

    const old = document.getElementById('html5QrScript');
    if (old) {
      old.addEventListener('load', callback, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'html5QrScript';
    script.src =
      'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';

    script.onload = callback;

    script.onerror = function () {
      alert('تعذر تحميل قارئ الباركود. تحقق من اتصال الإنترنت.');
    };

    document.head.appendChild(script);
  }

  window.openBarcodeScannerForAdd = function () {
    scannerMode = 'add';
    scannerStoreId = null;
    openScanner();
  };

  window.openBarcodeScannerForStore = function (storeId) {
    scannerMode = 'store';
    scannerStoreId = storeId;
    openScanner();
  };

  function openScanner() {
    closeBarcodeScanner();

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
    `;

    modal.innerHTML = `
      <div style="
        width:100%;
        max-width:520px;
        background:#10191c;
        border-radius:20px;
        padding:18px;
        box-sizing:border-box;
        color:#fff;
      ">

        <h2 style="margin-top:0;text-align:center;">
          📷 مسح الباركود
        </h2>

        <p style="text-align:center;opacity:.75;">
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
            color:#39d98a;
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
            autocomplete="off"
            placeholder="أو اكتب رقم الباركود"
            style="flex:1;min-width:0;">

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
          style="width:100%;margin-top:12px;">
          إغلاق
        </button>

      </div>
    `;

    document.body.appendChild(modal);

    el('barcodeManualSearchBtn').onclick = function () {
      const value =
        (el('barcodeManualModal')?.value || '').trim();

      if (!value) {
        alert('اكتب رقم الباركود أولاً.');
        return;
      }

      handleBarcode(value);
    };

    loadScannerLibrary(startScanner);
  }

  function startScanner() {
    if (!window.Html5Qrcode) {
      setStatus('تعذر تحميل قارئ الباركود.');
      return;
    }

    scanner = new Html5Qrcode('barcodeReader');

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
        if (decodedText) {
          handleBarcode(decodedText);
        }
      },
      function () {
        // تجاهل أخطاء البحث أثناء تحريك الكاميرا
      }
    ).then(function () {

      setStatus(
        '📷 الكاميرا تعمل — وجّهها نحو الباركود'
      );

    }).catch(function (error) {

      console.error('Camera start error:', error);

      setStatus(
        '⚠️ لم تفتح الكاميرا. اضغط سماح للكاميرا أو استخدم الكتابة اليدوية.'
      );

    });
  }

  function setStatus(text) {
    const status = el('barcodeScanStatus');

    if (status) {
      status.textContent = text;
    }
  }

  async function handleBarcode(barcode) {

    barcode = String(barcode || '').trim();

    if (!barcode) return;

    const mode = scannerMode;
    const storeId = scannerStoreId;

    await closeBarcodeScanner();

    if (mode === 'add') {

      const input = el('barcode');

      if (input) {
        input.value = barcode;

        input.dispatchEvent(
          new Event('input', { bubbles: true })
        );

        input.dispatchEvent(
          new Event('change', { bubbles: true })
        );
      }

      const msg = el('barcodeMsg');

      if (msg) {
        msg.textContent =
          '✅ تم قراءة الباركود: ' + barcode;
      }

      await fillProductFromBarcode(barcode);
      return;
    }

    if (mode === 'store') {
      await showStoreBarcodeResult(
        barcode,
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

        const msg = el('barcodeMsg');

        if (msg) {
          msg.textContent =
            'ℹ️ لم نجد مادة بهذا الباركود. يمكنك إضافة مادة جديدة.';
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

    } catch (error) {
      console.error(error);
    }
  }

  async function showStoreBarcodeResult(
    barcode,
    storeId
  ) {

    if (!storeId) {
      alert('لم يتم تحديد المتجر.');
      return;
    }

    try {

      const { data: product, error } =
        await supabaseClient
          .from('products')
          .select('*')
          .eq('barcode', barcode)
          .limit(1)
          .maybeSingle();

      if (error) throw error;

      if (!product) {

        alert(
          'لم نجد مادة بهذا الباركود.'
        );

        return;
      }

      const { data: listing, error: priceError } =
        await supabaseClient
          .from('price_listings')
          .select('price_new,store_id,product_id,approved')
          .eq('store_id', storeId)
          .eq('product_id', product.id)
          .eq('approved', true)
          .limit(1)
          .maybeSingle();

      if (priceError) throw priceError;

      if (!listing) {

        showResult(
          product.name || 'المادة',
          'المادة موجودة، لكن لا يوجد سعر معتمد لها في هذا المتجر.'
        );

        return;
      }

      const store =
        Array.isArray(stores)
          ? stores.find(x => x.id === storeId)
          : null;

      const newPrice =
        Number(listing.price_new || 0);

      const oldPrice =
        newPrice * 100;

      showProductResult(
        product,
        newPrice,
        oldPrice,
        store
      );

    } catch (error) {

      console.error(error);

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
    store
  ) {

    closeResult();

    const modal = document.createElement('div');

    modal.id = 'barcodeResultModal';

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
    `;

    modal.innerHTML = `
      <div style="
        width:100%;
        max-width:430px;
        background:#10191c;
        color:#fff;
        border-radius:20px;
        padding:20px;
        text-align:center;
      ">

        ${
          product.image_url
            ? `<img
                src="${escapeHtml(product.image_url)}"
                style="
                  width:110px;
                  height:110px;
                  object-fit:cover;
                  border-radius:15px;
                ">`
            : ''
        }

        <h2>
          ${escapeHtml(product.name || 'المادة')}
        </h2>

        ${
          product.brand
            ? `<p>العلامة: ${escapeHtml(product.brand)}</p>`
            : ''
        }

        ${
          product.unit
            ? `<p>الحجم: ${escapeHtml(product.unit)}</p>`
            : ''
        }

        <div style="
          padding:15px;
          margin:15px 0;
          border-radius:15px;
          background:rgba(57,217,138,.08);
        ">

          <div style="font-size:28px;font-weight:bold;">
            ${formatPrice(newPrice)} ل.س جديدة
          </div>

          <div style="opacity:.7;margin-top:5px;">
            ${formatPrice(oldPrice)} ل.س قديمة
          </div>

        </div>

        ${
          store
            ? `<p>المتجر: ${escapeHtml(store.name || '')}</p>`
            : ''
        }

        <p style="opacity:.65;">
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

  function showResult(title, text) {

    closeResult();

    const modal = document.createElement('div');

    modal.id = 'barcodeResultModal';

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
      ">

        <h2>${escapeHtml(title)}</h2>

        <p>${escapeHtml(text)}</p>

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
    const modal = el('barcodeResultModal');

    if (modal) {
      modal.remove();
    }
  }

  window.closeBarcodeResultModal = closeResult;

  window.closeBarcodeScanner = async function () {

    if (scanner) {

      try {
        await scanner.stop();
      } catch (e) {
        console.warn(e);
      }

      try {
        scanner.clear();
      } catch (e) {
        console.warn(e);
      }

      scanner = null;
    }

    const modal =
      el('barcodeScannerModal');

    if (modal) {
      modal.remove();
    }
  };

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
        maximumFractionDigits: 2
      });
  }

})();
