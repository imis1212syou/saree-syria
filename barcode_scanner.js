/* سعرلي سوريا — ماسح باركود V8
   يستخدم html5-qrcode مع اختيار كاميرا خلفية حقيقي،
   ويدعم EAN/UPC/Code128/Code39/ITF/Codabar. */
(function(){
  'use strict';
  let scanner=null, mode=null, activeStoreId=null, handling=false, lastCode='', lastAt=0;
  const $=id=>document.getElementById(id);
  const normalize=v=>String(v??'').trim().replace(/[^0-9A-Za-z_-]/g,'');
  const status=t=>{const x=$('barcodeScanStatus');if(x)x.textContent=t;};

  function loadLibrary(){
    return new Promise((resolve,reject)=>{
      if(window.Html5Qrcode)return resolve();
      const old=document.getElementById('html5QrScript');
      if(old){old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});return;}
      const s=document.createElement('script');s.id='html5QrScript';
      s.src='https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
    });
  }

  window.openBarcodeScannerForAdd=()=>{mode='add';activeStoreId=null;open();};
  window.openBarcodeScannerForStore=id=>{mode='store';activeStoreId=id;open();};

  function open(){
    window.closeBarcodeScanner?.(); handling=false; lastCode=''; lastAt=0;
    const modal=document.createElement('div'); modal.id='barcodeScannerModal';
    modal.style.cssText='position:fixed;inset:0;z-index:999999;background:rgba(5,9,11,.97);display:flex;align-items:center;justify-content:center;padding:12px;direction:rtl';
    modal.innerHTML=`<div style="width:100%;max-width:620px;background:#10191c;border-radius:20px;padding:16px;color:#fff;box-sizing:border-box">
      <h2 style="margin:0 0 8px;text-align:center">📷 مسح الباركود</h2>
      <p style="text-align:center;opacity:.85">قرّب الباركود من الكاميرا وثبّت الهاتف. اجعل الخطوط داخل الإطار.</p>
      <div id="barcodeReader" style="width:100%;min-height:340px;background:#000;border-radius:15px;overflow:hidden"></div>
      <p id="barcodeScanStatus" style="text-align:center;margin:12px 0">جاري تشغيل الكاميرا...</p>
      <div style="display:flex;gap:8px;margin-top:10px"><input id="barcodeManualModal" type="text" inputmode="numeric" autocomplete="off" placeholder="اكتب الباركود يدوياً" style="flex:1;min-width:0"><button type="button" class="btn primary" id="barcodeManualSearchBtn">إدخال</button></div>
      <button type="button" class="btn secondary" id="barcodeCloseBtn" style="width:100%;margin-top:12px">إغلاق</button>
    </div>`;
    document.body.appendChild(modal);
    $('barcodeManualSearchBtn').onclick=()=>{const c=normalize($('barcodeManualModal').value);if(c)finish(c);else alert('اكتب رقم الباركود أولاً.');};
    $('barcodeManualModal').addEventListener('keydown',e=>{if(e.key==='Enter')$('barcodeManualSearchBtn').click();});
    $('barcodeCloseBtn').onclick=()=>window.closeBarcodeScanner();
    start();
  }

  async function start(){
    try{await loadLibrary();}catch(e){status('تعذر تحميل قارئ الباركود. اكتب الرقم يدوياً.');return;}
    if(!window.Html5Qrcode){status('قارئ الباركود غير متاح. اكتب الرقم يدوياً.');return;}
    try{
      scanner=new Html5Qrcode('barcodeReader');
      let cameraId=null;
      try{
        const cams=await Html5Qrcode.getCameras();
        if(cams?.length){
          const rear=cams.find(c=>/back|rear|environment|خلف/i.test(c.label||''));
          cameraId=(rear||cams[cams.length-1]).id;
        }
      }catch(_){ }
      const F=window.Html5QrcodeSupportedFormats||{};
      const formats=['EAN_13','EAN_8','UPC_A','UPC_E','CODE_128','CODE_39','ITF','CODABAR']
        .map(k=>F[k]).filter(v=>v!==undefined);
      const config={fps:15,qrbox:{width:Math.min(420,Math.floor(window.innerWidth*.82)),height:190},aspectRatio:1.777,disableFlip:false};
      if(formats.length)config.formatsToSupport=formats;
      const camera=cameraId||{facingMode:'environment'};
      await scanner.start(camera,config,decoded=>{
        const c=normalize(decoded); if(!c||handling)return;
        const now=Date.now(); if(c===lastCode&&now-lastAt<1800)return;
        lastCode=c;lastAt=now;finish(c);
      },()=>{});
      status('📷 الكاميرا تعمل — ضع الباركود داخل الإطار');
    }catch(err){
      console.warn('barcode camera:',err);
      status('تعذر تشغيل قارئ الباركود. تأكد من إذن الكاميرا أو استخدم الإدخال اليدوي.');
    }
  }

  async function fillProductFromBarcode(code){
    try{
      const storeId=window.profileData?.store_id||null; let product=null;
      if(storeId){
        const {data,error}=await supabaseClient.from('price_listings').select('product_id,products(*)').eq('store_id',storeId).eq('approved',true);
        if(!error&&Array.isArray(data)){const row=data.find(x=>normalize(x.products?.barcode)===code);if(row)product=row.products;}
      }
      if(!product){const {data,error}=await supabaseClient.from('products').select('*').eq('barcode',code).limit(1).maybeSingle();if(error)throw error;product=data||null;}
      if(product){if($('pn'))$('pn').value=product.name||'';if($('brand'))$('brand').value=product.brand||'';if($('unit'))$('unit').value=product.unit||'';if($('cat'))$('cat').value=product.category||'';}
    }catch(e){console.warn('fill product:',e);}
  }

  async function finish(code){
    if(handling)return; handling=true; code=normalize(code); if(!code){handling=false;return;}
    status('✅ تم التقاط الباركود: '+code+' — جاري البحث...');
    if(mode==='add'){
      const input=$('barcode');if(input){input.value=code;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
      if($('barcodeMsg'))$('barcodeMsg').textContent='✅ تم تسجيل الباركود: '+code;
      await stop(); await fillProductFromBarcode(code); return;
    }
    if(mode==='store'&&activeStoreId){
      const storeId=activeStoreId; const input=$('storeBarcodeSearch');if(input){input.value=code;input.dispatchEvent(new Event('input',{bubbles:true}));}
      await stop(); if(typeof window.searchStoreBarcode==='function')await window.searchStoreBarcode(storeId,code); return;
    }
    await stop();
  }

  async function stop(){
    if(scanner){try{await scanner.stop();}catch(e){}try{scanner.clear();}catch(e){}scanner=null;}
    document.getElementById('barcodeScannerModal')?.remove(); mode=null;activeStoreId=null;handling=false;
  }
  window.closeBarcodeScanner=stop;
})();
