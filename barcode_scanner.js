/* سعرلي سوريا — ماسح باركود فقط.
   كاميرا + إدخال يدوي، بدون توليد أو تنزيل باركود.
   نتائج البحث في وضع المتجر تمر دائماً عبر استعلام store_id المعزول.
*/
(function(){
  'use strict';
  let scanner=null;
  let mode=null;
  let activeStoreId=null;
  let closing=false;

  const el=id=>document.getElementById(id);
  const normalize=v=>String(v??'').replace(/\D/g,'').trim();

  function loadLibrary(cb){
    if(window.Html5Qrcode){cb();return;}
    let s=document.getElementById('html5QrScript');
    if(s){s.addEventListener('load',cb,{once:true});return;}
    s=document.createElement('script');
    s.id='html5QrScript';
    s.src='https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
    s.onload=cb;
    s.onerror=()=>setStatus('تعذر تحميل قارئ الباركود. استخدم الإدخال اليدوي.');
    document.head.appendChild(s);
  }

  window.openBarcodeScannerForAdd=function(){ mode='add'; activeStoreId=null; openScanner(); };
  window.openBarcodeScannerForStore=function(storeId){ mode='store'; activeStoreId=storeId; openScanner(); };

  function setStatus(text){const n=el('barcodeScanStatus');if(n)n.textContent=text;}

  function openScanner(){
    window.closeBarcodeScanner?.();
    const modal=document.createElement('div');
    modal.id='barcodeScannerModal';
    modal.style.cssText='position:fixed;inset:0;z-index:999999;background:rgba(5,9,11,.96);display:flex;align-items:center;justify-content:center;padding:15px;direction:rtl';
    modal.innerHTML=`<div style="width:100%;max-width:520px;background:#10191c;border-radius:20px;padding:18px;color:#fff">
      <h2 style="margin-top:0;text-align:center">📷 مسح الباركود</h2>
      <p style="text-align:center;opacity:.75">وجّه الكاميرا نحو الباركود أو اكتب الرقم يدوياً.</p>
      <div id="barcodeReader" style="width:100%;min-height:280px;background:#000;border-radius:15px;overflow:hidden"></div>
      <p id="barcodeScanStatus" style="text-align:center;color:#39d98a;margin:12px 0">جاري تشغيل الكاميرا...</p>
      <div style="display:flex;gap:8px;margin-top:10px"><input id="barcodeManualModal" type="text" inputmode="numeric" autocomplete="off" placeholder="رقم الباركود" style="flex:1;min-width:0"><button type="button" class="btn primary" id="barcodeManualSearchBtn">بحث</button></div>
      <button type="button" class="btn secondary" id="barcodeCloseBtn" style="width:100%;margin-top:12px">إغلاق</button>
    </div>`;
    document.body.appendChild(modal);
    el('barcodeManualSearchBtn').onclick=()=>{
      const code=normalize(el('barcodeManualModal')?.value);
      if(!code)return alert('اكتب رقم الباركود أولاً.');
      handleBarcode(code);
    };
    el('barcodeManualModal').addEventListener('keydown',e=>{if(e.key==='Enter')el('barcodeManualSearchBtn').click();});
    el('barcodeCloseBtn').onclick=()=>window.closeBarcodeScanner();
    loadLibrary(startScanner);
  }

  function startScanner(){
    if(!window.Html5Qrcode){setStatus('تعذر تحميل قارئ الباركود.');return;}
    try{ scanner=new Html5Qrcode('barcodeReader'); }catch(err){setStatus('تعذر تشغيل الكاميرا. استخدم الإدخال اليدوي.');return;}
    scanner.start({facingMode:{ideal:'environment'}},{fps:10,qrbox:{width:280,height:140},aspectRatio:1.777},text=>{
      const code=normalize(text);
      if(code) handleBarcode(code);
    },()=>{}).then(()=>setStatus('📷 الكاميرا تعمل — وجّهها نحو الباركود')).catch(err=>{
      console.warn(err);setStatus('تعذر فتح الكاميرا. اسمح بالكاميرا أو استخدم الكتابة اليدوية.');
    });
  }

  async function handleBarcode(value){
    const code=normalize(value); if(!code || closing)return;
    const currentMode=mode; const storeId=activeStoreId;
    await window.closeBarcodeScanner();
    if(currentMode==='add'){
      const input=el('barcode');
      if(input){input.value=code;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
      if(el('barcodeMsg'))el('barcodeMsg').textContent='✅ تم قراءة الباركود: '+code;
      await fillProductFromBarcode(code);
      return;
    }
    if(currentMode==='store' && storeId){
      window.handleStoreBarcodeScan?.(code,storeId);
      return;
    }
  }

  async function fillProductFromBarcode(code){
    try{
      const storeId=profileData?.store_id || document.getElementById('merchantStoreSelect')?.value || null;
      let product=null;
      if(storeId){
        const {data,error}=await supabaseClient.from('price_listings').select('product_id,products(*)').eq('store_id',storeId).eq('approved',true);
        if(!error && Array.isArray(data)){
          const match=data.find(row=>normalize(row.products?.barcode)===code);
          if(match) product=match.products||null;
        }
      }
      if(!product){
        const {data,error}=await supabaseClient.from('products').select('*').eq('barcode',code).limit(1).maybeSingle();
        if(error)throw error;
        product=data||null;
      }
      if(!product){if(el('barcodeMsg'))el('barcodeMsg').textContent='ℹ️ لم نجد مادة بهذا الباركود. يمكنك إكمال الحقول يدوياً.';return;}
      if(el('pn'))el('pn').value=product.name||'';
      if(el('brand'))el('brand').value=product.brand||'';
      if(el('unit'))el('unit').value=product.unit||'';
      if(el('cat'))el('cat').value=product.category||'';
      if(el('barcode'))el('barcode').value=code;
      if(el('barcodeMsg'))el('barcodeMsg').textContent='✅ تم العثور على المادة وتعبئة بياناتها تلقائياً.';
    }catch(err){console.warn('barcode fill:',err);}
  }

  window.closeBarcodeScanner=async function(){
    closing=true;
    if(scanner){
      try{await scanner.stop();}catch(e){}
      try{scanner.clear();}catch(e){}
      scanner=null;
    }
    document.getElementById('barcodeScannerModal')?.remove();
    closing=false;
    mode=null;activeStoreId=null;
  };
})();
