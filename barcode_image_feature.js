/* سعرلي سوريا — ميزة قراءة باركودات متعددة من الصور.
   ملف مستقل: لا يعدّل قارئ الكاميرا أو يغيّر الباركود الأساسي.
*/
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[ch]));
  const normalize = value => String(value ?? '').replace(/\D/g, '').trim();
  const SETTINGS_TABLE = 'barcode_image_feature_settings';
  const COMPANY_ALIAS_TABLE = 'company_product_barcodes';
  const ADMIN_UID = 'fb610b6d-8b2b-4d6d-a957-dda26f1be4a2';
  let enabled = false;
  let settingLoaded = false;
  let settingError = '';
  let toggleError = '';
  let toggleBusy = false;
  let readerPromise = null;
  let applyTimer = null;

  function currentProfile() {
    try { return typeof profileData !== 'undefined' ? profileData : null; }
    catch (_) { return null; }
  }
  function currentRole() { return String(currentProfile()?.role || '').toLowerCase(); }
  function isAdmin() {
    return window.__SAREE_ADMIN_STATUS__ === true || currentProfile()?.is_admin === true || currentRole() === 'admin';
  }
  function canUseFeature() {
    const p = currentProfile();
    return isAdmin() || (currentRole() === 'store' && !!p?.store_id) || currentRole() === 'company';
  }
  function client() { return window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null); }

  async function loadSetting() {
    const db = client();
    if (!db) { settingError = 'تعذر الاتصال بقاعدة البيانات.'; settingLoaded = true; return; }
    try {
      const { data, error } = await db.from(SETTINGS_TABLE).select('enabled').eq('id', true).maybeSingle();
      if (error) throw error;
      enabled = data?.enabled === true;
      settingError = '';
    } catch (error) {
      enabled = false;
      settingError = 'نفّذ ملف barcode_image_feature.sql في Supabase أولاً. ' + (error?.message || '');
    } finally {
      settingLoaded = true;
      scheduleApply();
    }
  }

  const READER_SOURCES = [
    'https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.5/dist/iife/reader/index.js',
    'https://unpkg.com/zxing-wasm@3.1.5/dist/iife/reader/index.js'
  ];
  function loadReader() {
    if (window.ZXingWASM && typeof window.ZXingWASM.readBarcodes === 'function') return Promise.resolve(window.ZXingWASM);
    if (readerPromise) return readerPromise;
    readerPromise = new Promise((resolve, reject) => {
      let idx = 0;
      const attempt = () => {
        if (window.ZXingWASM && typeof window.ZXingWASM.readBarcodes === 'function') return resolve(window.ZXingWASM);
        if (idx >= READER_SOURCES.length) { readerPromise = null; return reject(new Error('تعذر تحميل محرك قراءة الباركود. تحقق من اتصال الإنترنت.')); }
        const src = READER_SOURCES[idx++];
        const script = document.createElement('script');
        let settled = false;
        const timer = setTimeout(() => finish(false), 12000);
        function finish(ok) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          script.onload = null;
          script.onerror = null;
          if (ok && window.ZXingWASM && typeof window.ZXingWASM.readBarcodes === 'function') resolve(window.ZXingWASM);
          else { script.remove(); attempt(); }
        }
        script.async = true;
        script.src = src;
        script.onload = () => finish(true);
        script.onerror = () => finish(false);
        document.head.appendChild(script);
      };
      attempt();
    }).catch(error => { readerPromise = null; throw error; });
    return readerPromise;
  }

  const READER_OPTIONS = {
    formats: [],
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    // 0 means the library should not limit the number of symbols per image.
    maxNumberOfSymbols: 0
  };

  function readWithFileReader(file) {
    return new Promise((resolve, reject) => {
      if (typeof FileReader === 'undefined') {
        reject(new Error('هذا المتصفح لا يدعم قراءة الملفات مباشرة.'));
        return;
      }
      const fr = new FileReader();
      fr.onload = () => {
        const result = fr.result;
        if (!(result instanceof ArrayBuffer) || result.byteLength === 0) {
          reject(new Error('الصورة فارغة أو تعذر الوصول إلى محتواها.'));
        } else resolve(new Uint8Array(result));
      };
      fr.onerror = () => reject(fr.error || new Error('تعذرت قراءة ملف الصورة من الهاتف.'));
      fr.onabort = () => reject(new Error('تم إلغاء قراءة الصورة.'));
      try { fr.readAsArrayBuffer(file); }
      catch (error) { reject(error); }
    });
  }

  async function readFileBytes(file) {
    // Some Android document providers hand Chrome a File handle that the WASM
    // decoder cannot read reliably. Copy the bytes first and pass a Uint8Array.
    if (typeof file.arrayBuffer === 'function') {
      try {
        const buffer = await file.arrayBuffer();
        if (buffer instanceof ArrayBuffer && buffer.byteLength > 0) return new Uint8Array(buffer);
      } catch (_) { /* Use FileReader as a compatibility fallback below. */ }
    }
    return readWithFileReader(file);
  }

  async function imageDataFromFile(file) {
    // Fallback path for mobile gallery/document providers and image formats
    // that cannot be consumed directly by the WebAssembly decoder.
    let bitmap = null;
    let objectUrl = '';
    try {
      if (typeof createImageBitmap === 'function') {
        try { bitmap = await createImageBitmap(file); }
        catch (_) { bitmap = null; }
      }
      // Some Android providers fail in createImageBitmap but still expose the
      // selected photo through an object URL in a regular HTMLImageElement.
      if (!bitmap) {
        objectUrl = URL.createObjectURL(file);
        bitmap = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error('تعذر فتح الصورة في المتصفح.'));
          image.src = objectUrl;
        });
      }
      const width = Number(bitmap.width || bitmap.naturalWidth || 0);
      const height = Number(bitmap.height || bitmap.naturalHeight || 0);
      if (!width || !height) throw new Error('أبعاد الصورة غير صالحة.');
      // Avoid excessive memory usage with high-resolution photos on phones.
      const scale = Math.min(1, 4096 / Math.max(width, height));
      const outWidth = Math.max(1, Math.round(width * scale));
      const outHeight = Math.max(1, Math.round(height * scale));
      let canvas, context;
      if (typeof OffscreenCanvas === 'function') {
        canvas = new OffscreenCanvas(outWidth, outHeight);
        context = canvas.getContext('2d', { willReadFrequently: true });
      } else {
        canvas = document.createElement('canvas');
        canvas.width = outWidth;
        canvas.height = outHeight;
        context = canvas.getContext('2d', { willReadFrequently: true });
      }
      if (!context) throw new Error('تعذر تجهيز الصورة للقراءة.');
      context.drawImage(bitmap, 0, 0, outWidth, outHeight);
      return context.getImageData(0, 0, outWidth, outHeight);
    } finally {
      if (bitmap && typeof bitmap.close === 'function') bitmap.close();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  function extractNumericCodes(results, found) {
    for (const item of (Array.isArray(results) ? results : [])) {
      const raw = String(item?.text || '').trim();
      if (item?.error || !/^\d{6,18}$/.test(raw)) continue;
      const code = normalize(raw);
      if (code && !found.includes(code)) found.push(code);
    }
  }

  async function decodeOneFile(reader, file, found) {
    let byteError = null;
    const countBefore = found.length;
    try {
      const bytes = await readFileBytes(file);
      const results = await reader.readBarcodes(bytes, READER_OPTIONS);
      extractNumericCodes(results, found);
      if (found.length > countBefore) return;
      // If the raw image decoded but yielded no symbol, try browser image decoding
      // as some Android gallery providers/encodings behave differently.
    } catch (error) { byteError = error; }

    try {
      const imageData = await imageDataFromFile(file);
      const results = await reader.readBarcodes(imageData, READER_OPTIONS);
      extractNumericCodes(results, found);
    } catch (imageError) {
      const reason = imageError?.message || byteError?.message || 'تعذرت قراءة الصورة.';
      throw new Error(reason);
    }
  }

  async function decodeFiles(fileList) {
    const files = Array.from(fileList || []).filter(file => {
      if (!file || typeof file.size === 'number' && file.size <= 0) return false;
      const type = String(file.type || '').toLowerCase();
      const name = String(file.name || '').toLowerCase();
      // Android's photo picker may return an empty MIME type for a valid image.
      return type.startsWith('image/') || !type || /\.(jpe?g|png|webp|gif|bmp|tiff?|heic|heif|avif)$/i.test(name);
    });
    if (!files.length) return [];
    const reader = await loadReader();
    const found = [];
    const errors = [];
    for (const file of files) {
      try { await decodeOneFile(reader, file, found); }
      catch (error) { errors.push(`${file.name || 'الصورة'}: ${error?.message || error}`); }
    }
    if (!found.length && errors.length === files.length) {
      throw new Error('تعذرت قراءة الصور المختارة. أغلق نافذة الصور وأعد اختيارها، أو جرّب حفظ الصورة في الجهاز ثم اختيارها من جديد. ' + errors[0]);
    }
    return found;
  }

  function ensureStyles() {
    if ($('barcodeImageFeatureStyle')) return;
    const style = document.createElement('style');
    style.id = 'barcodeImageFeatureStyle';
    style.textContent = `
      .barcode-image-feature{margin-top:10px;padding:10px;border:1px dashed #46545b;border-radius:12px;background:#0d1418}
      .barcode-image-feature .barcode-image-file{margin-top:7px}
      .barcode-image-feature .barcode-image-status{font-size:12px;line-height:1.7;margin-top:7px;color:#9da9ae}
      .barcode-image-feature .barcode-image-codes{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
      .barcode-image-feature .barcode-image-code{display:inline-flex;align-items:center;gap:5px;border:1px solid #365344;background:#183b2b;color:#baf5d0;padding:4px 7px;border-radius:8px;font-size:12px}
      .barcode-image-feature .barcode-image-code button{border:0;background:transparent;color:inherit;cursor:pointer;font-size:16px;padding:0 2px}
    `;
    document.head.appendChild(style);
  }

  function renderCompanyCodes(host) {
    const list = host.querySelector('[data-barcode-image-list]');
    if (!list) return;
    const codes = Array.isArray(host.__barcodeImageCodes) ? host.__barcodeImageCodes : [];
    list.innerHTML = codes.length
      ? codes.map((code, index) => `<span class="barcode-image-code">${esc(code)}<button type="button" data-remove-company-image-code="${index}" aria-label="حذف الباركود الإضافي">×</button></span>`).join('')
      : '<span class="muted">لا توجد باركودات إضافية من الصور.</span>';
    list.querySelectorAll('[data-remove-company-image-code]').forEach(button => {
      button.onclick = () => {
        const index = Number(button.dataset.removeCompanyImageCode);
        host.__barcodeImageCodes.splice(index, 1);
        renderCompanyCodes(host);
      };
    });
  }

  async function checkCompanyCodeConflict(companyId, code, productId) {
    const db = client();
    const [primaryResult, aliasResult] = await Promise.all([
      db.from('company_products').select('id').eq('company_id', companyId).eq('barcode', code),
      db.from(COMPANY_ALIAS_TABLE).select('company_product_id').eq('company_id', companyId).eq('barcode', code)
    ]);
    if (primaryResult.error) throw primaryResult.error;
    if (aliasResult.error) throw aliasResult.error;
    const primaryConflict = (primaryResult.data || []).some(row => String(row.id) !== String(productId || ''));
    const aliasConflict = (aliasResult.data || []).some(row => String(row.company_product_id) !== String(productId || ''));
    return primaryConflict || aliasConflict;
  }

  async function addCompanyCodes(host, codes) {
    const status = host.querySelector('[data-barcode-image-status]');
    const companyId = host.dataset.companyId;
    const productId = host.dataset.productId || null;
    const primary = normalize($('cep_barcode')?.value || $('admin_cep_barcode')?.value || host.dataset.primaryBarcode || '');
    let added = 0;
    const duplicates = [];
    for (const code of codes) {
      if (code === primary || (host.__barcodeImageCodes || []).includes(code)) { duplicates.push(code); continue; }
      try {
        if (companyId && await checkCompanyCodeConflict(companyId, code, productId)) { duplicates.push(code); continue; }
      } catch (error) {
        if (status) status.textContent = 'تعذر التحقق من بعض الباركودات: ' + (error?.message || error);
        continue;
      }
      host.__barcodeImageCodes.push(code);
      added++;
    }
    renderCompanyCodes(host);
    if (status) status.textContent = `اكتُشف ${codes.length} باركود؛ أُضيف ${added}${duplicates.length ? `، وتُرك ${duplicates.length} لأنه مكرر أو أساسي` : ''}.`;
  }

  function createCompanyControl(host, args) {
    ensureStyles();
    host.__barcodeImageCodes = [];
    host.dataset.barcodeImageFeatureInitialized = 'true';
    host.dataset.barcodeImageFeatureKey = `${args.companyId || ''}:${args.productId || ''}:${enabled ? 'on' : 'off'}`;
    host.dataset.companyId = String(args.companyId || host.dataset.companyId || '');
    host.dataset.productId = String(args.productId || host.dataset.productId || '');
    host.dataset.productName = String(args.productName || host.dataset.productName || '');
    host.dataset.primaryBarcode = String(args.primaryBarcode || host.dataset.primaryBarcode || '');
    if (!settingLoaded || !enabled || !canUseFeature()) { host.innerHTML = ''; return; }
    host.innerHTML = `
      <div class="barcode-image-feature" dir="rtl">
        <label class="muted">إضافة باركودات إضافية من الصور (عدد مفتوح)</label>
        <input class="barcode-image-file" type="file" accept="image/*" multiple data-company-image-files>
        <div class="barcode-image-status" data-barcode-image-status>يمكن اختيار صورة واحدة أو عدة صور. لن يتغير الباركود الأساسي.</div>
        <div class="barcode-image-codes" data-barcode-image-list></div>
      </div>`;
    renderCompanyCodes(host);
    const fileInput = host.querySelector('[data-company-image-files]');
    fileInput.addEventListener('change', async () => {
      const files = Array.from(fileInput.files || []);
      const status = host.querySelector('[data-barcode-image-status]');
      if (!files.length) return;
      if (status) status.textContent = `جاري فحص ${files.length} صورة...`;
      try {
        const codes = await decodeFiles(files);
        if (!codes.length) {
          if (status) status.textContent = 'لم يتم العثور على باركودات رقمية واضحة. جرّب صورة أوضح وأقرب.';
        } else {
          await addCompanyCodes(host, codes);
        }
      } catch (error) {
        if (status) status.textContent = 'تعذرت قراءة الصورة: ' + (error?.message || error);
      } finally { fileInput.value = ''; }
    });
    if (args.productId) {
      const db = client();
      host.__barcodeImageLoadError = null;
      host.__barcodeImageLoadPromise = db.from(COMPANY_ALIAS_TABLE).select('barcode').eq('company_id', args.companyId).eq('company_product_id', args.productId)
        .then(({ data, error }) => {
          if (error) throw error;
          // Do not overwrite changes made by the user while the query was in flight.
          if (host.dataset.barcodeImageFeatureKey !== `${args.companyId || ''}:${args.productId || ''}:on`) return;
          const savedCodes = [...new Set((data || []).map(row => normalize(row.barcode)).filter(Boolean).filter(code => code !== normalize(host.dataset.primaryBarcode)))];
          host.__barcodeImageCodes = [...new Set([...savedCodes, ...(host.__barcodeImageCodes || [])])];
          host.__barcodeImageLoadError = null;
          renderCompanyCodes(host);
        }).catch(error => {
          host.__barcodeImageLoadError = error;
          const status = host.querySelector('[data-barcode-image-status]');
          if (status) status.textContent = 'تعذر تحميل الباركودات الإضافية: ' + (error?.message || error);
        });
    }
  }

  window.initCompanyImageBarcodeControl = function (args) {
    const host = $(args?.containerId);
    if (!host || !settingLoaded) return;
    const companyId = args.companyId || host.dataset.companyId || '';
    const productId = args.productId || host.dataset.productId || '';
    const productName = args.productName || host.dataset.productName || '';
    const primaryBarcode = args.primaryBarcode || host.dataset.primaryBarcode || '';
    const key = `${companyId}:${productId}:${enabled ? 'on' : 'off'}`;
    if (host.dataset.barcodeImageFeatureKey === key && host.dataset.barcodeImageFeatureInitialized === 'true') return;
    createCompanyControl(host, { ...args, companyId, productId, productName, primaryBarcode });
  };

  async function resolveCompanyProductId(details, host) {
    const possible = details.productId || host?.dataset.productId;
    if (possible && /^[0-9a-f-]{20,}$/i.test(String(possible))) return String(possible);
    if (typeof details.rpcResult === 'string' && /^[0-9a-f-]{20,}$/i.test(details.rpcResult)) return details.rpcResult;
    const db = client();
    let query = db.from('company_products').select('id,barcode,name,created_at').eq('company_id', details.companyId).eq('name', details.productName || host?.dataset.productName || '');
    const primary = normalize(details.primaryBarcode || '');
    if (primary) query = query.eq('barcode', primary);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(1);
    if (error) throw error;
    return data?.[0]?.id || null;
  }

  window.saveCompanyImageBarcodeAliases = async function (details) {
    if (!settingLoaded || !enabled || !canUseFeature()) return;
    const host = $(details?.containerId);
    if (!host || host.dataset.barcodeImageFeatureKey?.endsWith(':off')) return;
    if (host.__barcodeImageLoadPromise) await host.__barcodeImageLoadPromise;
    if (host.__barcodeImageLoadError) throw host.__barcodeImageLoadError;
    const companyId = String(details.companyId || host.dataset.companyId || '');
    if (!companyId) return;
    const enteredCodes = host.__barcodeImageCodes || [];
    if (!(details.productId || host.dataset.productId) && !enteredCodes.length) return;
    const productId = await resolveCompanyProductId(details || {}, host);
    if (!productId) throw new Error('تم حفظ المادة، لكن تعذر تحديدها لحفظ الباركودات الإضافية. افتح المادة للتعديل ثم أعد الحفظ.');
    const db = client();
    const primary = normalize(details.primaryBarcode || $('cep_barcode')?.value || $('admin_cep_barcode')?.value || '');
    const desired = [...new Set((host.__barcodeImageCodes || []).map(normalize).filter(code => code && code !== primary))];
    for (const code of desired) {
      if (await checkCompanyCodeConflict(companyId, code, productId)) throw new Error(`الباركود ${code} مستخدم لمادة أخرى في الشركة.`);
    }
    const { data: existing, error: loadError } = await db.from(COMPANY_ALIAS_TABLE).select('id,barcode').eq('company_id', companyId).eq('company_product_id', productId);
    if (loadError) throw loadError;
    const existingByCode = new Map((existing || []).map(row => [normalize(row.barcode), row]));
    const toDelete = (existing || []).filter(row => !desired.includes(normalize(row.barcode))).map(row => row.id);
    if (toDelete.length) {
      const { error } = await db.from(COMPANY_ALIAS_TABLE).delete().eq('company_id', companyId).eq('company_product_id', productId).in('id', toDelete);
      if (error) throw error;
    }
    const toInsert = desired.filter(code => !existingByCode.has(code)).map(barcode => ({ company_id: companyId, company_product_id: productId, barcode, created_by: currentProfile()?.id || null }));
    if (toInsert.length) {
      const { error } = await db.from(COMPANY_ALIAS_TABLE).insert(toInsert);
      if (error) throw error;
    }
    host.dataset.productId = productId;
  };

  window.loadCompanyImageBarcodeAliases = async function (products, companyId) {
    const rows = Array.isArray(products) ? products : [];
    if (!rows.length) return rows;
    const db = client();
    const ids = rows.map(product => product.id).filter(Boolean);
    if (!ids.length) return rows;
    const { data, error } = await db.from(COMPANY_ALIAS_TABLE).select('company_product_id,barcode').eq('company_id', companyId).in('company_product_id', ids);
    if (error) throw error;
    const aliases = new Map();
    (data || []).forEach(row => {
      const id = String(row.company_product_id);
      if (!aliases.has(id)) aliases.set(id, []);
      const code = normalize(row.barcode);
      if (code && !aliases.get(id).includes(code)) aliases.get(id).push(code);
    });
    return rows.map(product => ({ ...product, additional_barcodes: aliases.get(String(product.id)) || [] }));
  };

  async function renderAdminSettings() {
    const panel = $('adminPanel');
    if (!panel || !isAdmin()) return;
    let card = $('barcodeImageFeatureAdminCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'barcodeImageFeatureAdminCard';
      card.className = 'card';
      card.style.marginBottom = '12px';
      card.innerHTML = '<h2>إضافة باركودات من الصور</h2><p class="muted" data-barcode-feature-setting-status>جاري قراءة الإعداد...</p><div class="actions"><button type="button" class="btn primary" data-barcode-feature-toggle disabled>...</button></div>';
      panel.insertBefore(card, panel.firstChild);
      card.querySelector('[data-barcode-feature-toggle]').addEventListener('click', toggleFeature);
    }
    const status = card.querySelector('[data-barcode-feature-setting-status]');
    const button = card.querySelector('[data-barcode-feature-toggle]');
    if (!settingLoaded || settingError) {
      const message = settingError || 'جاري تحميل الإعداد...';
      if (status.textContent !== message) status.textContent = message;
      button.disabled = true;
      if (button.textContent !== 'غير متاح') button.textContent = 'غير متاح';
    } else {
      const baseMessage = enabled ? 'حالة الميزة: مفعّلة للمتاجر والشركات.' : 'حالة الميزة: متوقفة. لن تظهر أدوات الصور للمتاجر والشركات.';
      const message = toggleError ? `${baseMessage} ${toggleError}` : baseMessage;
      if (status.textContent !== message) status.textContent = message;
      button.disabled = toggleBusy;
      const buttonText = toggleBusy ? 'جاري الحفظ...' : (enabled ? 'إلغاء تفعيل الميزة' : 'تفعيل الميزة');
      if (button.textContent !== buttonText) button.textContent = buttonText;
      const buttonClass = 'btn ' + (enabled ? 'danger' : 'primary');
      if (button.className !== buttonClass) button.className = buttonClass;
    }
  }

  async function toggleFeature() {
    const button = $('barcodeImageFeatureAdminCard')?.querySelector('[data-barcode-feature-toggle]');
    const status = $('barcodeImageFeatureAdminCard')?.querySelector('[data-barcode-feature-setting-status]');
    if (!(await window.sareeCheckAdmin?.(true)) && !isAdmin()) {
      if (status) status.textContent = 'هذا الإعداد لمدير الموقع فقط.';
      return;
    }
    const db = client();
    if (!db || toggleBusy) return;
    const next = !enabled;
    toggleError = '';
    toggleBusy = true;
    if (button) { button.disabled = true; button.textContent = 'جاري الحفظ...'; }
    try {
      const { data: { user } = {} } = await db.auth.getUser();
      const { error } = await db.from(SETTINGS_TABLE).upsert({ id: true, enabled: next, updated_by: user?.id || currentProfile()?.id || null, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (error) throw error;
      enabled = next;
      settingLoaded = true;
      settingError = '';
      toggleError = '';
      toggleBusy = false;
      await renderAdminSettings();
      scheduleApply();
    } catch (error) {
      toggleError = 'تعذر حفظ الإعداد: ' + (error?.message || String(error));
      toggleBusy = false;
      if (status) status.textContent = toggleError;
      if (button) { button.disabled = false; button.textContent = enabled ? 'إلغاء تفعيل الميزة' : 'تفعيل الميزة'; }
      scheduleApply();
    }
  }

  function mountStoreImageControl() {
    const host = $('storeAdditionalBarcodesBox');
    if (!host) return;
    let control = $('storeBarcodeImageControl');
    if (!control) {
      control = document.createElement('div');
      control.id = 'storeBarcodeImageControl';
      control.className = 'barcode-image-feature';
      control.dir = 'rtl';
      control.innerHTML = '<label class="muted">إضافة باركودات إضافية من الصور (عدد مفتوح)</label><input class="barcode-image-file" type="file" accept="image/*" multiple><div class="barcode-image-status">يمكن اختيار صورة واحدة أو عدة صور. لن يتغير الباركود الأساسي.</div>';
      host.appendChild(control);
      control.querySelector('input[type="file"]').addEventListener('change', async event => {
        const input = event.currentTarget;
        const files = Array.from(input.files || []);
        const status = control.querySelector('.barcode-image-status');
        if (!files.length) return;
        if (status) status.textContent = `جاري فحص ${files.length} صورة...`;
        try {
          const codes = await decodeFiles(files);
          if (!codes.length) {
            if (status) status.textContent = 'لم يتم العثور على باركودات رقمية واضحة. جرّب صورة أوضح وأقرب.';
            return;
          }
          let added = 0;
          for (const code of codes) {
            if (typeof window.addScannedStoreAdditionalBarcode === 'function') {
              if (await window.addScannedStoreAdditionalBarcode(code)) added++;
            }
          }
          if (status) status.textContent = `اكتُشف ${codes.length} باركود؛ أُضيف ${added}${codes.length - added ? `، وتُرك ${codes.length - added} لأنه مكرر أو أساسي أو مستخدم` : ''}.`;
        } catch (error) {
          if (status) status.textContent = 'تعذرت قراءة الصورة: ' + (error?.message || error);
        } finally { input.value = ''; }
      });
    }
    const show = settingLoaded && enabled && canUseFeature();
    control.style.display = show ? '' : 'none';
    if (show) ensureStyles();
  }

  function applyCompanyControls() {
    document.querySelectorAll('#cepImageBarcodeBox, #adminCepImageBarcodeBox').forEach(host => {
      const args = {
        containerId: host.id,
        companyId: host.dataset.companyId || '',
        productId: host.dataset.productId || null,
        productName: host.dataset.productName || '',
        primaryBarcode: host.dataset.primaryBarcode || ''
      };
      window.initCompanyImageBarcodeControl?.(args);
    });
  }

  function applyUI() {
    renderAdminSettings().catch(error => console.warn('barcode image manager setting:', error));
    mountStoreImageControl();
    applyCompanyControls();
  }
  function scheduleApply() {
    if (applyTimer) clearTimeout(applyTimer);
    applyTimer = setTimeout(applyUI, 80);
  }

  ensureStyles();
  const observer = new MutationObserver(scheduleApply);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  loadSetting();
  scheduleApply();
})();
