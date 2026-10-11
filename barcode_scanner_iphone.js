/* سعرلي سوريا — barcode_scanner_iphone.js
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

  let scannerMode = null;
  let scannerStoreId = null;
  let scannerCompanyId = null;
  let scanLocked = false;
  let cameraStream = null;
  let cameraVideo = null;
  let scanCanvas = null;
  let scanContext = null;
  let scanFrameHandle = 0;
  let scanLoopActive = false;
  let scanDecodeBusy = false;
  let scannerAttemptToken = 0;
  let zxingWasmPromise = null;
  let pendingBarcode = '';
  let pendingBarcodeHits = 0;
  let pendingBarcodeAt = 0;
  let invalidReadReported = false;
  let scannerOpenedAt = 0;
  let lastDecodeAt = 0;

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

  // قارئ موحد للأنواع التجارية المطلوبة، بملف مستقل لهذا النظام.
  // ZXing-C++ WebAssembly pinned to 3.1.5: https://github.com/Sec-ant/zxing-wasm
  const BARCODE_PLATFORM = 'iphone';
  const BARCODE_PROFILE = BARCODE_PLATFORM === 'iphone'
    ? { decodeIntervalMs: 70, maxProcessingWidth: 1600 }
    : { decodeIntervalMs: 90, maxProcessingWidth: 1280 };
  const ZXING_READER_SOURCES = [
    'https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.5/dist/iife/reader/index.js',
    'https://unpkg.com/zxing-wasm@3.1.5/dist/iife/reader/index.js'
  ];
  const ZXING_READER_OPTIONS = {
    formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE'],
    tryHarder: true,
    maxNumberOfSymbols: 1
  };

  function loadZXingWasm() {
    if (window.ZXingWASM && typeof window.ZXingWASM.readBarcodes === 'function') {
      return Promise.resolve(window.ZXingWASM);
    }
    if (zxingWasmPromise) return zxingWasmPromise;

    function loadSource(index) {
      if (window.ZXingWASM && typeof window.ZXingWASM.readBarcodes === 'function') {
        return Promise.resolve(window.ZXingWASM);
      }
      if (index >= ZXING_READER_SOURCES.length) {
        return Promise.reject(new Error('تعذر تحميل محرك ZXing-WASM من مصادر CDN المتاحة.'));
      }
      return new Promise(function (resolve, reject) {
        const script = document.createElement('script');
        let finished = false;
        const timer = setTimeout(fallback, 12000);

        function fallback() {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          script.onload = null;
          script.onerror = null;
          script.remove();
          loadSource(index + 1).then(resolve, reject);
        }

        script.async = true;
        script.src = ZXING_READER_SOURCES[index];
        script.onload = function () {
          if (finished) return;
          if (window.ZXingWASM && typeof window.ZXingWASM.readBarcodes === 'function') {
            finished = true;
            clearTimeout(timer);
            resolve(window.ZXingWASM);
          } else {
            fallback();
          }
        };
        script.onerror = fallback;
        document.head.appendChild(script);
      });
    }

    zxingWasmPromise = loadSource(0).catch(function (error) {
      zxingWasmPromise = null;
      throw error;
    });
    return zxingWasmPromise;
  }

  function hasValidRetailCheckDigit(value) {
    const code = cleanBarcode(value);
    if (!/^\d+$/.test(code) || ![8, 12, 13].includes(code.length)) return false;

    const digits = code.split('').map(Number);
    const checkDigit = digits.pop();
    let sum = 0;
    // EAN-8 وEAN-13 وUPC-A تستخدم وزن 3 ثم 1 بالتناوب
    // ابتداءً من آخر رقم قبل خانة التدقيق.
    for (let i = digits.length - 1, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
      sum += digits[i] * weight;
    }
    return ((10 - (sum % 10)) % 10) === checkDigit;
  }

  function isValidUpcE(code) {
    // UPC-E يتكون من رقم نظام (0 أو 1)، وستة أرقام مضغوطة، ورقم تدقيق.
    if (!/^\d{8}$/.test(code) || !/^[01]/.test(code)) return false;

    const numberSystem = code[0];
    const x1 = code[1];
    const x2 = code[2];
    const x3 = code[3];
    const x4 = code[4];
    const x5 = code[5];
    const x6 = code[6];
    const checkDigit = code[7];
    let upcABody;

    // فك ضغط أصفار UPC-E إلى جسم UPC-A ذي 11 رقمًا قبل رقم التدقيق.
    if (x6 >= '0' && x6 <= '2') {
      upcABody = numberSystem + x1 + x2 + x6 + '0000' + x3 + x4 + x5;
    } else if (x6 === '3') {
      upcABody = numberSystem + x1 + x2 + x3 + '00000' + x4 + x5;
    } else if (x6 === '4') {
      upcABody = numberSystem + x1 + x2 + x3 + x4 + '00000' + x5;
    } else {
      upcABody = numberSystem + x1 + x2 + x3 + x4 + x5 + '0000' + x6;
    }

    return hasValidRetailCheckDigit(upcABody + checkDigit);
  }

  function getDecodedBarcodeFormat(decodedResult) {
    const format = decodedResult?.result?.format?.formatName ||
      decodedResult?.format?.formatName ||
      decodedResult?.format ||
      decodedResult?.result?.formatName || '';
    return String(format).toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function getValidRetailBarcode(value, decodedResult) {
    const code = cleanBarcode(value);
    if (!/^\d+$/.test(code)) return '';

    const format = getDecodedBarcodeFormat(decodedResult);

    // بعض المحركات قد تُرجع UPC-A ذا 12 رقمًا بصيغة 13 رقمًا تبدأ بصفر.
    // نحذف الصفر فقط عندما يصرّح المحرك بأن الصيغة UPC-A ويصحّ رقم التدقيق.
    if (format === 'UPCA') {
      if (code.length === 12 && hasValidRetailCheckDigit(code)) return code;
      if (code.length === 13 && code[0] === '0' && hasValidRetailCheckDigit(code.slice(1))) {
        return code.slice(1);
      }
      return '';
    }

    if (format === 'UPCE') {
      return code.length === 8 && isValidUpcE(code) ? code : '';
    }
    if (format === 'EAN8') {
      return code.length === 8 && hasValidRetailCheckDigit(code) ? code : '';
    }
    if (format === 'EAN13') {
      return code.length === 13 && hasValidRetailCheckDigit(code) ? code : '';
    }

    // توافق مع بعض المتصفحات/إصدارات المكتبات التي لا تعيد اسم الصيغة.
    if (code.length === 8) {
      return (hasValidRetailCheckDigit(code) || isValidUpcE(code)) ? code : '';
    }
    if (code.length === 12 || code.length === 13) {
      return hasValidRetailCheckDigit(code) ? code : '';
    }
    return '';
  }

  async function stopCameraStream() {
    scanLoopActive = false;
    if (scanFrameHandle) {
      cancelAnimationFrame(scanFrameHandle);
      scanFrameHandle = 0;
    }
    const oldStream = cameraStream;
    cameraStream = null;
    if (cameraVideo) {
      try { cameraVideo.pause(); } catch (_) {}
      try { cameraVideo.srcObject = null; } catch (_) {}
      cameraVideo.remove();
      cameraVideo = null;
    }
    if (oldStream) {
      oldStream.getTracks().forEach(function (track) {
        try { track.stop(); } catch (_) {}
      });
    }
    scanCanvas = null;
    scanContext = null;
    scanDecodeBusy = false;
  }

  function createScannerPreview(reader) {
    reader.replaceChildren();
    const video = document.createElement('video');
    video.id = 'barcodeCameraVideo';
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('muted', '');
    video.setAttribute('aria-label', 'معاينة كاميرا قارئ الباركود');

    const frame = document.createElement('div');
    frame.className = 'barcode-viewfinder';
    frame.setAttribute('aria-hidden', 'true');
    const laser = document.createElement('div');
    laser.className = 'barcode-scan-line';
    frame.appendChild(laser);

    reader.append(video, frame);
    cameraVideo = video;
    scanCanvas = document.createElement('canvas');
    scanContext = scanCanvas.getContext('2d', { willReadFrequently: true });
    return video;
  }

  async function requestRearCameraStream() {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      throw new Error('المتصفح لا يدعم فتح الكاميرا مباشرة. افتح الموقع بمتصفح حديث عبر HTTPS.');
    }

    const highQualityConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 30 }
      }
    };
    try {
      return await navigator.mediaDevices.getUserMedia(highQualityConstraints);
    } catch (firstError) {
      // بعض برامج تشغيل كاميرا Android/Samsung لا تقبل كل قيود الدقة؛
      // نعيد المحاولة بقيود أبسط بدل تبديل محرك فك الترميز.
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } }
        });
      } catch (secondError) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter(function (device) {
            return device.kind === 'videoinput' && device.deviceId;
          });
          const backCamera = videoInputs.find(function (device) {
            return /back|rear|environment|world|خلف/i.test(device.label || '');
          });
          const selected = backCamera || videoInputs[videoInputs.length - 1];
          if (selected) {
            return await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: { deviceId: { exact: selected.deviceId } }
            });
          }
        } catch (_) {}
        throw secondError || firstError;
      }
    }
  }

  async function requestContinuousFocus(stream) {
    try {
      const track = stream.getVideoTracks()[0];
      if (!track || typeof track.getCapabilities !== 'function' || typeof track.applyConstraints !== 'function') return;
      const capabilities = track.getCapabilities();
      const advanced = [];
      if (Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
        advanced.push({ focusMode: 'continuous' });
      }
      if (Array.isArray(capabilities.exposureMode) && capabilities.exposureMode.includes('continuous')) {
        advanced.push({ exposureMode: 'continuous' });
      }
      if (Array.isArray(capabilities.whiteBalanceMode) && capabilities.whiteBalanceMode.includes('continuous')) {
        advanced.push({ whiteBalanceMode: 'continuous' });
      }
      if (advanced.length) await track.applyConstraints({ advanced: advanced });
    } catch (error) {
      // بعض المتصفحات لا تعرض إعدادات التركيز؛ عدم دعمها لا يوقف الكاميرا.
      console.debug('Continuous camera focus is not configurable on this device.', error);
    }
  }

  function acceptDecodedRetailCode(decoded) {
    if (!decoded || scanLocked) return false;
    const barcode = getValidRetailBarcode(decoded.text, decoded);
    if (!barcode) {
      if (!invalidReadReported) {
        invalidReadReported = true;
        setStatus('القراءة غير مكتملة؛ اجعل الباركود كاملًا داخل الإطار الأصفر.');
      }
      return false;
    }

    const now = Date.now();
    if (pendingBarcode === barcode && now - pendingBarcodeAt <= 2200) {
      pendingBarcodeHits += 1;
    } else {
      pendingBarcode = barcode;
      pendingBarcodeHits = 1;
    }
    pendingBarcodeAt = now;

    // تأكيد القراءة مرتين لتقليل نتائج الإطار العابر أو الرقم المشوش.
    if (pendingBarcodeHits < 2) {
      setStatus('تم التقاط الباركود؛ جارٍ تأكيد الرقم...');
      return false;
    }

    scanLocked = true;
    scanLoopActive = false;
    setStatus('تم تأكيد الباركود، جارٍ البحث...');
    handleBarcode(barcode);
    return true;
  }

  async function startScanner() {
    const reader = el('barcodeReader');
    if (!reader) return;
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      setStatus('الكاميرا تحتاج فتح الموقع عبر HTTPS.');
      return;
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setStatus('هذا المتصفح لا يوفّر الكاميرا للموقع؛ حدّث المتصفح أو افتح الموقع عبر HTTPS.');
      return;
    }

    scanLoopActive = false;
    const token = ++scannerAttemptToken;
    pendingBarcode = '';
    pendingBarcodeHits = 0;
    pendingBarcodeAt = 0;
    invalidReadReported = false;
    scannerOpenedAt = Date.now();
    lastDecodeAt = 0;
    setStatus('جاري فتح الكاميرا وتحميل محرك القراءة...');

    // تحويل رفض التحميل إلى نتيجة منتظرة يمنع unhandled rejection أثناء فتح الكاميرا.
    const enginePromise = loadZXingWasm().catch(function (error) { return { __loadError: error }; });
    let stream = null;
    try {
      const video = createScannerPreview(reader);
      stream = await requestRearCameraStream();
      if (token !== scannerAttemptToken) {
        stream.getTracks().forEach(function (track) { track.stop(); });
        return;
      }
      cameraStream = stream;
      video.srcObject = stream;
      await video.play();
      await requestContinuousFocus(stream);

      setStatus('الكاميرا تعمل؛ جارٍ تجهيز القراءة السريعة...');
      const engineResult = await enginePromise;
      if (engineResult && engineResult.__loadError) throw engineResult.__loadError;
      const decoder = engineResult;
      if (token !== scannerAttemptToken) return;

      // تهيئة WebAssembly أثناء بدء الكاميرا حتى لا تتأخر أول قراءة فعلية.
      // إذا تعذّر ملف WASM على CDN الأول، نعيد تهيئته من unpkg بنفس الإصدار والمحرك.
      const warmupImage = scanContext.createImageData(32, 32);
      try {
        await decoder.readBarcodes(warmupImage, ZXING_READER_OPTIONS);
      } catch (primaryWasmError) {
        if (typeof decoder.prepareZXingModule !== 'function') throw primaryWasmError;
        await decoder.prepareZXingModule({
          overrides: {
            locateFile: function (path, prefix) {
              if (/zxing_reader\.wasm$/.test(path)) {
                return 'https://unpkg.com/zxing-wasm@3.1.5/dist/reader/zxing_reader.wasm';
              }
              return prefix + path;
            }
          },
          fireImmediately: true
        });
        await decoder.readBarcodes(warmupImage, ZXING_READER_OPTIONS);
      }
      if (token !== scannerAttemptToken) return;

      scanLoopActive = true;
      setStatus('ثبّت الباركود كاملًا داخل الإطار الأصفر لقراءة أسرع.');

      async function decodeCurrentFrame() {
        if (!cameraVideo || !scanContext || cameraVideo.readyState < 2 || !cameraVideo.videoWidth || !cameraVideo.videoHeight) return;
        const sourceWidth = cameraVideo.videoWidth;
        const sourceHeight = cameraVideo.videoHeight;
        // نفحص الحيز داخل الإطار فقط: يقلل الضجيج ويمنح خطوط الباركود حجمًا أكبر.
        const cropX = Math.floor(sourceWidth * 0.02);
        const cropY = Math.floor(sourceHeight * 0.24);
        const cropWidth = Math.max(1, Math.floor(sourceWidth * 0.96));
        const cropHeight = Math.max(1, Math.floor(sourceHeight * 0.52));
        const outputWidth = Math.min(BARCODE_PROFILE.maxProcessingWidth, cropWidth);
        const outputHeight = Math.max(120, Math.round(outputWidth * cropHeight / cropWidth));
        if (scanCanvas.width !== outputWidth || scanCanvas.height !== outputHeight) {
          scanCanvas.width = outputWidth;
          scanCanvas.height = outputHeight;
        }
        scanContext.imageSmoothingEnabled = true;
        scanContext.imageSmoothingQuality = 'high';
        scanContext.drawImage(cameraVideo, cropX, cropY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);
        const imageData = scanContext.getImageData(0, 0, outputWidth, outputHeight);
        const results = await window.ZXingWASM.readBarcodes(imageData, ZXING_READER_OPTIONS);
        if (token !== scannerAttemptToken || scanLocked) return;
        if (Array.isArray(results) && results.length) {
          for (const result of results) {
            if (acceptDecodedRetailCode(result)) break;
          }
        } else if (!pendingBarcodeHits && Date.now() - scannerOpenedAt > 12000) {
          setStatus('قرّب المنتج قليلًا، واجعل الخطوط أفقية وكاملة داخل الإطار الأصفر.');
        }
      }

      function scanTick(timestamp) {
        if (!scanLoopActive || token !== scannerAttemptToken) return;
        scanFrameHandle = requestAnimationFrame(scanTick);
        if (scanDecodeBusy || timestamp - lastDecodeAt < BARCODE_PROFILE.decodeIntervalMs) return;
        scanDecodeBusy = true;
        lastDecodeAt = timestamp;
        decodeCurrentFrame().catch(function (error) {
          console.warn('ZXing barcode frame decode failed:', error);
        }).finally(function () {
          scanDecodeBusy = false;
        });
      }
      scanFrameHandle = requestAnimationFrame(scanTick);
    } catch (error) {
      console.error('Barcode scanner startup failed:', error);
      if (stream) stream.getTracks().forEach(function (track) { try { track.stop(); } catch (_) {} });
      if (token === scannerAttemptToken) {
        const message = String(error?.message || error || '');
        if (/ZXing|WASM|load|script|network|fetch/i.test(message)) {
          setStatus('تعذر تحميل محرك قراءة الباركود. تحقق من اتصال الإنترنت ثم أعد المحاولة.');
        } else if (/NotAllowedError|Permission|denied|SecurityError/i.test(message)) {
          setStatus('اسمح للموقع باستخدام الكاميرا من إعدادات المتصفح ثم أعد المحاولة.');
        } else {
          setStatus('تعذر فتح الكاميرا. أغلق أي تطبيق يستخدمها ثم أعد المحاولة.');
        }
        await stopCameraStream();
      }
    }
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
            height:auto;
            aspect-ratio:16/10;
            max-height:42vh;
            min-height:190px;
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

    // إطار أصفر وخط مسح أحمر، متزامنان تقريبًا مع منطقة الصورة التي يفحصها المحرك.
    let cameraVideoStyle = el('barcodeCameraVideoStyle');
    if (!cameraVideoStyle) {
      cameraVideoStyle = document.createElement('style');
      cameraVideoStyle.id = 'barcodeCameraVideoStyle';
      document.head.appendChild(cameraVideoStyle);
    }
    cameraVideoStyle.textContent = `
      #barcodeReader {
        position:relative !important;
        height:auto !important;
        aspect-ratio:16/10 !important;
        max-height:42vh !important;
        min-height:190px !important;
        background:#000 !important;
        isolation:isolate;
      }
      #barcodeReader video {
        position:absolute !important;
        inset:0 !important;
        width:100% !important;
        height:100% !important;
        object-fit:cover !important;
        display:block !important;
        background:#000 !important;
      }
      .barcode-viewfinder {
        position:absolute;
        z-index:4;
        left:3%;
        top:24%;
        width:94%;
        height:52%;
        box-sizing:border-box;
        border:3px solid #ffd400;
        border-radius:8px;
        box-shadow:0 0 0 999px rgba(0,0,0,.12), 0 0 14px rgba(255,212,0,.25);
        overflow:hidden;
        pointer-events:none;
      }
      .barcode-scan-line {
        position:absolute;
        left:0;
        right:0;
        top:1%;
        height:2px;
        background:#ff3030;
        box-shadow:0 0 7px 2px rgba(255,35,35,.7);
        animation:barcodeLaserSweep 1.45s ease-in-out infinite alternate;
      }
      @keyframes barcodeLaserSweep {
        from { top:2%; }
        to { top:96%; }
      }
      @media (prefers-reduced-motion: reduce) {
        .barcode-scan-line { animation-duration:3s; }
      }
    `;

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

    startScanner();
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

  window.closeBarcodeScanner = async function () {
    scannerAttemptToken += 1;
    scanLoopActive = false;
    if (scanFrameHandle) {
      cancelAnimationFrame(scanFrameHandle);
      scanFrameHandle = 0;
    }
    const oldStream = cameraStream;
    cameraStream = null;
    if (cameraVideo) {
      try { cameraVideo.pause(); } catch (_) {}
      try { cameraVideo.srcObject = null; } catch (_) {}
      cameraVideo.remove();
      cameraVideo = null;
    }
    if (oldStream) {
      oldStream.getTracks().forEach(function (track) {
        try { track.stop(); } catch (error) { console.debug('Camera track stop:', error); }
      });
    }
    scanCanvas = null;
    scanContext = null;
    scanDecodeBusy = false;
    scanLocked = false;
    pendingBarcode = '';
    pendingBarcodeHits = 0;
    const modal = el('barcodeScannerModal');
    if (modal) modal.remove();
    const style = el('barcodeCameraVideoStyle');
    if (style) style.remove();
  };

})();