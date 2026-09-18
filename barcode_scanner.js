/* سعرلي سوريا — ماسح باركود.
   يحاول أولاً BarcodeDetector الأصلي مع كاميرا الهاتف،
   ثم يستخدم html5-qrcode كبديل. الإدخال اليدوي متاح دائماً.
*/
(function(){
  'use strict';
  let scanner=null, nativeStream=null, nativeTimer=null;
  let mode=null, activeStoreId=null, closing=false, handling=false;

  const el=id=>document.getElementById(id);
  const normalize=v=>String(v??'').replace(/\D/g,'').trim();
  const status=t=>{const n=el('barcodeScanStatus');if(n)n.textContent=t;};

  function loadLibrary(cb){
    if(window.Html5Qrcode){cb();return;}
    let s=document.getElementById('html5QrScript');
    if(s){s.addEventListener('load',cb,{once:true});s.addEventListener('error',()=>status('تعذر تحميل قارئ الكاميرا. يمكنك استخدام الإدخال اليدوي.'),{once:true});return;}
    s=document.createElement('script');
    s.id='html5QrScript';
    s.src='https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
    s.onload=cb;
    s.onerror=()=>status('تعذر تحميل قارئ الكاميرا. يمكنك استخدام الإدخال اليدوي.');
    document.head.appendChild(s);
  }

  window.openBarcodeScannerForAdd=function(){mode='add';activeStoreId=null;openScanner();};
  window.openBarcodeScannerForStore=function(storeId){mode='store';activeStoreId=storeId;openScanner();};

  function openScanner(){
    window.closeBarcodeScanner?.();
    closing=false;
    const modal=document.createElement('div');
    modal.id='barcodeScannerModal';
    modal.style.cssText='position:fixed;inset:0;z-index:999999;background:rgba(5,9,11,.97);display:flex;align-items:center;justify-content:center;padding:15px;direction:rtl';
    modal.innerHTML=`<div style="width:100%;max-width:520px;background:#10191c;border-radius:20px;padding:18px;color:#fff;box-sizing:border-box">
      <h2 style="margin-top:0;text-align:center">📷 مسح الباركود</h2>
      <p style="text-align:center;opacity:.8">اسمح للمتصفح باستخدام الكاميرا ثم وجّهها نحو الباركود.</p>
      <video id="barcodeNativeVideo" playsinline muted autoplay style="display:none;width:100%;height:280px;object-fit:cover;border-radius:15px;background:#000"></video>
      <div id="barcodeReader" style="width:100%;min-height:280px;background:#000;border-radius:15px;overflow:hidden;display:none"></div>
      <p id="barcodeScanStatus" style="text-align:center;margin:12px 0">جاري تجهيز الكاميرا...</p>
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
    startCamera();
  }

  async function startCamera(){
    if(!navigator.mediaDevices?.getUserMedia){
      status('هذا المتصفح لا يتيح الكاميرا هنا. استخدم الإدخال اليدوي.');
      return;
    }

    // المسار الأصلي: يعمل بدون تحميل مكتبة خارجية عندما يدعم المتصفح BarcodeDetector.
    if('BarcodeDetector' in window){
      try{
        nativeStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
        if(closing)return;
        const video=el('barcodeNativeVideo');
        video.srcObject=nativeStream;
        video.style.display='block';
        await video.play();
        const detector=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf','qr_code']});
        status('📷 الكاميرا تعمل — وجّهها نحو الباركود');
        const loop=async()=>{
          if(closing||!nativeStream)return;
          try{
            const codes=await detector.detect(video);
            const code=normalize(codes?.[0]?.rawValue);
            if(code){await handleBarcode(code);return;}
          }catch(e){/* تابع المحاولة */}
          nativeTimer=requestAnimationFrame(loop);
        };
        nativeTimer=requestAnimationFrame(loop);
        return;
      }catch(err){
        console.warn('native camera failed',err);
        stopNative();
      }
    }

    // بديل html5-qrcode.
    const reader=el('barcodeReader');
    if(reader)reader.style.display='block';
    status('جاري تحميل قارئ الباركود...');
    loadLibrary(startHtml5);
  }

  function startHtml5(){
    if(closing)return;
    if(!window.Html5Qrcode){status('تعذر تشغيل قارئ الباركود. استخدم الإدخال اليدوي.');return;}
    try{scanner=new Html5Qrcode('barcodeReader');}
    catch(err){console.warn(err);status('تعذر إنشاء قارئ الكاميرا. استخدم الإدخال اليدوي.');return;}
    scanner.start(
      {facingMode:'environment'},
      {fps:10,qrbox:{width:280,height:140},aspectRatio:1.777},
      text=>{const code=normalize(text);if(code)handleBarcode(code);},
      ()=>{}
    ).then(()=>status('📷 الكاميرا تعمل — وجّهها نحو الباركود'))
     .catch(err=>{
       console.warn('html5-qrcode camera failed',err);
       status('تعذر فتح الكاميرا. اضغط سماح للكاميرا أو استخدم الإدخال اليدوي.');
     });
  }

  function stopNative(){
    if(nativeTimer)cancelAnimationFrame(nativeTimer);
    nativeTimer=null;
    if(nativeStream){try{nativeStream.getTracks().forEach(t=>t.stop());}catch(e){}nativeStream=null;}
    const v=el('barcodeNativeVideo');if(v)v.srcObject=null;
  }

  async function handleBarcode(value){
    const code=normalize(value);
    if(!code||closing||handling)return;
    handling=true;
    const currentMode=mode,storeId=activeStoreId;
    if(currentMode==='add'){
      const input=el('barcode');
      if(input){input.value=code;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
      if(el('barcodeMsg'))el('barcodeMsg').textContent='✅ تم قراءة الباركود: '+code;
      await fillProductFromBarcode(code);
      await window.closeBarcodeScanner();
      return;
    }
    if(currentMode==='store'&&storeId){
      const input=el('barcodeManualModal');
      if(input) input.value=code;
      status('✅ تم قراءة الباركود: '+code+' — جاري البحث...');
      try{
        if(typeof window.handleStoreBarcodeScan==='function') await window.handleStoreBarcodeScan(code,storeId);
      }finally{
        setTimeout(()=>window.closeBarcodeScanner(),700);
      }
    }
  }

  async function fillProductFromBarcode(code){
    try{
      const storeId=window.profileData?.store_id || document.getElementById('merchantStoreSelect')?.value || null;
      let product=null;
      if(storeId){
        const {data,error}=await supabaseClient.from('price_listings').select('product_id,products(*)').eq('store_id',storeId).eq('approved',true);
        if(!error&&Array.isArray(data)){
          const match=data.find(row=>normalize(row.products?.barcode)===code);
          if(match)product=match.products||null;
        }
      }
      if(!product){
        const {data,error}=await supabaseClient.from('products').select('*').eq('barcode',code).limit(1).maybeSingle();
        if(error)throw error;product=data||null;
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
    stopNative();
    if(scanner){try{await scanner.stop();}catch(e){}try{scanner.clear();}catch(e){}scanner=null;}
    document.getElementById('barcodeScannerModal')?.remove();
    mode=null;activeStoreId=null;
  };
})();
