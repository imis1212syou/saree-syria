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
    scannerStoreId = storeId || window.__editingMaterial?.storeId || null;
    scannerCompanyId = null;
    scanLocked = false;
    openScanner();
  };

  window.openBarcodeScannerForAdditional = function (storeId) {
    scannerMode = 'additional';
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

    const allowManualInput = scannerMode !== 'additional';

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
        ${allowManualInput ? `
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
        </div>` : ''}

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
        'لم تفتح الكاميرا. اسمح بالوصول للكاميرا.'
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
      if (input) input.value = clean;
      const msg = el('barcodeMsg');
      if (msg) msg.textContent = 'تم قراءة الباركود: ' + clean;
      await fillProductFromBarcode(clean, storeId);
      return;
    }

    if (mode === 'additional') {
      const added = typeof window.addScannedStoreAdditionalBarcode === 'function'
        ? window.addScannedStoreAdditionalBarcode(clean)
        : false;
      if (!added) scanLocked = false;
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

  async function findLatestGlobalBarcodeTemplate(code) {
    const target = cleanBarcode(code);
    if (!target) return null;

    const candidates = [];
    const seen = new Set();
    const addCandidate = (product, source) => {
      if (!product?.id || seen.has(String(product.id))) return;
      if (cleanBarcode(product.barcode || '') !== target) return;
      seen.add(String(product.id));
      candidates.push({ product, source });
    };

    // أول مصدر: البيانات العامة المحمّلة أصلًا في الصفحة.
    // هذا يجعل التعبئة تعمل حتى لو كانت قيمة barcode في قاعدة البيانات
    // تحتوي على فواصل/مسافات أو كان استعلام eq الصريح لا يطابقها.
    try {
      const publicProducts = (typeof products !== 'undefined' && Array.isArray(products)) ? products : [];
      publicProducts.forEach(product => addCandidate(product, 'primary'));
    } catch (_) {}

    // مصدر احتياطي من products، مع تطابق آمن بعد تنظيف الباركود محليًا.
    if (!candidates.length) {
      try {
        const { data, error } = await supabaseClient
          .from('products')
          .select('*')
          .eq('active', true)
          .not('barcode', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1000);
        if (error) throw error;
        (data || []).forEach(product => addCandidate(product, 'primary'));
      } catch (error) {
        console.warn('Barcode template primary lookup:', error);
      }
    }

    // الباركودات الإضافية: نستخدمها كمصدر بيانات فقط.
    // لا نأخذ product_id منها لربط المادة الجديدة، ولا نضع قيدًا مركزيًا.
    try {
      let aliasRows = null;
      let aliasError = null;

      ({ data: aliasRows, error: aliasError } = await supabaseClient
        .from('store_product_barcodes')
        .select('product_id,store_id,barcode')
        .eq('barcode', target)
        .limit(200));

      // fallback عند وجود باركود محفوظ بصيغة مختلفة؛ ننظفه محليًا.
      if (aliasError || !Array.isArray(aliasRows) || !aliasRows.length) {
        const fallback = await supabaseClient
          .from('store_product_barcodes')
          .select('product_id,store_id,barcode')
          .limit(1000);
        if (!fallback.error) {
          aliasRows = (fallback.data || []).filter(row => cleanBarcode(row?.barcode || '') === target);
        } else if (aliasError) {
          throw aliasError;
        }
      }

      const ids = [...new Set((aliasRows || []).map(x => x.product_id).filter(Boolean))];
      if (ids.length) {
        const { data: productsByAlias, error: productsError } = await supabaseClient
          .from('products')
          .select('*')
          .in('id', ids);
        if (productsError) throw productsError;
        (productsByAlias || []).forEach(product => {
          if (!product?.id || seen.has(String(product.id))) return;
          // المنتج المرتبط بالباركود الإضافي لا يشترط أن يحمل نفس barcode الأساسي.
          seen.add(String(product.id));
          candidates.push({ product, source: 'alias' });
        });
      }
    } catch (error) {
      console.warn('Barcode template alias lookup:', error);
    }

    if (!candidates.length) return null;

    // نستخدم آخر تحديث فعلي للسعر المتاح في الصفحة أولًا، ثم fallback من DB.
    const latestListingAt = new Map();
    try {
      const publicPrices = (typeof prices !== 'undefined' && Array.isArray(prices)) ? prices : [];
      publicPrices.forEach(row => {
        const id = String(row?.product_id || '');
        if (!id) return;
        const current = latestListingAt.get(id) || '';
        if (!current || new Date(row.updated_at || 0).getTime() > new Date(current || 0).getTime()) {
          latestListingAt.set(id, row.updated_at || '');
        }
      });
    } catch (_) {}

    const productIds = candidates.map(x => String(x.product.id));
    if (productIds.length) {
      try {
        const { data: listings, error: listingsError } = await supabaseClient
          .from('price_listings')
          .select('product_id,updated_at')
          .in('product_id', productIds)
          .order('updated_at', { ascending: false })
          .limit(500);
        if (listingsError) throw listingsError;
        (listings || []).forEach(row => {
          const id = String(row.product_id || '');
          if (!id || latestListingAt.has(id)) return;
          latestListingAt.set(id, row.updated_at || '');
        });
      } catch (error) {
        console.warn('Barcode template ordering:', error);
      }
    }

    candidates.sort((a, b) => {
      const timeOf = item => {
        const p = item.product || {};
        const created = new Date(p.created_at || 0).getTime() || 0;
        const listing = new Date(latestListingAt.get(String(p.id)) || 0).getTime() || 0;
        return Math.max(created, listing);
      };
      return timeOf(b) - timeOf(a);
    });

    return candidates[0] || null;
  }

  async function fillProductFromBarcode(barcode, storeId) {
    const code = cleanBarcode(barcode);
    if (!code) return;

    try {
      const scopedStoreId = storeId ||
        (typeof profileData !== 'undefined' && profileData?.store_id) ||
        window.__editingMaterial?.storeId ||
        el('merchantStoreSelect')?.value ||
        new URLSearchParams(location.search).get('store') || null;

      const barcodeStillCurrent = () => cleanBarcode(el('barcode')?.value) === code;

      if (!scopedStoreId) {
        const msg = el('barcodeMsg');
        if (msg) msg.textContent = 'تم إدخال الباركود. اختر المتجر ثم احفظ المادة.';
        return;
      }

      // أولاً: البحث داخل المتجر الحالي للحفاظ على السلوك السابق.
      let found = { row:null, matchedBy:null };
      if (typeof window.lookupStoreBarcode === 'function') {
        found = await window.lookupStoreBarcode(scopedStoreId, code);
      }

      const listing = found.row;
      const data = listing?.products || null;

      if (!barcodeStillCurrent()) return;

      if (data) {
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

        if (found.matchedBy === 'alias' && typeof window.setScannedStoreBarcodeForForm === 'function') {
          if (el('barcode')) el('barcode').value = cleanBarcode(data.barcode || '');
          await window.setScannedStoreBarcodeForForm(scopedStoreId, code, data.id);
        }

        const msg = el('barcodeMsg');
        if (msg) msg.textContent = found.matchedBy === 'alias'
          ? 'تم العثور على المادة بالباركود الإضافي وتعبئة بياناتها.'
          : 'تم العثور على المادة داخل هذا المتجر وتعبئة بياناتها.';
        return;
      }

      // ثانياً: البحث على مستوى المنصة كمصدر تعبئة فقط. لا نختار product_id
      // الموجود في متجر آخر، حتى تبقى بيانات المتجر مستقلة ولا يتحول الباركود
      // إلى معرف مركزي للمادة.
      const template = await findLatestGlobalBarcodeTemplate(code);
      if (!barcodeStillCurrent()) return;
      if (template?.product) {
        const data = template.product;
        const existing = el('existingProduct');
        if (existing) {
          existing.value = '';
          existing.dispatchEvent(new Event('change', { bubbles:true }));
        }

        ['pn','brand','unit','cat'].forEach(id => {
          if (el(id)) el(id).value = data[id] || '';
        });
        if (el('barcode')) el('barcode').value = code;
        if (el('merchantCompanySelect')) el('merchantCompanySelect').value = data.company_id || '';

        const msg = el('barcodeMsg');
        if (msg) msg.textContent = 'تم العثور على بيانات سابقة لهذا الباركود وتعبئتها تلقائياً. الباركود يبقى خاصاً بهذا المتجر.';
        return;
      }

      const existing = el('existingProduct');
      if (existing) {
        existing.value = '';
        existing.dispatchEvent(new Event('change', { bubbles:true }));
      }
      const msg = el('barcodeMsg');
      if (msg) msg.textContent = 'لم نجد بيانات سابقة لهذا الباركود. يمكنك إضافة مادة جديدة.';
    } catch (error) {
      console.error('Barcode product lookup:', error);
      const msg = el('barcodeMsg');
      if (msg) msg.textContent = 'تم إدخال الباركود، لكن تعذر جلب بياناته حالياً.';
    }
  }

  window.fillStoreMaterialFromBarcode = fillProductFromBarcode;

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
      let found={row:null,matchedBy:null};
      if(typeof window.lookupStoreBarcode==='function') {
        found=await window.lookupStoreBarcode(storeId,barcode);
      } else {
        const {data:listings,error:priceError}=await supabaseClient
          .from('price_listings')
          .select('id,price_new,store_id,product_id,approved,updated_at,products(*)')
          .eq('store_id',storeId).eq('approved',true).order('updated_at',{ascending:false});
        if(priceError) throw priceError;
        const listing=(Array.isArray(listings)?listings:[]).find(row=>cleanBarcode(row?.products?.barcode||row?.barcode||'')===barcode);
        found={row:listing||null,matchedBy:listing?'primary':null};
      }
      const listing=found.row;
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

        <div class="barcode-product-identity">
          ${
            product.image_url
              ? `
                <img
                  src="${escapeHtml(product.image_url)}"
                  alt="${escapeHtml(product.name || 'المادة')}"
                  class="barcode-product-image"
                >
              `
              : '<div class="barcode-product-image barcode-product-image-empty">مادة</div>'
          }

          <h2 class="barcode-product-name">
            ${escapeHtml(
              product.name || 'المادة'
            )}
          </h2>
        </div>

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
          background:#fff;
          color:#1e3a49;
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