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

  function fillMaterialFieldsFromBarcodeData(data) {
    const values = {
      pn: data?.name || '',
      brand: data?.brand || '',
      unit: data?.unit || '',
      cat: data?.category || ''
    };

    const apply = () => {
      Object.entries(values).forEach(([id, value]) => {
        const field = el(id);
        if (!field) return;
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };

    // نطبّق القيم الآن وبعد أي change listener آخر على قائمة المادة،
    // حتى لا يقوم مستمع الواجهة بإعادة ضبط الحقول بعد التعبئة.
    apply();
    requestAnimationFrame(apply);
    setTimeout(apply, 0);
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

  async function openScanner() {
    // مهم: انتظر إيقاف أي كاميرا سابقة قبل إنشاء قارئ جديد.
    // بعض أجهزة Android/Samsung تعطي شاشة سوداء إذا تم فتح كاميرتين
    // خلال لحظة واحدة.
    try {
      await window.closeBarcodeScanner();
    } catch (error) {
      console.warn('Previous scanner cleanup failed:', error);
    }

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
            height:min(58vh, 520px);
            min-height:230px;
            background:#000;
            border-radius:15px;
            overflow:hidden;
            position:relative;
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

    // اجعل فيديو الكاميرا يملأ مساحة المعاينة بدون هوامش سوداء داخلية.
    const cameraVideoStyle = document.createElement('style');
    cameraVideoStyle.id = 'barcodeCameraVideoStyle';
    cameraVideoStyle.textContent = `
      #barcodeReader video {
        width:100% !important;
        height:100% !important;
        object-fit:cover !important;
        display:block !important;
      }
      #barcodeReader__scan_region {
        width:100% !important;
        height:100% !important;
      }
      #barcodeReader__dashboard_section_csr {
        display:none !important;
      }
    `;
    document.head.appendChild(cameraVideoStyle);

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

  async function startScanner() {
    if (!window.Html5Qrcode) {
      setStatus('تعذر تحميل قارئ الباركود.');
      return;
    }

    const reader = el('barcodeReader');
    if (!reader) return;

    if (!window.isSecureContext && location.hostname !== 'localhost') {
      setStatus('الكاميرا تحتاج فتح الموقع عبر HTTPS.');
      return;
    }

    try {
      scanner = new window.Html5Qrcode('barcodeReader');
    } catch (error) {
      console.error('Scanner constructor error:', error);
      setStatus('تعذر تشغيل قارئ الباركود.');
      return;
    }

    const config = {
      // رفع عدد محاولات القراءة يساعد الأجهزة الأبطأ في التقاط الباركود
      // من دون تقليل مساحة المعاينة.
      fps: 15,

      // اجعل منطقة القراءة هي كامل الفيديو فعليًا. لا يوجد مربع صغير
      // في المنتصف، وبالتالي يمكن قراءة الباركود من أي مكان داخل الصورة.
      qrbox: function (viewfinderWidth, viewfinderHeight) {
        return {
          width: Math.floor(viewfinderWidth),
          height: Math.floor(viewfinderHeight)
        };
      },

      // لا نفرض aspectRatio ثابتًا؛ بعض أجهزة Android تعطي نسبًا مختلفة.
      // نطلب دقة مناسبة للباركود مع التركيز المستمر إن كان مدعومًا.
      videoConstraints: {
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        focusMode: { ideal: 'continuous' }
      },

      // السماح بقلب الصورة في حال كان اتجاه الكاميرا مختلفًا على الجهاز.
      disableFlip: false
    };

    const onSuccess = function (decodedText) {
      if (scanLocked) return;

      const barcode = cleanBarcode(decodedText);
      if (!barcode) return;

      scanLocked = true;
      handleBarcode(barcode);
    };

    const onError = function () {
      // تجاهل أخطاء عدم وجود باركود في الإطار الحالي.
    };

    // نبدأ بـ ideal بدل exact لأن بعض أجهزة Android تعتبر exact غير مدعوم
    // رغم أن الكاميرا الخلفية موجودة، فينتقل الكود بالخطأ إلى الكاميرا الأمامية.
    try {
      await scanner.start(
        { facingMode: { ideal: 'environment' } },
        config,
        onSuccess,
        onError
      );
      setStatus('الكاميرا الخلفية تعمل — وجّهها نحو الباركود');
      return;
    } catch (environmentError) {
      console.warn('Environment camera start failed:', environmentError);
    }

    // fallback: ابحث عن الكاميرا الخلفية بالاسم، ولا تستخدم آخر كاميرا
    // بشكل أعمى لأن بعض الأجهزة ترتب الكاميرا الأمامية في آخر القائمة.
    try {
      const cameras = await window.Html5Qrcode.getCameras();
      if (Array.isArray(cameras) && cameras.length) {
        const rear = cameras.filter(function (camera) {
          const label = String(camera?.label || '').toLowerCase();
          return /back|rear|environment|ultra.?wide|wide|tele|خلف|خلفية/.test(label);
        });

        const unknown = cameras.filter(function (camera) {
          return rear.indexOf(camera) === -1;
        });

        // نعطي الكاميرات المسماة خلفية الأولوية، ثم نجرب بقية الكاميرات
        // واحدًا واحدًا بدل اختيار كاميرا عشوائية.
        const candidates = rear.concat(unknown);

        for (const camera of candidates) {
          try {
            await scanner.start(camera.id, config, onSuccess, onError);

            // إذا كانت المكتبة/المتصفح يعيد facingMode، نرفض الأمامية.
            let settings = {};
            try {
              settings = scanner.getRunningTrackSettings?.() || {};
            } catch (_) {}

            const facing = String(settings.facingMode || '').toLowerCase();
            const label = String(camera?.label || '').toLowerCase();
            const looksRear = /back|rear|environment|ultra.?wide|wide|tele|خلف|خلفية/.test(label);

            if (facing === 'user' && !looksRear) {
              await scanner.stop().catch(() => {});
              continue;
            }

            setStatus('الكاميرا الخلفية تعمل — وجّهها نحو الباركود');
            return;
          } catch (candidateError) {
            console.warn('Camera candidate failed:', candidateError);
            try {
              await scanner.stop();
            } catch (_) {}
          }
        }
      }
    } catch (cameraListError) {
      console.warn('Camera list/deviceId start failed:', cameraListError);
    }

    // fallback أخير للأجهزة التي لا تسمح إلا بـ ideal.
    try {
      await scanner.start(
        { facingMode: { ideal: 'environment' } },
        config,
        onSuccess,
        onError
      );
      setStatus('الكاميرا تعمل — وجّهها نحو الباركود');
      return;
    } catch (error) {
      console.error('Camera start error:', error);
      setStatus('لم تفتح الكاميرا. اسمح بالوصول للكاميرا أو أعد المحاولة.');
    }
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
      if (typeof window.validateStorePrimaryBarcode === 'function') {
        await window.validateStorePrimaryBarcode();
      }
      return;
    }

    if (mode === 'additional') {
      const added = typeof window.addScannedStoreAdditionalBarcode === 'function'
        ? await window.addScannedStoreAdditionalBarcode(clean)
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
    const addCandidate = (product, source, when) => {
      if (!product?.id || seen.has(String(product.id))) return;
      if (cleanBarcode(product.barcode || '') !== target) return;
      seen.add(String(product.id));
      candidates.push({ product, source, when: when || product.created_at || null });
    };

    // 1) استخدم البيانات المحمّلة أصلًا في الصفحة.
    try {
      const publicProducts = (typeof products !== 'undefined' && Array.isArray(products)) ? products : [];
      publicProducts.forEach(product => addCandidate(product, 'primary', product.created_at));
    } catch (_) {}

    // 2) بحث مباشر في products بالباركود نفسه، بدون ربط المنتج بمتجر آخر.
    // لا نعتمد على active فقط لأن المنتج القديم قد يكون غير نشط لكنه ما يزال
    // مصدرًا صالحًا لاقتراح البيانات.
    try {
      const { data, error } = await supabaseClient
        .from('products')
        .select('*')
        .eq('barcode', target)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error) (data || []).forEach(product => addCandidate(product, 'primary', product.created_at));
    } catch (error) {
      console.warn('Barcode template direct lookup:', error);
    }

    // 3) إذا كانت قيمة الباركود مخزنة بصيغة فيها مسافات/رموز، نحمل مجموعة
    // معقولة ونطابقها بعد تنظيفها محليًا.
    if (!candidates.length) {
      try {
        const { data, error } = await supabaseClient
          .from('products')
          .select('*')
          .not('barcode', 'is', null)
          .order('created_at', { ascending: false })
          .limit(2000);
        if (!error) (data || []).forEach(product => addCandidate(product, 'primary', product.created_at));
      } catch (error) {
        console.warn('Barcode template normalized lookup:', error);
      }
    }

    // 4) الباركودات الإضافية مصدر بيانات فقط. لا نستخدم product_id لربط
    // المادة الجديدة بمتجر آخر.
    try {
      const { data: aliasRows, error: aliasError } = await supabaseClient
        .from('store_product_barcodes')
        .select('product_id,store_id,barcode')
        .limit(5000);

      if (!aliasError && Array.isArray(aliasRows)) {
        const matches = aliasRows.filter(row => cleanBarcode(row?.barcode || '') === target);
        const ids = [...new Set(matches.map(x => x.product_id).filter(Boolean))];
        if (ids.length) {
          const { data: productsByAlias, error: productsError } = await supabaseClient
            .from('products')
            .select('*')
            .in('id', ids);
          if (!productsError) {
            (productsByAlias || []).forEach(product => {
              const match = matches.find(x => String(x.product_id) === String(product.id));
              addCandidate(product, 'alias', match?.created_at || product.created_at);
            });
          }
        }
      }
    } catch (error) {
      console.warn('Barcode template alias lookup:', error);
    }

    if (!candidates.length) return null;

    // الأحدث أولًا: تاريخ إنشاء المادة، وهو المرجع المتاح فعلًا بدون إنشاء
    // قيد مركزي جديد للباركود.
    candidates.sort((a, b) => {
      const ta = new Date(a.when || a.product?.created_at || 0).getTime() || 0;
      const tb = new Date(b.when || b.product?.created_at || 0).getTime() || 0;
      return tb - ta;
    });

    return candidates[0] || null;
  }

  async function findStoreBarcodeTemplate(storeId, code) {
    const target = cleanBarcode(code);
    if (!storeId || !target) return null;

    // لا نحصر البحث في approved=true هنا؛ الهدف تعبئة النموذج من مادة موجودة
    // في المتجر، وليس عرضها للزوار.
    try {
      const { data, error } = await supabaseClient
        .from('price_listings')
        .select('id,store_id,product_id,updated_at,approved,products(*)')
        .eq('store_id', storeId)
        .order('updated_at', { ascending: false })
        .limit(1000);
      if (!error) {
        const row = (data || []).find(r => cleanBarcode(r?.products?.barcode || r?.barcode || '') === target);
        if (row?.products) return { row, matchedBy: 'primary' };
      }
    } catch (error) {
      console.warn('Store barcode direct lookup:', error);
    }

    // الباركودات الإضافية داخل هذا المتجر.
    try {
      const { data: aliases, error: aliasError } = await supabaseClient
        .from('store_product_barcodes')
        .select('store_id,product_id,barcode')
        .eq('store_id', storeId)
        .limit(5000);
      if (!aliasError) {
        const matches = (aliases || []).filter(x => cleanBarcode(x?.barcode || '') === target);
        const ids = [...new Set(matches.map(x => x.product_id).filter(Boolean))];
        if (ids.length) {
          const { data: ps, error: pe } = await supabaseClient
            .from('products').select('*').in('id', ids);
          if (!pe && ps?.length) return {
            row: { product_id: ps[0].id, products: ps[0] },
            matchedBy: 'alias'
          };
        }
      }
    } catch (error) {
      console.warn('Store additional barcode direct lookup:', error);
    }

    return null;
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

      // أولاً: إذا كان المتجر معروفًا، نبحث داخله فقط للحفاظ على السلوك السابق.
      // إذا لم يكن storeId متاحًا بعد (خصوصًا في شاشة المدير)، لا نوقف العملية؛
      // لأن البحث العام أدناه هو مجرد تعبئة بيانات ولا يربط الباركود بأي متجر.
      let found = { row:null, matchedBy:null };
      if (scopedStoreId) {
        if (typeof window.lookupStoreBarcode === 'function') {
          try {
            found = await window.lookupStoreBarcode(scopedStoreId, code);
          } catch (lookupError) {
            console.warn('Scoped barcode lookup:', lookupError);
          }
        }

        // fallback مباشر للمتجر حتى تعمل التعبئة أيضًا إذا كانت المادة موجودة
        // لكن listing غير معتمد بعد أو لم تدخل ضمن القائمة العامة.
        if (!found.row) {
          const direct = await findStoreBarcodeTemplate(scopedStoreId, code);
          if (direct) found = direct;
        }
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

        fillMaterialFieldsFromBarcodeData(data);
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

      // ثانياً: استخدام دالة Supabase المخصصة للقراءة فقط.
      // هذه الدالة لا تنشئ علاقة بين المتاجر ولا تحجز الباركود؛
      // وظيفتها الوحيدة إعادة بيانات مادة سابقة لتعبئة النموذج.
      let rpcTemplate = null;
      try {
        const { data: rpcData, error: rpcError } = await supabaseClient.rpc(
          'saree_lookup_product_by_barcode',
          { p_barcode: code }
        );
        if (!rpcError && rpcData && typeof rpcData === 'object') {
          rpcTemplate = rpcData;
        } else if (rpcError) {
          console.warn('Barcode template RPC lookup:', rpcError);
        }
      } catch (error) {
        console.warn('Barcode template RPC lookup:', error);
      }

      if (!barcodeStillCurrent()) return;
      if (rpcTemplate) {
        const data = rpcTemplate;
        const existing = el('existingProduct');
        if (existing) {
          existing.value = '';
          existing.dispatchEvent(new Event('change', { bubbles:true }));
        }

        fillMaterialFieldsFromBarcodeData(data);
        if (el('barcode')) el('barcode').value = code;
        if (el('merchantCompanySelect')) el('merchantCompanySelect').value = data.company_id || '';

        // حقل اختيار الملف لا يمكن للمتصفح تعبئته برابط صورة لأسباب أمنية.
        // لذلك نحفظ رابط الصورة المسترجع مؤقتًا ونستخدمه عند الحفظ إذا لم
        // يختر المستخدم صورة جديدة.
        window.__barcodeTemplateImageUrl = data.image_url || null;
        const imagePreview = el('barcodeTemplateImagePreview');
        if (imagePreview) {
          imagePreview.innerHTML = data.image_url
            ? `<div class=\"notice\"><div class=\"muted\" style=\"margin-bottom:6px\">صورة المادة السابقة:</div><img src=\"${String(data.image_url).replace(/\"/g,'&quot;')}\" alt=\"\" style=\"max-width:120px;max-height:120px;border-radius:12px;object-fit:cover\"></div>`
            : '';
        }

        const msg = el('barcodeMsg');
        if (msg) msg.textContent = 'تم العثور على بيانات سابقة لهذا الباركود وتعبئتها تلقائياً. الباركود يبقى خاصاً بهذا المتجر.';
        return;
      }

      // احتياط للنسخ القديمة/البيانات التي يمكن قراءتها مباشرة من الواجهة.
      // لا يغيّر هذا أي علاقة بين المنتجات والمتاجر.
      const template = await findLatestGlobalBarcodeTemplate(code);
      if (!barcodeStillCurrent()) return;
      if (template?.product) {
        const data = template.product;
        const existing = el('existingProduct');
        if (existing) {
          existing.value = '';
          existing.dispatchEvent(new Event('change', { bubbles:true }));
        }

        fillMaterialFieldsFromBarcodeData(data);
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