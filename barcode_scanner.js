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

  const MULTI_BARCODE_SEPARATOR = '|';
  let pendingBarcodes = [];
  let pendingBarcodeInputId = null;

  function cleanBarcode(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function splitBarcodes(value) {
    return String(value || '')
      .split(/[|,;\n\r]+/)
      .map(cleanBarcode)
      .filter(Boolean);
  }

  function uniqueBarcodes(values) {
    const out = [];
    const seen = new Set();
    for (const value of values || []) {
      const code = cleanBarcode(value);
      if (!code || seen.has(code)) continue;
      seen.add(code);
      out.push(code);
    }
    return out;
  }

  function joinBarcodes(values) {
    return uniqueBarcodes(values).join(MULTI_BARCODE_SEPARATOR);
  }

  function barcodeMatches(storedValue, code) {
    const wanted = cleanBarcode(code);
    if (!wanted) return false;
    const stored = String(storedValue || '').trim();
    if (!stored) return false;
    if (cleanBarcode(stored) === wanted && !/[|,;\n\r]/.test(stored)) return true;
    return splitBarcodes(stored).includes(wanted);
  }

  function isAddScannerMode() {
    return scannerMode === 'add' || scannerMode === 'companyAdd';
  }

  function getAddBarcodeInputId() {
    return scannerMode === 'companyAdd'
      ? (el('cep_barcode') ? 'cep_barcode' : 'admin_cep_barcode')
      : 'barcode';
  }

  function getCurrentAddBarcodes() {
    const id = getAddBarcodeInputId();
    const input = el(id);
    return uniqueBarcodes(input?.value || '');
  }

  function renderPendingBarcodes() {
    const wrap = el('barcodeMultiWrap');
    const list = el('barcodeMultiList');
    const count = el('barcodeMultiCount');
    if (!wrap || !list || !count) return;
    if (!isAddScannerMode()) {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = 'block';
    count.textContent = String(pendingBarcodes.length);
    list.innerHTML = pendingBarcodes.length
      ? pendingBarcodes.map((code, index) => `
          <span style="display:inline-flex;align-items:center;gap:6px;background:#172329;border:1px solid #2c3b42;border-radius:999px;padding:5px 9px;font-size:12px;margin:3px 0 3px 4px;">
            ${escapeHtml(code)}
            <button type="button" data-remove-barcode="${index}" style="border:0;background:transparent;color:#fff;cursor:pointer;padding:0 2px;font-size:14px;line-height:1;">×</button>
          </span>
        `).join('')
      : '<span style="opacity:.65;font-size:12px;">لم تتم إضافة باركودات بعد.</span>';
    list.querySelectorAll('[data-remove-barcode]').forEach(button => {
      button.onclick = function () {
        const index = Number(button.getAttribute('data-remove-barcode'));
        if (!Number.isInteger(index)) return;
        pendingBarcodes.splice(index, 1);
        renderPendingBarcodes();
      };
    });
  }

  function commitPendingBarcodesToInput() {
    if (!isAddScannerMode() || !pendingBarcodeInputId) return;
    const input = el(pendingBarcodeInputId);
    if (!input) return;
    input.value = joinBarcodes(pendingBarcodes);
  }

  function clearPendingBarcodes() {
    pendingBarcodes = [];
    pendingBarcodeInputId = null;
  }

  async function barcodeAlreadyUsedInStore(storeId, code) {
    if (!storeId || !code || !window.supabaseClient) return false;
    try {
      const { data, error } = await supabaseClient
        .from('price_listings')
        .select('product_id,products(barcode)')
        .eq('store_id', storeId)
        .eq('approved', true);
      if (error) throw error;
      const editingId = window.__editingMaterial?.productId || el('existingProduct')?.value || null;
      return (Array.isArray(data) ? data : []).some(row => {
        if (editingId && String(row?.product_id) === String(editingId)) return false;
        return barcodeMatches(row?.products?.barcode || row?.barcode, code);
      });
    } catch (error) {
      console.warn('Barcode duplicate check (store):', error);
      return false;
    }
  }

  async function barcodeAlreadyUsedInCompany(companyId, code) {
    if (!companyId || !code || !window.supabaseClient) return false;
    try {
      const { data, error } = await supabaseClient
        .from('company_products')
        .select('id,barcode')
        .eq('company_id', companyId)
        .eq('active', true);
      if (error) throw error;
      const editingId = window.__sareeEditingCompanyProductId || null;
      return (Array.isArray(data) ? data : []).some(row => {
        if (editingId && String(row?.id) === String(editingId)) return false;
        return barcodeMatches(row?.barcode, code);
      });
    } catch (error) {
      console.warn('Barcode duplicate check (company):', error);
      return false;
    }
  }

  async function addPendingBarcode(code) {
    const clean = cleanBarcode(code);
    if (!clean) return false;
    if (pendingBarcodes.includes(clean)) {
      setStatus('هذا الباركود مضاف مسبقاً. اختر باركوداً آخر.');
      scanLocked = false;
      return false;
    }

    if (scannerMode === 'add') {
      const storeId = scannerStoreId || (typeof profileData !== 'undefined' && profileData?.store_id) || el('merchantStoreSelect')?.value || new URLSearchParams(location.search).get('store') || null;
      if (await barcodeAlreadyUsedInStore(storeId, clean)) {
        setStatus('هذا الباركود مستخدم لمادة أخرى داخل هذا المتجر.');
        scanLocked = false;
        return false;
      }
    } else if (scannerMode === 'companyAdd') {
      const companyId = scannerCompanyId || window.companyContext?.company_id || window.currentCompany?.id || null;
      if (await barcodeAlreadyUsedInCompany(companyId, clean)) {
        setStatus('هذا الباركود مستخدم لمادة أخرى داخل هذه الشركة.');
        scanLocked = false;
        return false;
      }
    }

    pendingBarcodes.push(clean);
    pendingBarcodes = uniqueBarcodes(pendingBarcodes);
    renderPendingBarcodes();
    setStatus(`تمت إضافة الباركود. عدد الباركودات: ${pendingBarcodes.length}`);
    return true;
  }

  function withMultiBarcodeValue(fn, rawValue) {
    const originalReplace = String.prototype.replace;
    String.prototype.replace = function (searchValue, replaceValue) {
      const source = String(this);
      if (source === rawValue && searchValue instanceof RegExp && searchValue.global) {
        return source;
      }
      return originalReplace.apply(this, arguments);
    };
    let result;
    try {
      result = fn();
    } finally {
      String.prototype.replace = originalReplace;
    }
    return result;
  }

  function isSuccessfulMultiSave(inputId, rawValue) {
    const input = el(inputId);
    return !input || input.value !== rawValue;
  }

  function installMultiSaveHooks() {
    if (window.__sareeMultiBarcodeSaveHooksInstalled) return;
    window.__sareeMultiBarcodeSaveHooksInstalled = true;

    document.addEventListener('input', function (event) {
      if (!pendingBarcodeInputId || document.getElementById('barcodeScannerModal')) return;
      if (event.target?.id !== pendingBarcodeInputId) return;
      pendingBarcodes = uniqueBarcodes(splitBarcodes(event.target.value));
    });

    document.addEventListener('click', function (event) {
      const button = event.target?.closest?.('#addSubmitBtn, #saveCompanyProduct, #admin_cep_save');
      if (!button || pendingBarcodes.length < 2) return;

      const inputId = button.id === 'addSubmitBtn'
        ? 'barcode'
        : (button.id === 'saveCompanyProduct' ? 'cep_barcode' : 'admin_cep_barcode');
      const rawValue = joinBarcodes(pendingBarcodes);
      const input = el(inputId);
      if (!input) return;

      input.value = rawValue;
      const handler = button.onclick;
      if (typeof handler !== 'function' && button.id !== 'addSubmitBtn') return;

      event.preventDefault();
      event.stopImmediatePropagation();

      try {
        let promise;
        if (button.id === 'addSubmitBtn') {
          if (typeof window.submitPrice !== 'function') return;
          promise = withMultiBarcodeValue(() => window.submitPrice(), rawValue);
        } else {
          promise = withMultiBarcodeValue(() => handler.call(button, event), rawValue);
        }
        Promise.resolve(promise).then(() => {
          if (isSuccessfulMultiSave(inputId, rawValue)) {
            clearPendingBarcodes();
            renderPendingBarcodes();
          }
        });
      } catch (error) {
        console.error('Multi-barcode save:', error);
      }
    }, true);
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
    if (isAddScannerMode()) {
      pendingBarcodeInputId = getAddBarcodeInputId();
      pendingBarcodes = getCurrentAddBarcodes();
    } else {
      clearPendingBarcodes();
    }

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

        <div id="barcodeMultiWrap" style="display:none;margin-top:12px;text-align:right">
          <div style="font-weight:700;margin-bottom:7px">الباركودات المضافة (<span id="barcodeMultiCount">0</span>)</div>
          <div id="barcodeMultiList" style="max-height:140px;overflow:auto;border:1px solid #26343a;border-radius:12px;padding:7px;background:#0b1418"></div>
          <p style="font-size:12px;opacity:.72;margin:7px 0 0">يمكنك مسح أو إدخال أي عدد من الباركودات لنفس المادة.</p>
          <button type="button" class="btn primary" id="barcodeFinishBtn" style="width:100%;margin-top:8px">تم — حفظ الباركودات</button>
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
    const finishButton =
      el('barcodeFinishBtn');

    if (isAddScannerMode()) {
      renderPendingBarcodes();
      if (finishButton) finishButton.onclick = window.closeBarcodeScanner;
    }

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

    if (mode === 'add' || mode === 'companyAdd') {
      const added = await addPendingBarcode(clean);
      if (!added) return;

      if (mode === 'add' && pendingBarcodes.length === 1) {
        await fillProductFromBarcode(clean, storeId);
      } else if (mode === 'companyAdd') {
        const input = el('cep_barcode') || el('admin_cep_barcode');
        if (input) input.value = joinBarcodes(pendingBarcodes);
        const msg = el('cepBarcodeMsg');
        if (msg) msg.textContent = `تمت إضافة الباركود. العدد: ${pendingBarcodes.length}`;
        const adminMsg = el('adminCepBarcodeMsg');
        if (adminMsg) adminMsg.textContent = `تمت إضافة الباركود. العدد: ${pendingBarcodes.length}`;
      }
      scanLocked = false;
      return;
    }

    await window.closeBarcodeScanner();

    if (mode === 'store') {
      await showStoreBarcodeResult(clean, storeId);
      return;
    }

    if (mode === 'company') {
      await showCompanyBarcodeResult(clean, companyId);
      return;
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

      const listing = (Array.isArray(listings) ? listings : []).find(row =>
        barcodeMatches(row?.products?.barcode || row?.barcode || '', code)
      );
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

      const listing =
        (Array.isArray(listings) ? listings : [])
          .find(function (row) {
            return barcodeMatches(row?.products?.barcode || row?.barcode || '', barcode);
          });

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
      const { data: rows, error } = await supabaseClient
        .from('company_products')
        .select('*')
        .eq('company_id', companyId)
        .eq('active', true);

      if (error) throw error;
      const data = (Array.isArray(rows) ? rows : []).find(row => barcodeMatches(row?.barcode, barcode));

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

  function displayBarcodes(value) {
    return splitBarcodes(value).join(' • ');
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
            displayBarcodes(product.barcode || '')
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

      commitPendingBarcodesToInput();

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

  installMultiSaveHooks();

})();